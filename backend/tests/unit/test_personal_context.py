"""Dual-repo Unit Tests (Milestone 2): PersonalContext M1 (PII-free), DrugMentions & InteractionSupport M2.

Compatible with BOTH repositories without modification:
1. `ReallyEzyGame/demo-hybrid-rag-vibe-code` (`tests/test_personal_context.py`)
2. `1ron9/vitap` (`backend/tests/unit/test_personal_context.py`)
"""
from __future__ import annotations

import asyncio
import inspect
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import UUID, uuid4

# Ensure `app.*` is importable whether tests run from repo root, `backend/`, or `tests/`
_HERE = Path(__file__).resolve()
for _parent in _HERE.parents:
    if (_parent / "app" / "modules" / "ai_assistant").is_dir():
        if str(_parent) not in sys.path:
            sys.path.insert(0, str(_parent))
        break
    if (_parent / "backend" / "app" / "modules" / "ai_assistant").is_dir():
        _backend = _parent / "backend"
        if str(_backend) not in sys.path:
            sys.path.insert(0, str(_backend))
        break

from app.modules.ai_assistant.enums import CitationType, ContextMode, InteractionStatus, PersonalContextSection
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
    ProfileData,
    RawHealthContext,
    ReportSummary,
    SourceRef,
    VitalData,
)
from app.modules.ai_assistant.services import drug_mentions as dm_mod
from app.modules.ai_assistant.services import interaction_support as is_mod
from app.modules.ai_assistant.services import personal_context as pc_mod

PersonalContextService = pc_mod.PersonalContextService

# Detect repo variant cleanly via constructor / method signatures
_IS_DEMO_PC = "settings" in inspect.signature(PersonalContextService.__init__).parameters
_IS_DEMO_DM = hasattr(dm_mod, "DrugMentionExtractor")
_IS_DEMO_IS = hasattr(is_mod, "InteractionSupport")

NOW = datetime(2026, 11, 19, 10, 0, tzinfo=timezone.utc)


@dataclass
class _Principal:
    user_id: UUID
    is_guest: bool = False


class _StubHealthProvider:
    def __init__(self, ctx: RawHealthContext, *, fail: bool = False) -> None:
        self._ctx = ctx
        self._fail = fail
        self.calls: list[frozenset[PersonalContextSection]] = []

    async def get_personal_health_context(self, principal, requested_sections):
        self.calls.append(requested_sections)
        if self._fail:
            raise RuntimeError("M1 DB unavailable")
        return self._ctx


class _StubDrugResolver:
    def __init__(self, mapping: dict[str, DrugResolution]) -> None:
        self._mapping = {k.lower(): v for k, v in mapping.items()}

    async def resolve_drug_entity(self, extracted_name: str, extracted_strength: str | None = None) -> DrugResolution:
        return self._mapping.get(extracted_name.lower(), DrugResolution("UNRESOLVED"))


class _StubInteractionChecker:
    def __init__(self, report: InteractionReport, *, fail: bool = False) -> None:
        self._report = report
        self._fail = fail
        self.last_selections: list[DrugSelection] = []

    async def check_drug_interactions(self, principal, selections):
        self.last_selections = list(selections)
        if self._fail:
            raise RuntimeError("M2 Rule Engine timeout")
        return self._report


class _StubDrugDirectory:
    def __init__(self, items: dict[UUID, DrugSummary]) -> None:
        self._items = items

    async def get_drug_summaries(self, drug_ids):
        return {d: self._items[d] for d in drug_ids if d in self._items}


def _make_pc_service(provider, *, stale_vitals_days: int = 30, now: datetime = NOW):
    if _IS_DEMO_PC:
        settings = SimpleNamespace(stale_vitals_days=stale_vitals_days)
        return PersonalContextService(provider, settings, clock=lambda: now)
    return PersonalContextService(provider, stale_vitals_days=stale_vitals_days)


async def _build_pc(service, principal, question: str, *, mode: ContextMode = ContextMode.PERSONAL, now: datetime = NOW):
    if _IS_DEMO_PC:
        return await service.build(principal, mode, question)
    return await service.build(principal, question, context_mode=mode, now=now)


