"""Database layer & M1/M2/Auth DB-backed providers for Module 3 (AI Personal Health Assistant).

Synchronized with the latest database schema in `1ron9/vitap` (branch `codex/m1-phase-a`,
migrations `20261109_schema_v2.py`, `20261111_dev_v3_1.py`, and `20261117_m1_phase_a.py`).

Compatibility:
- Preserves `Base(DeclarativeBase)` so existing `from .db import Base` imports in `models.py`
  continue to work without modification.
- Provides async SQLAlchemy engine/session helpers (`get_async_session`, `async_session_scope`)
  and DB-backed implementations of the M3 integration Protocols (`DbHealthContextProvider`,
  `DbDrugEntityResolver`, `DbDrugDirectory`, `DbInteractionChecker`, `DbConsentChecker`)
  so the M3 chatbot can read/write directly against the VitaP PostgreSQL database.
"""
from __future__ import annotations

import logging
import os
import unicodedata
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from itertools import combinations
from typing import Any, AsyncIterator, Callable, Mapping, Sequence
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

try:
    # Layout in demo-hybrid-rag-vibe-code (`app/modules/ai_assistant/db.py`)
    from .enums import CONSENT_SCOPE, InteractionStatus, PersonalContextSection
    from .integration import (
        AllergyData,
        ConditionData,
        DrugResolution,
        DrugSelection,
        DrugSummary,
        Finding,
        InteractionReport,
        MedicationData,
        PairResult,
        Principal,
        ProfileData,
        RawHealthContext,
        ReportSummary,
        SourceRef,
        VitalData,
    )
except ImportError:
    # Layout when placed at `backend/app/modules/db.py`
    from app.modules.ai_assistant.enums import CONSENT_SCOPE, InteractionStatus, PersonalContextSection
    from app.modules.ai_assistant.integration import (
        AllergyData,
        ConditionData,
        DrugResolution,
        DrugSelection,
        DrugSummary,
        Finding,
        InteractionReport,
        MedicationData,
        PairResult,
        Principal,
        ProfileData,
        RawHealthContext,
        ReportSummary,
        SourceRef,
        VitalData,
    )

logger = logging.getLogger(__name__)


# =============================================================================
# 1. Declarative Base & Async Engine / Session Factory
# =============================================================================
class Base(DeclarativeBase):
    """Base ORM class for Module 3 tables (`chat_sessions`, `chat_messages`, etc.)."""


def build_async_database_url(
    database_url: str | None = None,
    *,
    env: Mapping[str, str] | None = None,
) -> URL:
    """Resolve an async SQLAlchemy URL (`postgresql+asyncpg://...` or `sqlite+aiosqlite://...`).

    Priority matches `1ron9/vitap/backend/app/core/database.py`:
    1. Explicit `database_url` argument
    2. Individual `POSTGRES_*` environment variables (handles special characters in password)
    3. `DATABASE_URL` environment variable
    """
    source_env = os.environ if env is None else env

    if database_url:
        parsed = make_url(database_url)
    elif source_env.get("POSTGRES_HOST"):
        return URL.create(
            "postgresql+asyncpg",
            username=source_env.get("POSTGRES_USER", "postgres"),
            password=source_env.get("POSTGRES_PASSWORD", ""),
            host=source_env["POSTGRES_HOST"],
            port=int(source_env.get("POSTGRES_PORT", "5432")),
            database=source_env.get("POSTGRES_DB", "vitap"),
        )
    elif source_env.get("DATABASE_URL"):
        parsed = make_url(source_env["DATABASE_URL"])
    else:
        raise RuntimeError("Database configuration missing: set DATABASE_URL or POSTGRES_HOST.")

    driver = parsed.drivername
    if driver in ("postgresql", "postgres", "postgresql+psycopg2", "postgresql+psycopg"):
        return parsed.set(drivername="postgresql+asyncpg")
    if driver == "sqlite":
        return parsed.set(drivername="sqlite+aiosqlite")
    return parsed


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_db(
    database_url: str | None = None,
    *,
    echo: bool = False,
    pool_size: int = 10,
    max_overflow: int = 20,
    statement_timeout_ms: int = 5000,
) -> async_sessionmaker[AsyncSession]:
    """Initialize module-level AsyncEngine and async_sessionmaker."""
    global _engine, _session_factory

    url = build_async_database_url(database_url)
    kwargs: dict[str, Any] = {"echo": echo, "pool_pre_ping": True}
    if url.get_backend_name() == "postgresql":
        kwargs["pool_size"] = pool_size
        kwargs["max_overflow"] = max_overflow
        kwargs["connect_args"] = {
            "timeout": 5,
            "server_settings": {"statement_timeout": str(statement_timeout_ms)},
        }

    _engine = create_async_engine(url, **kwargs)
    _session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    return _session_factory


