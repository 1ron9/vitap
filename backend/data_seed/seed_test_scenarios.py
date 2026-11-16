"""Comprehensive Test Data Seeder & Fixture Generator for VitaP.

Seeds 3 standardized test personas into the database and exports frontend fixtures:
1. patient.chronic@vitap.vn: Chronic patient with 30-day health entries, Metformin + Amlodipine.
2. patient.ddi@vitap.vn: Cardiac/GERD patient with critical DDI (Clopidogrel + Omeprazole).
3. patient.empty@vitap.vn: Brand new user with zero entries and zero prescriptions.

Standard test password for all personas: Vitap@Dev2026
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4, uuid5, NAMESPACE_DNS

from sqlalchemy import select
from sqlalchemy.orm import Session

# Add backend directory to sys.path if not present
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.modules.auth.models import User, UserProfile, UserConsent
from app.modules.health.models import HealthConditions, Allergies, HealthEntries, HealthObservations
from app.modules.medication.models import (
    DrugSources,
    Ingredients,
    Drugs,
    DrugIngredients,
    DrugInteractions,
    Prescriptions,
    PrescriptionItems,
)

STANDARD_PASSWORD = "Vitap@Dev2026"

def deterministic_uuid(name: str) -> UUID:
    """Generate reproducible UUIDs based on a recognizable seed name."""
    return uuid5(NAMESPACE_DNS, f"vitap.test.{name}")

def seed_test_scenarios(db: Session) -> dict[str, str]:
    """Seed test personas, drug catalog, and clinical rules into the database."""
    created_user_ids: dict[str, str] = {}
    password_hash = get_password_hash(STANDARD_PASSWORD)
    now_utc = datetime.now(timezone.utc)
    today = now_utc.date()

    # 1. Seed Drug Source & Canonical Ingredients
    source_id = deterministic_uuid("source.synthetic")
    source = db.get(DrugSources, source_id)
    if not source:
        source = DrugSources(
            id=source_id,
            source_name="SYNTHETIC_TEST_FIXTURES",
            version="dev-v3.1",
            source_url="https://vitap.vn/fixtures",
            license_info="Synthetic test dataset for development only",
            published_at=today,
            updated_at=now_utc,
        )
        db.add(source)
        db.flush()

    # Ingredients with canonical UUID ordering for DDI rule (id_a < id_b)
    # Generate ordered UUIDs: ing_a < ing_b
    ing_clopidogrel_id = UUID("10000000-0000-4000-8000-000000000001")
    ing_omeprazole_id   = UUID("10000000-0000-4000-8000-000000000002")
    ing_metformin_id    = UUID("10000000-0000-4000-8000-000000000003")
    ing_amlodipine_id   = UUID("10000000-0000-4000-8000-000000000004")
    ing_penicillin_id   = UUID("10000000-0000-4000-8000-000000000005")

    ingredients_data = [
        (ing_clopidogrel_id, "Clopidogrel", "clopidogrel", "B01AC04"),
        (ing_omeprazole_id, "Omeprazole", "omeprazole", "A02BC01"),
        (ing_metformin_id, "Metformin", "metformin", "A10BA02"),
        (ing_amlodipine_id, "Amlodipine", "amlodipine", "C08CA01"),
        (ing_penicillin_id, "Penicillin V", "penicillin", "J01CE02"),
    ]

    for i_id, name, norm, atc in ingredients_data:
        existing = db.get(Ingredients, i_id)
        if not existing:
            db.add(Ingredients(id=i_id, name=name, normalized_name=norm, atc_code=atc, created_at=now_utc))
    db.flush()

    # Canonical Drug-Drug Interaction: Clopidogrel + Omeprazole
    ddi_id = deterministic_uuid("ddi.clopidogrel.omeprazole")
    existing_ddi = db.get(DrugInteractions, ddi_id)
    if not existing_ddi:
        # Check canonical ordering: ing_clopidogrel_id < ing_omeprazole_id
        a_id, b_id = (
            (ing_clopidogrel_id, ing_omeprazole_id)
            if ing_clopidogrel_id < ing_omeprazole_id
            else (ing_omeprazole_id, ing_clopidogrel_id)
        )
        db.add(
            DrugInteractions(
                id=ddi_id,
                ingredient_a_id=a_id,
                ingredient_b_id=b_id,
                severity="CRITICAL",
                description="Omeprazole ức chế enzyme CYP2C19, làm giảm nồng độ chuyển hóa có hoạt tính của Clopidogrel và giảm hiệu quả chống kết tập tiểu cầu.",
                mechanism="Inhibition of CYP2C19 bioactivation",
                recommendation="Tránh dùng đồng thời. Cân nhắc thay thế Omeprazole bằng Pantoprazole nếu cần giảm tiết acid dạ dày.",
                evidence_level="HIGH",
                source_id=source_id,
                created_at=now_utc,
            )
        )
    db.flush()

    # Drugs catalog
    drug_clop_id = deterministic_uuid("drug.plavix")
    drug_omep_id = deterministic_uuid("drug.losec")
    drug_met_id = deterministic_uuid("drug.glucophage")
    drug_amlo_id = deterministic_uuid("drug.norvasc")

    drugs_data = [
        (drug_clop_id, "Plavix 75mg", "plavix", "Clopidogrel", "Viên nén bao phim", "75mg", ing_clopidogrel_id, Decimal("75.0"), "mg"),
        (drug_omep_id, "Losec 20mg", "losec", "Omeprazole", "Viên nang kháng dịch dạ dày", "20mg", ing_omeprazole_id, Decimal("20.0"), "mg"),
        (drug_met_id, "Glucophage 500mg", "glucophage", "Metformin", "Viên nén", "500mg", ing_metformin_id, Decimal("500.0"), "mg"),
        (drug_amlo_id, "Norvasc 5mg", "norvasc", "Amlodipine", "Viên nén", "5mg", ing_amlodipine_id, Decimal("5.0"), "mg"),
    ]

    for d_id, b_name, norm, gen_name, dosage, strength, _, _, _ in drugs_data:
        if not db.get(Drugs, d_id):
            db.add(
                Drugs(
                    id=d_id,
                    brand_name=b_name,
                    normalized_brand_name=norm,
                    generic_name=gen_name,
                    dosage_form=dosage,
                    strength=strength,
                    source_id=source_id,
                    created_at=now_utc,
                )
            )
    db.flush()

    for d_id, _, _, _, _, _, ing_id, amt, unit in drugs_data:
        existing_di = db.get(DrugIngredients, (d_id, ing_id, amt, unit))
        if not existing_di:
            db.add(DrugIngredients(drug_id=d_id, ingredient_id=ing_id, amount=amt, unit=unit))
    db.flush()

    # =========================================================================
    # PERSONA 1: patient.chronic@vitap.vn
    # =========================================================================
    chronic_email = "patient.chronic@vitap.vn"
    chronic_user = db.query(User).filter_by(email=chronic_email).first()
    if not chronic_user:
        chronic_user = User(
            id=deterministic_uuid("user.chronic"),
            email=chronic_email,
            password_hash=password_hash,
            role="USER",
            status="ACTIVE",
            email_verified_at=now_utc,
        )
        db.add(chronic_user)
        db.flush()

        db.add(
            UserProfile(
                id=deterministic_uuid("profile.chronic"),
                user_id=chronic_user.id,
                full_name="Nguyễn Văn An",
                date_of_birth=date(1971, 4, 12),
                biological_sex="MALE",
                phone="0912345678",
                height_cm=Decimal("168.0"),
            )
        )
        db.add(
            UserConsent(
                id=deterministic_uuid("consent.chronic"),
                user_id=chronic_user.id,
                consent_version="health-ai-v1",
                scope="HEALTH_DATA_AND_AI_PROCESSING",
                is_accepted=True,
            )
        )
        db.add(
            HealthConditions(
                id=deterministic_uuid("condition.chronic.e11"),
                user_id=chronic_user.id,
                condition_name="Đái tháo đường Type 2",
                icd10_code="E11",
                description="Đái tháo đường không phụ thuộc insulin, theo dõi định kỳ",
                diagnosed_at=date(2022, 6, 15),
                status="ACTIVE",
                verified=True,
            )
        )
        db.add(
            HealthConditions(
                id=deterministic_uuid("condition.chronic.i10"),
                user_id=chronic_user.id,
                condition_name="Tăng huyết áp vô căn",
                icd10_code="I10",
                description="Tăng huyết áp độ 1, kiểm soát bằng thuốc",
                diagnosed_at=date(2021, 3, 10),
                status="ACTIVE",
                verified=True,
            )
        )
        db.add(
            Allergies(
                id=deterministic_uuid("allergy.chronic.penicillin"),
                user_id=chronic_user.id,
                ingredient_id=ing_penicillin_id,
                allergen_name="Penicillin",
                reaction="Phát ban ngứa, mề đay toàn thân",
                severity="MODERATE",
                verified=True,
            )
        )

        # 30 days of health journal entries
        for day_offset in range(29, -1, -1):
            entry_date = today - timedelta(days=day_offset)
            entry_dt = datetime(entry_date.year, entry_date.month, entry_date.day, 7, 30, tzinfo=timezone.utc)
            entry_id = deterministic_uuid(f"entry.chronic.day{day_offset}")

            entry = HealthEntries(
                id=entry_id,
                user_id=chronic_user.id,
                title="Ghi chép sinh hiệu buổi sáng",
                content=f"Đo sau khi thức dậy lúc 7:00, cảm thấy bình thường ngày {entry_date.strftime('%d/%m/%Y')}.",
                entry_type="DAILY",
                recorded_at=entry_dt,
            )
            db.add(entry)
            db.flush()

            # Observations
            # BP
            sys_val = 128 + (day_offset % 9)
            dia_val = 82 + (day_offset % 6)
            db.add(
                HealthObservations(
                    id=deterministic_uuid(f"obs.bp.day{day_offset}"),
                    user_id=chronic_user.id,
                    entry_id=entry_id,
                    observation_type="BLOOD_PRESSURE",
                    value=Decimal(str(sys_val)),
                    secondary_value=Decimal(str(dia_val)),
                    unit="mmHg",
                    measured_at=entry_dt,
                )
            )
            # HR
            hr_val = 72 + (day_offset % 7)
            db.add(
                HealthObservations(
                    id=deterministic_uuid(f"obs.hr.day{day_offset}"),
                    user_id=chronic_user.id,
                    entry_id=entry_id,
                    observation_type="HEART_RATE",
                    value=Decimal(str(hr_val)),
                    unit="bpm",
                    measured_at=entry_dt,
                )
            )
            # Weight
            wt_val = 67.5 + round((day_offset % 5) * 0.15, 2)
            db.add(
                HealthObservations(
                    id=deterministic_uuid(f"obs.wt.day{day_offset}"),
                    user_id=chronic_user.id,
                    entry_id=entry_id,
                    observation_type="WEIGHT",
                    value=Decimal(str(wt_val)),
                    unit="kg",
                    measured_at=entry_dt,
                )
            )
            # Glucose
            glu_val = 6.2 + round((day_offset % 6) * 0.16, 2)
            db.add(
                HealthObservations(
                    id=deterministic_uuid(f"obs.glu.day{day_offset}"),
                    user_id=chronic_user.id,
                    entry_id=entry_id,
                    observation_type="GLUCOSE",
                    value=Decimal(str(glu_val)),
                    unit="mmol/L",
                    measured_at=entry_dt,
                )
            )
            # SpO2
            db.add(
                HealthObservations(
                    id=deterministic_uuid(f"obs.spo2.day{day_offset}"),
                    user_id=chronic_user.id,
                    entry_id=entry_id,
                    observation_type="SPO2",
                    value=Decimal("98.0"),
                    unit="%",
                    measured_at=entry_dt,
                )
            )

        # Prescription
        rx_chronic_id = deterministic_uuid("rx.chronic")
        db.add(
            Prescriptions(
                id=rx_chronic_id,
                user_id=chronic_user.id,
                prescription_date=today - timedelta(days=15),
                prescriber_name="BS. Nguyễn Trọng Nghĩa",
                healthcare_facility="Bệnh viện Chợ Rẫy",
                status="CONFIRMED",
                source_type="MANUAL_ENTRY",
                created_at=now_utc,
                updated_at=now_utc,
            )
        )
        db.flush()
        db.add(
            PrescriptionItems(
                id=deterministic_uuid("rxitem.chronic.metformin"),
                prescription_id=rx_chronic_id,
                drug_id=drug_met_id,
                extracted_name="Metformin",
                extracted_strength="500mg",
                frequency="2 lần/ngày",
                duration_days=30,
                instructions="Uống sau bữa ăn sáng và tối",
                resolution_status="MATCHED",
                verification_status="VERIFIED",
                source_type="MANUAL_ENTRY",
                created_at=now_utc,
                updated_at=now_utc,
            )
        )
        db.add(
            PrescriptionItems(
                id=deterministic_uuid("rxitem.chronic.amlodipine"),
                prescription_id=rx_chronic_id,
                drug_id=drug_amlo_id,
                extracted_name="Amlodipine",
                extracted_strength="5mg",
                frequency="1 lần/ngày",
                duration_days=30,
                instructions="Uống vào buổi sáng sau ăn",
                resolution_status="MATCHED",
                verification_status="VERIFIED",
                source_type="MANUAL_ENTRY",
                created_at=now_utc,
                updated_at=now_utc,
            )
        )
    created_user_ids[chronic_email] = str(chronic_user.id)

    # =========================================================================
    # PERSONA 2: patient.ddi@vitap.vn
    # =========================================================================
    ddi_email = "patient.ddi@vitap.vn"
    ddi_user = db.query(User).filter_by(email=ddi_email).first()
    if not ddi_user:
        ddi_user = User(
            id=deterministic_uuid("user.ddi"),
            email=ddi_email,
            password_hash=password_hash,
            role="USER",
            status="ACTIVE",
            email_verified_at=now_utc,
        )
        db.add(ddi_user)
        db.flush()

        db.add(
            UserProfile(
                id=deterministic_uuid("profile.ddi"),
                user_id=ddi_user.id,
                full_name="Trần Thị Bình",
                date_of_birth=date(1968, 8, 20),
                biological_sex="FEMALE",
                phone="0987654321",
                height_cm=Decimal("156.0"),
            )
        )
        db.add(
            UserConsent(
                id=deterministic_uuid("consent.ddi"),
                user_id=ddi_user.id,
                consent_version="health-ai-v1",
                scope="HEALTH_DATA_AND_AI_PROCESSING",
                is_accepted=True,
            )
        )
        db.add(
            HealthConditions(
                id=deterministic_uuid("condition.ddi.i25"),
                user_id=ddi_user.id,
                condition_name="Bệnh tim thiếu máu cục bộ mãn tính",
                icd10_code="I25",
                status="ACTIVE",
                verified=True,
                created_at=now_utc,
                updated_at=now_utc,
            )
        )
        db.add(
            HealthConditions(
                id=deterministic_uuid("condition.ddi.k21"),
                user_id=ddi_user.id,
                condition_name="Trào ngược dạ dày thực quản (GERD)",
                icd10_code="K21",
                status="ACTIVE",
                verified=True,
                created_at=now_utc,
                updated_at=now_utc,
            )
        )

        # Prescription containing Critical DDI: Clopidogrel + Omeprazole
        rx_ddi_id = deterministic_uuid("rx.ddi")
        db.add(
            Prescriptions(
                id=rx_ddi_id,
                user_id=ddi_user.id,
                prescription_date=today - timedelta(days=3),
                prescriber_name="BS. Lê Văn Cường",
                healthcare_facility="Bệnh viện Thống Nhất",
                status="CONFIRMED",
                source_type="MANUAL_ENTRY",
                created_at=now_utc,
                updated_at=now_utc,
            )
        )
        db.flush()
        db.add(
            PrescriptionItems(
                id=deterministic_uuid("rxitem.ddi.clopidogrel"),
                prescription_id=rx_ddi_id,
                drug_id=drug_clop_id,
                extracted_name="Clopidogrel",
                extracted_strength="75mg",
                frequency="1 lần/ngày",
                duration_days=30,
                instructions="Uống sau bữa ăn sáng",
                resolution_status="MATCHED",
                verification_status="VERIFIED",
                source_type="MANUAL_ENTRY",
                created_at=now_utc,
                updated_at=now_utc,
            )
        )
        db.add(
            PrescriptionItems(
                id=deterministic_uuid("rxitem.ddi.omeprazole"),
                prescription_id=rx_ddi_id,
                drug_id=drug_omep_id,
                extracted_name="Omeprazole",
                extracted_strength="20mg",
                frequency="1 lần/ngày",
                duration_days=30,
                instructions="Uống trước bữa ăn sáng 30 phút",
                resolution_status="MATCHED",
                verification_status="VERIFIED",
                source_type="MANUAL_ENTRY",
                created_at=now_utc,
                updated_at=now_utc,
            )
        )
    created_user_ids[ddi_email] = str(ddi_user.id)

    # =========================================================================
    # PERSONA 3: patient.empty@vitap.vn
    # =========================================================================
    empty_email = "patient.empty@vitap.vn"
    empty_user = db.query(User).filter_by(email=empty_email).first()
    if not empty_user:
        empty_user = User(
            id=deterministic_uuid("user.empty"),
            email=empty_email,
            password_hash=password_hash,
            role="USER",
            status="ACTIVE",
            email_verified_at=now_utc,
        )
        db.add(empty_user)
        db.flush()

        db.add(
            UserProfile(
                id=deterministic_uuid("profile.empty"),
                user_id=empty_user.id,
                full_name="Lê Hoàng Long",
                date_of_birth=date(1995, 11, 3),
                biological_sex="MALE",
                phone="0901122334",
                height_cm=Decimal("172.0"),
            )
        )
        db.add(
            UserConsent(
                id=deterministic_uuid("consent.empty"),
                user_id=empty_user.id,
                consent_version="health-ai-v1",
                scope="HEALTH_DATA_AND_AI_PROCESSING",
                is_accepted=True,
            )
        )
        # Intentionally zero conditions, zero entries, zero prescriptions
    created_user_ids[empty_email] = str(empty_user.id)

    db.commit()
    return created_user_ids

def generate_fixtures_dict() -> dict[str, Any]:
    """Generate the JSON fixtures dictionary structure for the frontend."""
    now = datetime(2026, 11, 14, 9, 15)

    def to_iso_local(dt: datetime) -> str:
        return dt.strftime("%Y-%m-%dT%H:%M")

    # Chronic Persona entries (30 days)
    chronic_entries = []
    for day in range(29, -1, -1):
        d = now - timedelta(days=day)
        at_morning = to_iso_local(datetime(d.year, d.month, d.day, 7, 30))
        sys_bp = 128 + (day % 9)
        dia_bp = 82 + (day % 6)
        hr_val = 72 + (day % 7)
        wt_val = round(67.5 + (day % 5) * 0.15, 1)
        glu_mmol = round(6.2 + (day % 6) * 0.16, 1)

        chronic_entries.append({
            "id": f"e-chronic-{day}",
            "at": at_morning,
            "bp": [sys_bp, dia_bp],
            "hr": hr_val,
            "wt": wt_val,
            "glu": {
                "mmol": glu_mmol,
                "entered": {"v": glu_mmol, "unit": "mmol/L"}
            },
            "note": "Đo buổi sáng trước khi ăn sáng." if day % 5 == 0 else ""
        })

    chronic_prescriptions = [
        {
            "id": "rx-chronic-01",
            "date": (now - timedelta(days=15)).strftime("%Y-%m-%d"),
            "place": "Bệnh viện Chợ Rẫy",
            "scenario": "resultNoKnown",
            "drugs": [
                {"name": "Metformin", "strength": "500mg", "freq": "2 lần/ngày sau ăn"},
                {"name": "Amlodipine", "strength": "5mg", "freq": "1 lần/ngày sáng"}
            ]
        }
    ]

    ddi_prescriptions = [
        {
            "id": "rx-ddi-01",
            "date": (now - timedelta(days=3)).strftime("%Y-%m-%d"),
            "place": "Bệnh viện Thống Nhất",
            "scenario": "resultSevere",
            "drugs": [
                {"name": "Clopidogrel", "strength": "75mg", "freq": "1 lần/ngày sáng"},
                {"name": "Omeprazole", "strength": "20mg", "freq": "1 lần/ngày trước ăn"}
            ]
        }
    ]

    return {
        "patient.chronic@vitap.vn": {
            "profile": {
                "fullName": "Nguyễn Văn An",
                "dob": "1971-04-12",
                "gender": "Nam",
                "phone": "0912345678",
                "conditions": ["Đái tháo đường Type 2 (E11)", "Tăng huyết áp vô căn (I10)"],
                "allergies": ["Penicillin (Phát ban, mề đay)"]
            },
            "entries": chronic_entries,
            "prescriptions": chronic_prescriptions
        },
        "patient.ddi@vitap.vn": {
            "profile": {
                "fullName": "Trần Thị Bình",
                "dob": "1968-08-20",
                "gender": "Nữ",
                "phone": "0987654321",
                "conditions": ["Bệnh tim thiếu máu cục bộ (I25)", "Trào ngược dạ dày (K21)"],
                "allergies": []
            },
            "entries": [
                {
                    "id": "e-ddi-01",
                    "at": to_iso_local(now - timedelta(days=1)),
                    "bp": [135, 85],
                    "hr": 80,
                    "wt": 58.0,
                    "note": "Hơi đau rát thượng vị sau bữa ăn"
                }
            ],
            "prescriptions": ddi_prescriptions
        },
        "patient.empty@vitap.vn": {
            "profile": {
                "fullName": "Lê Hoàng Long",
                "dob": "1995-11-03",
                "gender": "Nam",
                "phone": "0901122334",
                "conditions": [],
                "allergies": []
            },
            "entries": [],
            "prescriptions": []
        }
    }

def export_fixtures_to_file(filepath: str) -> None:
    fixtures = generate_fixtures_dict()
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(fixtures, f, ensure_ascii=False, indent=2)
    print(f"Successfully exported frontend fixtures to {filepath}")

def main():
    parser = argparse.ArgumentParser(description="VitaP Test Persona Seeder")
    parser.add_argument("--export-fixtures", type=str, help="Path to export frontend fixtures JSON file")
    args = parser.parse_args()

    if args.export_fixtures:
        export_fixtures_to_file(args.export_fixtures)

    # If database engine is connected, run seed
    try:
        with Session(engine) as db:
            user_ids = seed_test_scenarios(db)
            print(f"Successfully seeded {len(user_ids)} test personas into database: {list(user_ids.keys())}")
    except Exception as e:
        print(f"Database seed note: Could not connect to Postgres database ({e}). Fixtures export completed.")

if __name__ == "__main__":
    main()