def _select_sections(question: str) -> frozenset[PersonalContextSection]:
    if hasattr(pc_mod, "select_sections"):
        return pc_mod.select_sections(question)
    return pc_mod.select_required_sections(question)


# =============================================================================
# 1. PersonalContext M1 Tests (GENERAL isolation, PII-free, Active-only, Stale vitals)
# =============================================================================
def test_general_mode_never_calls_provider():
    async def _run():
        provider = _StubHealthProvider(RawHealthContext())
        service = _make_pc_service(provider)
        ctx = await _build_pc(service, _Principal(uuid4()), "Tôi uống Paracetamol có sao không?", mode=ContextMode.GENERAL)
        assert ctx.is_empty
        assert ctx.sections_used == []
        assert provider.calls == []

    asyncio.run(_run())


def test_personal_context_is_pii_free_and_active_only():
    async def _run():
        metformin_id = uuid4()
        stopped_id = uuid4()
        raw = RawHealthContext(
            profile=ProfileData(date_of_birth=date(1996, 5, 10), biological_sex="MALE", height_cm=172.0),
            conditions=[
                ConditionData("Tiểu đường tuýp 2", status="CHRONIC", icd10_code="E11", verified=False),
                ConditionData("Viêm họng cũ", status="RESOLVED", verified=False),
            ],
            allergies=[
                AllergyData("Penicillin", severity="SEVERE", reaction="Nổi mề đay", verified=False),
            ],
            medications=[
                MedicationData("Metformin 500mg", drug_id=metformin_id, ingredient_names=("Metformin",), dosage="500mg", frequency="2 lần/ngày", status="ACTIVE"),
                MedicationData("Amoxicillin cũ", drug_id=stopped_id, status="COMPLETED"),
            ],
            latest_vitals=[
                VitalData("WEIGHT", 70.0, NOW - timedelta(days=3), unit="kg"),
                VitalData("BLOOD_PRESSURE", 135.0, NOW - timedelta(days=45), secondary_value=85.0, unit="mmHg"),
            ],
        )
        provider = _StubHealthProvider(raw)
        service = _make_pc_service(provider, stale_vitals_days=30, now=NOW)
        ctx = await _build_pc(
            service,
            _Principal(uuid4()),
            "Huyết áp của tôi cao và tôi đang uống thuốc tiểu đường, có cần lưu ý dị ứng không?",
            mode=ContextMode.PERSONAL,
            now=NOW,
        )

        # Must not leak raw DOB; must compute exact age (30 in Nov 2026 for 1996-05-10)
        assert "1996-05-10" not in ctx.prompt_text
        assert "30" in ctx.prompt_text

        # Active/Chronic conditions & Active meds only
        assert "Tiểu đường tuýp 2" in ctx.prompt_text
        assert "Viêm họng cũ" not in ctx.prompt_text
        assert "Metformin 500mg" in ctx.prompt_text
        assert "Amoxicillin cũ" not in ctx.prompt_text
        assert ctx.active_drug_ids == [metformin_id]
        assert "Penicillin" in ctx.prompt_text

        # Stale blood pressure (>30 days) must be flagged in prompt text
        assert "135" in ctx.prompt_text and "85" in ctx.prompt_text
        assert ("cũ" in ctx.prompt_text.lower()) or ("30" in ctx.prompt_text)

    asyncio.run(_run())


def test_drug_and_interaction_questions_select_allergies_and_active_meds():
    sections = _select_sections("Tôi uống Paracetamol chung với Ibuprofen có bị tương tác hay dị ứng không?")
    assert PersonalContextSection.ALLERGIES in sections
    assert PersonalContextSection.ACTIVE_MEDICATIONS in sections


def test_provider_failure_degrades_gracefully_without_raising():
    async def _run():
        provider = _StubHealthProvider(RawHealthContext(), fail=True)
        service = _make_pc_service(provider)
        ctx = await _build_pc(service, _Principal(uuid4()), "Tôi đang uống thuốc gì và bị bệnh nền nào?", mode=ContextMode.PERSONAL)
        assert ctx.unavailable is True
        assert ctx.sections_used == []

    asyncio.run(_run())