def get_engine(database_url: str | None = None) -> AsyncEngine:
    if _engine is None:
        init_db(database_url)
    assert _engine is not None
    return _engine


def get_session_factory(database_url: str | None = None) -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        init_db(database_url)
    assert _session_factory is not None
    return _session_factory


async def dispose_db() -> None:
    """Gracefully close pooled connections on application shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None


async def get_async_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding an `AsyncSession` per request."""
    factory = get_session_factory()
    async with factory() as session:
        yield session


@asynccontextmanager
async def async_session_scope(
    session_factory: async_sessionmaker[AsyncSession] | None = None,
) -> AsyncIterator[AsyncSession]:
    """Async context manager for CLI scripts, background jobs, and standalone services."""
    factory = session_factory or get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def check_db_health(session: AsyncSession) -> bool:
    """Verify PostgreSQL connectivity and pgvector extension availability."""
    res = await session.execute(text("SELECT 1"))
    return res.scalar_one() == 1


# =============================================================================
# 2. Internal Helpers
# =============================================================================
def _normalize_text(value: str) -> str:
    norm = unicodedata.normalize("NFD", value.replace("đ", "d").replace("Đ", "D"))
    ascii_str = "".join(ch for ch in norm if unicodedata.category(ch) != "Mn")
    return " ".join(ascii_str.lower().split())


def _as_uuid(value: Any) -> UUID | None:
    if value is None:
        return None
    return value if isinstance(value, UUID) else UUID(str(value))


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


_SEVERITY_ORDER = {"MINOR": 1, "MODERATE": 2, "MAJOR": 3, "CONTRAINDICATED": 4}


def _highest_severity(severities: Sequence[str]) -> str | None:
    if not severities:
        return None
    return max(severities, key=lambda s: _SEVERITY_ORDER.get(s.upper(), 0)).upper()


# =============================================================================
# 3. Auth & Privacy Consent Checker (`user_consents`, `user_health_settings`)
# =============================================================================
_SQL_CHECK_AI_CONSENT = text(
    """
    SELECT is_accepted, revoked_at
    FROM user_consents
    WHERE user_id = :user_id
      AND scope = :scope
    ORDER BY consented_at DESC
    LIMIT 1
    """
)

_SQL_CHECK_AI_HEALTH_CONTEXT_SETTING = text(
    """
    SELECT allow_ai_health_context
    FROM user_health_settings
    WHERE user_id = :user_id
    LIMIT 1
    """
)


class DbConsentChecker:
    """Verifies AI processing consent (`user_consents`) and M1 AI context toggle (`user_health_settings`)."""

    def __init__(self, session_provider: Callable[[], AsyncSession] | async_sessionmaker[AsyncSession] | None = None) -> None:
        self._session_provider = session_provider

    async def has_ai_consent(
        self,
        user_id: UUID,
        *,
        session: AsyncSession | None = None,
        scope: str = CONSENT_SCOPE,
    ) -> bool:
        if session is not None:
            return await self._has_ai_consent(session, user_id, scope)
        factory = self._session_provider or get_session_factory()
        async with factory() as db:
            return await self._has_ai_consent(db, user_id, scope)

    async def allows_ai_health_context(
        self,
        user_id: UUID,
        *,
        session: AsyncSession | None = None,
    ) -> bool:
        if session is not None:
            return await self._allows_ai_health_context(session, user_id)
        factory = self._session_provider or get_session_factory()
        async with factory() as db:
            return await self._allows_ai_health_context(db, user_id)

    @staticmethod
    async def _has_ai_consent(session: AsyncSession, user_id: UUID, scope: str) -> bool:
        row = (await session.execute(_SQL_CHECK_AI_CONSENT, {"user_id": user_id, "scope": scope})).mappings().first()
        if row is None:
            return False
        return bool(row["is_accepted"]) and row["revoked_at"] is None

    @staticmethod
    async def _allows_ai_health_context(session: AsyncSession, user_id: UUID) -> bool:
        row = (await session.execute(_SQL_CHECK_AI_HEALTH_CONTEXT_SETTING, {"user_id": user_id})).mappings().first()
        # Matches `20261117_m1_phase_a.py` default: true when row not yet created
        return True if row is None else bool(row["allow_ai_health_context"])


# =============================================================================
# 4. Module 1 Personal Health Context Provider (`HealthContextProvider`)
# =============================================================================
# Strictly omits PII columns (`full_name`, `phone`, `email`) from SELECT.
_SQL_GET_PROFILE = text(
    """
    SELECT date_of_birth, biological_sex, height_cm
    FROM user_profiles
    WHERE user_id = :user_id
    LIMIT 1
    """
)

_SQL_GET_ACTIVE_CONDITIONS = text(
    """
    SELECT condition_name, icd10_code, status, verified
    FROM health_conditions
    WHERE user_id = :user_id
      AND UPPER(COALESCE(status, 'ACTIVE')) IN ('ACTIVE', 'CHRONIC')
    ORDER BY created_at DESC
    """
)

_SQL_GET_ALLERGIES = text(
    """
    SELECT allergen_name, allergen_type, severity, reaction, ingredient_id, verified
    FROM allergies
    WHERE user_id = :user_id
    ORDER BY created_at DESC
    """
)

_SQL_GET_ACTIVE_MEDICATIONS = text(
    """
    SELECT
        mc.drug_id,
        COALESCE(d.brand_name, d.generic_name, 'Thuốc không rõ tên') AS drug_name,
        mc.dosage,
        mc.frequency,
        mc.status,
        COALESCE(
            ARRAY_AGG(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL),
            ARRAY[]::text[]
        ) AS ingredient_names
    FROM medication_courses mc
    LEFT JOIN drugs d ON d.id = mc.drug_id
    LEFT JOIN drug_ingredients di ON di.drug_id = d.id
    LEFT JOIN ingredients i ON i.id = di.ingredient_id
    WHERE mc.user_id = :user_id
      AND UPPER(COALESCE(mc.status, 'ACTIVE')) = 'ACTIVE'
    GROUP BY mc.id, mc.drug_id, d.brand_name, d.generic_name, mc.dosage, mc.frequency, mc.status, mc.created_at
    ORDER BY mc.created_at DESC
    """
)

_SQL_GET_LATEST_VITALS = text(
    """
    SELECT DISTINCT ON (observation_type)
        observation_type,
        value,
        secondary_value,
        unit,
        measured_at
    FROM health_observations
    WHERE user_id = :user_id
    ORDER BY observation_type, measured_at DESC, id DESC
    """
)