# =============================================================================
# 2. Drug Mention Resolution (Strict MATCHED-only — never guess AMBIGUOUS)
# =============================================================================
def test_drug_mention_resolution_accepts_only_matched():
    async def _run():
        asp_id = uuid4()
        resolver = _StubDrugResolver(
            {
                "aspirin": DrugResolution("MATCHED", candidate_drug_id=asp_id, match_score=0.98),
                "ibuprofen": DrugResolution("AMBIGUOUS", candidate_drug_id=uuid4(), match_score=0.61),
                "metformin": DrugResolution("UNRESOLVED"),
            }
        )
        query = "Tôi uống Aspirin, Ibuprofen và Metformin chung được không?"

        if _IS_DEMO_DM:
            extractor = dm_mod.DrugMentionExtractor(resolver, max_candidates=12)
            mentions = await extractor.extract(query)
            assert [m.drug_id for m in mentions] == [asp_id]
        else:
            mention_resolver = dm_mod.DrugMentionResolver(resolver, max_candidates=12)
            res = await mention_resolver.resolve_from_query(query)
            assert list(res.matched.keys()) == [asp_id]
            assert len(res.ambiguous) == 1
            assert res.has_unresolved is True

    asyncio.run(_run())


# =============================================================================
# 3. Module 2 InteractionSupport Integration
# =============================================================================
def test_interaction_support_calls_m2_rule_engine_and_emits_interaction_rule_citation():
    async def _run():
        asp_id, ibu_id = uuid4(), uuid4()
        report = InteractionReport(
            summary=ReportSummary(overall_status="INTERACTION_FOUND", pair_count=1, evaluated_pair_count=1, is_complete=True),
            pairs=[
                PairResult(
                    selection_a="s0" if _IS_DEMO_IS else "d1",
                    selection_b="s1" if _IS_DEMO_IS else "d2",
                    status=InteractionStatus.INTERACTION_FOUND.value,
                    highest_severity="MAJOR",
                    findings=[
                        Finding(
                            severity="MAJOR",
                            description="Tăng nguy cơ xuất huyết tiêu hóa khi dùng đồng thời Aspirin và Ibuprofen.",
                            mechanism="Cộng hợp tổn thương niêm mạc dạ dày.",
                            recommendation="Tránh dùng đồng thời nếu không có chỉ định bác sĩ.",
                            source=SourceRef(source_name="DDInter", version="v1", source_url="https://ddinter.scbdd.com/"),
                        )
                    ],
                )
            ],
        )
        resolver = _StubDrugResolver(
            {
                "aspirin": DrugResolution("MATCHED", candidate_drug_id=asp_id),
                "ibuprofen": DrugResolution("MATCHED", candidate_drug_id=ibu_id),
            }
        )
        checker = _StubInteractionChecker(report)
        principal = _Principal(uuid4())
        question = "Uống chung Aspirin với Ibuprofen có sao không?"

        if _IS_DEMO_IS:
            directory = _StubDrugDirectory(
                {
                    asp_id: DrugSummary(asp_id, "Aspirin", ("Acetylsalicylic acid",)),
                    ibu_id: DrugSummary(ibu_id, "Ibuprofen", ("Ibuprofen",)),
                }
            )
            extractor = dm_mod.DrugMentionExtractor(resolver, max_candidates=12)
            settings = SimpleNamespace(max_selected_drugs=10)
            support = is_mod.InteractionSupport(checker, directory, extractor, settings)
            from app.modules.ai_assistant.domain import PersonalContext
            ctx = await support.build_for_chat(principal, question, PersonalContext(), ContextMode.PERSONAL)
            assert ctx is not None
        else:
            mention_resolver = dm_mod.DrugMentionResolver(resolver, max_candidates=12)
            support = is_mod.InteractionSupportService(checker, mention_resolver)
            ctx = await support.evaluate(principal, question)

        assert ctx.unavailable is False
        assert "INTERACTION_FOUND" in ctx.prompt_text
        assert "MAJOR" in ctx.prompt_text
        assert len(ctx.evidence) >= 1
        assert ctx.evidence[0].citation_type is CitationType.INTERACTION_RULE

    asyncio.run(_run())