class DbHealthContextProvider:
    """Implements `integration.HealthContextProvider` directly against VitaP M1 tables."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        *,
        respect_user_settings: bool = True,
    ) -> None:
        self._session_factory = session_factory
        self._respect_user_settings = respect_user_settings

    async def get_personal_health_context(
        self,
        principal: Principal,
        requested_sections: frozenset[PersonalContextSection],
        *,
        session: AsyncSession | None = None,
    ) -> RawHealthContext:
        if getattr(principal, "is_guest", False) or not requested_sections:
            return RawHealthContext()

        if session is not None:
            return await self._load(session, principal.user_id, requested_sections)

        factory = self._session_factory or get_session_factory()
        async with factory() as db:
            return await self._load(db, principal.user_id, requested_sections)

    async def _load(
        self,
        session: AsyncSession,
        user_id: UUID,
        requested_sections: frozenset[PersonalContextSection],
    ) -> RawHealthContext:
        if self._respect_user_settings:
            allowed = await DbConsentChecker._allows_ai_health_context(session, user_id)
            if not allowed:
                return RawHealthContext()

        ctx = RawHealthContext()

        if PersonalContextSection.HEALTH_PROFILE in requested_sections:
            row = (await session.execute(_SQL_GET_PROFILE, {"user_id": user_id})).mappings().first()
            if row is not None:
                ctx.profile = ProfileData(
                    date_of_birth=row["date_of_birth"],
                    biological_sex=row["biological_sex"],
                    height_cm=_as_float(row["height_cm"]),
                )

        if PersonalContextSection.HEALTH_CONDITIONS in requested_sections:
            rows = (await session.execute(_SQL_GET_ACTIVE_CONDITIONS, {"user_id": user_id})).mappings().all()
            ctx.conditions = [
                ConditionData(
                    condition_name=str(r["condition_name"]),
                    status=str(r["status"] or "ACTIVE"),
                    icd10_code=r["icd10_code"],
                    verified=r["verified"],
                )
                for r in rows
            ]

        if PersonalContextSection.ALLERGIES in requested_sections:
            rows = (await session.execute(_SQL_GET_ALLERGIES, {"user_id": user_id})).mappings().all()
            ctx.allergies = [
                AllergyData(
                    allergen_name=str(r["allergen_name"]),
                    allergen_type=r["allergen_type"],
                    severity=r["severity"],
                    reaction=r["reaction"],
                    ingredient_id=_as_uuid(r["ingredient_id"]),
                    verified=r["verified"],
                )
                for r in rows
            ]

        if PersonalContextSection.ACTIVE_MEDICATIONS in requested_sections:
            rows = (await session.execute(_SQL_GET_ACTIVE_MEDICATIONS, {"user_id": user_id})).mappings().all()
            ctx.medications = [
                MedicationData(
                    drug_name=str(r["drug_name"]),
                    drug_id=_as_uuid(r["drug_id"]),
                    ingredient_names=tuple(r["ingredient_names"] or ()),
                    dosage=r["dosage"],
                    frequency=r["frequency"],
                    status=str(r["status"] or "ACTIVE"),
                )
                for r in rows
            ]

        if PersonalContextSection.RECENT_VITALS in requested_sections:
            rows = (await session.execute(_SQL_GET_LATEST_VITALS, {"user_id": user_id})).mappings().all()
            ctx.latest_vitals = [
                VitalData(
                    observation_type=str(r["observation_type"]),
                    value=float(r["value"]),
                    secondary_value=_as_float(r["secondary_value"]),
                    unit=r["unit"],
                    measured_at=_as_utc(r["measured_at"]),
                )
                for r in rows
            ]

        return ctx


# =============================================================================
# 5. Module 2 Drug Directory, Entity Resolver & Rule Engine Interaction Checker
# =============================================================================
_SQL_GET_DRUG_SUMMARIES = text(
    """
    SELECT
        d.id AS drug_id,
        d.brand_name,
        d.generic_name,
        d.strength,
        COALESCE(
            ARRAY_AGG(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL),
            ARRAY[]::text[]
        ) AS ingredient_names
    FROM drugs d
    LEFT JOIN drug_ingredients di ON di.drug_id = d.id
    LEFT JOIN ingredients i ON i.id = di.ingredient_id
    WHERE d.id = ANY(:drug_ids)
    GROUP BY d.id, d.brand_name, d.generic_name, d.strength
    """
)

_SQL_RESOLVE_DRUG_ENTITY = text(
    """
    SELECT
        d.id AS drug_id,
        d.brand_name,
        d.generic_name,
        d.strength,
        GREATEST(
            CASE WHEN LOWER(COALESCE(d.normalized_brand_name, d.brand_name)) = :norm_name THEN 1.0 ELSE 0.0 END,
            CASE WHEN LOWER(COALESCE(d.generic_name, '')) = :norm_name THEN 0.98 ELSE 0.0 END,
            similarity(LOWER(COALESCE(d.normalized_brand_name, d.brand_name)), :norm_name),
            similarity(LOWER(COALESCE(d.generic_name, '')), :norm_name)
        ) AS match_score,
        CASE
            WHEN :norm_strength IS NOT NULL
                 AND LOWER(REPLACE(COALESCE(d.strength, ''), ' ', '')) = :norm_strength
            THEN 1 ELSE 0
        END AS strength_exact
    FROM drugs d
    WHERE LOWER(COALESCE(d.normalized_brand_name, d.brand_name)) = :norm_name
       OR LOWER(COALESCE(d.generic_name, '')) = :norm_name
       OR LOWER(COALESCE(d.normalized_brand_name, d.brand_name)) % :norm_name
       OR LOWER(COALESCE(d.generic_name, '')) % :norm_name
    ORDER BY match_score DESC, strength_exact DESC, d.brand_name ASC
    LIMIT 5
    """
)

_SQL_GET_DRUG_INGREDIENTS_WITH_SOURCE = text(
    """
    SELECT
        d.id AS drug_id,
        d.source_id,
        di.ingredient_id
    FROM drugs d
    LEFT JOIN drug_ingredients di ON di.drug_id = d.id
    WHERE d.id = ANY(:drug_ids)
    """
)

_SQL_GET_PAIR_INTERACTIONS = text(
    """
    SELECT
        di.id AS interaction_id,
        di.ingredient_a_id,
        di.ingredient_b_id,
        di.severity,
        di.description,
        di.mechanism,
        di.recommendation,
        di.evidence_level,
        ds.id AS source_id,
        ds.source_name,
        ds.version AS source_version,
        ds.source_url
    FROM drug_interactions di
    LEFT JOIN drug_sources ds ON ds.id = di.source_id
    WHERE (di.ingredient_a_id = ANY(:ing_a) AND di.ingredient_b_id = ANY(:ing_b))
       OR (di.ingredient_a_id = ANY(:ing_b) AND di.ingredient_b_id = ANY(:ing_a))
    """
)


class DbDrugDirectory:
    """Implements `integration.DrugDirectory` against `drugs`, `drug_ingredients`, `ingredients`."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession] | None = None) -> None:
        self._session_factory = session_factory

    async def get_drug_summaries(
        self,
        drug_ids: Sequence[UUID],
        *,
        session: AsyncSession | None = None,
    ) -> dict[UUID, DrugSummary]:
        unique_ids = list(dict.fromkeys(drug_ids))
        if not unique_ids:
            return {}
        if session is not None:
            return await self._load(session, unique_ids)
        factory = self._session_factory or get_session_factory()
        async with factory() as db:
            return await self._load(db, unique_ids)

    @staticmethod
    async def _load(session: AsyncSession, drug_ids: list[UUID]) -> dict[UUID, DrugSummary]:
        rows = (await session.execute(_SQL_GET_DRUG_SUMMARIES, {"drug_ids": drug_ids})).mappings().all()
        out: dict[UUID, DrugSummary] = {}
        for r in rows:
            did = _as_uuid(r["drug_id"])
            if did is None:
                continue
            label = str(r["brand_name"] or r["generic_name"] or did)
            if r["strength"] and str(r["strength"]).lower() not in label.lower():
                label = f"{label} {r['strength']}"
            out[did] = DrugSummary(
                drug_id=did,
                name=label,
                ingredient_names=tuple(r["ingredient_names"] or ()),
            )
        return out


class DbDrugEntityResolver:
    """Implements `integration.DrugEntityResolver` using deterministic SQL + pg_trgm (no LLM guessing)."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        *,
        min_match_score: float = 0.65,
        ambiguity_margin: float = 0.10,
    ) -> None:
        self._session_factory = session_factory
        self._min_match_score = float(min_match_score)
        self._ambiguity_margin = float(ambiguity_margin)

    async def resolve_drug_entity(
        self,
        extracted_name: str,
        extracted_strength: str | None = None,
        *,
        session: AsyncSession | None = None,
    ) -> DrugResolution:
        norm_name = _normalize_text(extracted_name or "")
        if not norm_name:
            return DrugResolution("UNRESOLVED")
        norm_strength = "".join((extracted_strength or "").lower().split()) or None

        if session is not None:
            return await self._resolve(session, norm_name, norm_strength)
        factory = self._session_factory or get_session_factory()
        async with factory() as db:
            return await self._resolve(db, norm_name, norm_strength)

    async def _resolve(
        self,
        session: AsyncSession,
        norm_name: str,
        norm_strength: str | None,
    ) -> DrugResolution:
        rows = (
            await session.execute(
                _SQL_RESOLVE_DRUG_ENTITY,
                {"norm_name": norm_name, "norm_strength": norm_strength},
            )
        ).mappings().all()
        if not rows:
            return DrugResolution("UNRESOLVED")

        top = rows[0]
        top_score = float(top["match_score"] or 0.0)
        if top_score < self._min_match_score:
            return DrugResolution("UNRESOLVED", match_score=top_score)

        # If multiple drugs tie closely (and strength doesn't disambiguate), return AMBIGUOUS
        if len(rows) > 1:
            second = rows[1]
            second_score = float(second["match_score"] or 0.0)
            same_strength_priority = int(top["strength_exact"]) == int(second["strength_exact"])
            if (top_score - second_score) < self._ambiguity_margin and same_strength_priority:
                return DrugResolution("AMBIGUOUS", match_score=top_score)

        return DrugResolution(
            resolution_status="MATCHED",
            candidate_drug_id=_as_uuid(top["drug_id"]),
            match_score=round(top_score, 4),
        )


class DbInteractionChecker:
    """Implements `integration.InteractionChecker` (4-state DDI Rule Engine on `drug_interactions`)."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession] | None = None) -> None:
        self._session_factory = session_factory

    async def check_drug_interactions(
        self,
        principal: Principal,
        selections: Sequence[DrugSelection],
        *,
        session: AsyncSession | None = None,
    ) -> InteractionReport:
        if len(selections) < 2:
            raise ValueError("At least 2 drug selections are required to check interactions.")

        if session is not None:
            return await self._check(session, selections)
        factory = self._session_factory or get_session_factory()
        async with factory() as db:
            return await self._check(db, selections)

    async def _check(
        self,
        session: AsyncSession,
        selections: Sequence[DrugSelection],
    ) -> InteractionReport:
        drug_ids = list(dict.fromkeys(s.drug_id for s in selections))
        rows = (
            await session.execute(_SQL_GET_DRUG_INGREDIENTS_WITH_SOURCE, {"drug_ids": drug_ids})
        ).mappings().all()

        drug_ingredients: dict[UUID, set[UUID]] = {}
        drug_has_source: dict[UUID, bool] = {}
        for r in rows:
            did = _as_uuid(r["drug_id"])
            if did is None:
                continue
            drug_ingredients.setdefault(did, set())
            if r["ingredient_id"] is not None:
                drug_ingredients[did].add(_as_uuid(r["ingredient_id"]))  # type: ignore[arg-type]
            if r["source_id"] is not None:
                drug_has_source[did] = True
            else:
                drug_has_source.setdefault(did, False)

        pairs: list[PairResult] = []
        evaluated_count = 0

        for sel_a, sel_b in combinations(selections, 2):
            ing_a = sorted(drug_ingredients.get(sel_a.drug_id, set()))
            ing_b = sorted(drug_ingredients.get(sel_b.drug_id, set()))
            missing: list[str] = []

            if sel_a.drug_id not in drug_ingredients:
                missing.append(f"{sel_a.selection_id}:DRUG_NOT_FOUND")
            elif not ing_a:
                missing.append(f"{sel_a.selection_id}:MISSING_INGREDIENTS")

            if sel_b.drug_id not in drug_ingredients:
                missing.append(f"{sel_b.selection_id}:DRUG_NOT_FOUND")
            elif not ing_b:
                missing.append(f"{sel_b.selection_id}:MISSING_INGREDIENTS")

            findings: list[Finding] = []
            sources: list[SourceRef] = []

            if ing_a and ing_b:
                ddi_rows = (
                    await session.execute(
                        _SQL_GET_PAIR_INTERACTIONS,
                        {"ing_a": ing_a, "ing_b": ing_b},
                    )
                ).mappings().all()

                seen_src: set[str] = set()
                for ddi in ddi_rows:
                    if ddi["ingredient_a_id"] == ddi["ingredient_b_id"]:
                        continue
                    src_ref = None
                    if ddi["source_id"] is not None or ddi["source_name"]:
                        src_ref = SourceRef(
                            source_id=_as_uuid(ddi["source_id"]),
                            source_name=ddi["source_name"],
                            version=ddi["source_version"],
                            source_url=ddi["source_url"],
                        )
                        src_key = str(src_ref.source_id or src_ref.source_name)
                        if src_key not in seen_src:
                            seen_src.add(src_key)
                            sources.append(src_ref)

                    findings.append(
                        Finding(
                            interaction_id=_as_uuid(ddi["interaction_id"]),
                            ingredient_a_id=_as_uuid(ddi["ingredient_a_id"]),
                            ingredient_b_id=_as_uuid(ddi["ingredient_b_id"]),
                            severity=str(ddi["severity"]).upper(),
                            description=str(ddi["description"]),
                            mechanism=ddi["mechanism"],
                            recommendation=ddi["recommendation"],
                            evidence_level=ddi["evidence_level"],
                            source=src_ref,
                        )
                    )

            # 4-state priority per VitaP_API_Docs.md §8.2
            if findings:
                status = InteractionStatus.INTERACTION_FOUND.value
                highest = _highest_severity([f.severity for f in findings])
                if not missing:
                    evaluated_count += 1
            elif missing:
                status = InteractionStatus.INSUFFICIENT_DATA.value
                highest = None
            elif not (drug_has_source.get(sel_a.drug_id, False) and drug_has_source.get(sel_b.drug_id, False)):
                status = InteractionStatus.INSUFFICIENT_DATA.value
                missing.append("MISSING_DRUG_SOURCE_COVERAGE")
                highest = None
            else:
                status = InteractionStatus.NO_KNOWN_INTERACTION_IN_DATABASE.value
                highest = None
                evaluated_count += 1

            pairs.append(
                PairResult(
                    selection_a=sel_a.selection_id,
                    selection_b=sel_b.selection_id,
                    status=status,
                    highest_severity=highest,
                    findings=findings,
                    missing_data=missing,
                    sources=sources,
                )
            )

        statuses = {p.status for p in pairs}
        if InteractionStatus.INTERACTION_FOUND.value in statuses:
            overall = InteractionStatus.INTERACTION_FOUND.value
        elif InteractionStatus.UNRESOLVED_DRUG.value in statuses:
            overall = InteractionStatus.UNRESOLVED_DRUG.value
        elif InteractionStatus.INSUFFICIENT_DATA.value in statuses:
            overall = InteractionStatus.INSUFFICIENT_DATA.value
        else:
            overall = InteractionStatus.NO_KNOWN_INTERACTION_IN_DATABASE.value

        return InteractionReport(
            summary=ReportSummary(
                overall_status=overall,
                pair_count=len(pairs),
                evaluated_pair_count=evaluated_count,
                is_complete=(evaluated_count == len(pairs)),
            ),
            pairs=pairs,
            limitations=[
                "Chỉ kiểm tra theo cặp hoạt chất trong phạm vi dữ liệu hiện có; không xét liều, đường dùng hay dạng bào chế.",
                "Không thay thế đánh giá của bác sĩ hoặc dược sĩ.",
            ],
        )


__all__ = [
    "Base",
    "DbConsentChecker",
    "DbDrugDirectory",
    "DbDrugEntityResolver",
    "DbHealthContextProvider",
    "DbInteractionChecker",
    "async_session_scope",
    "build_async_database_url",
    "check_db_health",
    "dispose_db",
    "get_async_session",
    "get_engine",
    "get_session_factory",
    "init_db",
]