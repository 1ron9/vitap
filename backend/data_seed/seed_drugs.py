"""
Script nạp dữ liệu mẫu ban đầu (Seed Data) cho VitaP.
Bao gồm:
- Toàn bộ Danh mục Biệt dược & Hoạt chất từ raw/drugs_vietnam.json (>200 thuốc)
- Bệnh nền phổ biến từ raw/conditions.json (ICD-10 Conditions)
- Các cặp tương tác Thuốc - Thuốc (DDI) chuẩn hóa: Canonical Pair (id_a < id_b) từ raw/ddi_rules.json
- Các quy tắc tương tác Thuốc - Bệnh nền / Thai kỳ (DCI)

Hỗ trợ chạy tự động trên cả SQLite (local dev) và Supabase (PostgreSQL Cloud).
Cách chạy:
  cd 0_medicare/backend
  .venv/bin/python data_seed/seed_drugs.py
"""

import sys
import os
import json

# Thêm thư mục backend vào sys.path để import được app
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, ".."))
sys.path.insert(0, backend_dir)

from sqlalchemy.orm import Session
from app.core.database import Base, engine, SessionLocal
from app.models.drug_models import (
    ActiveIngredient,
    BrandName,
    DrugIngredient,
    Condition,
    DrugDrugInteraction,
    DrugConditionInteraction
)

# Đường dẫn tới thư mục chứa các file JSON
RAW_DIR = os.path.join(current_dir, "raw")

def run_seed():
    print("🚀 Bắt đầu quá trình nạp dữ liệu chuẩn hóa (Seed Data) cho VitaP...")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # ======================================================================
        # 1. BẢNG BỆNH NỀN (CONDITIONS / ICD-10)
        # ======================================================================
        conditions_file = os.path.join(RAW_DIR, "conditions.json")
        condition_map = {}
        if os.path.exists(conditions_file):
            with open(conditions_file, "r", encoding="utf-8") as f:
                conditions_data = json.load(f)
            for c in conditions_data:
                existing = db.query(Condition).filter(Condition.icd10_code == c["icd10_code"]).first()
                if not existing:
                    cond = Condition(icd10_code=c["icd10_code"], condition_name=c["condition_name"])
                    db.add(cond)
                    db.flush()
                    condition_map[c["icd10_code"]] = cond.id
                else:
                    condition_map[c["icd10_code"]] = existing.id
            print(f"✅ Đã đồng bộ {len(condition_map)} bệnh nền ICD-10.")

        # ======================================================================
        # 2. BẢNG BIỆT DƯỢC & HOẠT CHẤT (TỪ drugs_vietnam.json)
        # ======================================================================
        drugs_file = os.path.join(RAW_DIR, "drugs_vietnam.json")
        ingredient_map = {}
        total_brands = 0

        # Lấy trước các hoạt chất đã có trong DB vào map
        for ing in db.query(ActiveIngredient).all():
            ingredient_map[ing.inn_name] = ing.id

        if os.path.exists(drugs_file):
            with open(drugs_file, "r", encoding="utf-8") as f:
                drugs_data = json.load(f)
            print(f"📄 Đang nạp {len(drugs_data)} loại biệt dược từ {os.path.basename(drugs_file)}...")

            for item in drugs_data:
                b_name = item.get("brand_name")
                manufacturer = item.get("manufacturer")
                dosage_form = item.get("dosage_form")

                # Tìm hoặc thêm mới BrandName
                existing_b = db.query(BrandName).filter(BrandName.brand_name == b_name).first()
                if not existing_b:
                    brand = BrandName(
                        brand_name=b_name,
                        manufacturer=manufacturer,
                        dosage_form=dosage_form
                    )
                    db.add(brand)
                    db.flush()
                    brand_id = brand.id
                else:
                    brand_id = existing_b.id

                total_brands += 1

                # Duyệt danh sách hoạt chất của biệt dược
                for ing_info in item.get("ingredients", []):
                    inn_name = ing_info.get("inn_name")
                    strength = ing_info.get("strength")
                    atc_code = ing_info.get("atc_code")
                    drug_class = ing_info.get("drug_class")

                    if not inn_name:
                        continue

                    # Nếu hoạt chất chưa có trong DB, thêm mới
                    if inn_name not in ingredient_map:
                        existing_ing = db.query(ActiveIngredient).filter(ActiveIngredient.inn_name == inn_name).first()
                        if not existing_ing:
                            new_ing = ActiveIngredient(
                                inn_name=inn_name,
                                atc_code=atc_code,
                                drug_class=drug_class
                            )
                            db.add(new_ing)
                            db.flush()
                            ingredient_map[inn_name] = new_ing.id
                        else:
                            ingredient_map[inn_name] = existing_ing.id

                    ing_id = ingredient_map[inn_name]

                    # Liên kết Biệt dược - Hoạt chất trong DrugIngredient
                    existing_link = db.query(DrugIngredient).filter(
                        DrugIngredient.brand_id == brand_id,
                        DrugIngredient.ingredient_id == ing_id
                    ).first()
                    if not existing_link:
                        link = DrugIngredient(
                            brand_id=brand_id,
                            ingredient_id=ing_id,
                            strength=strength
                        )
                        db.add(link)

            print(f"✅ Đã nạp thành công {total_brands} biệt dược và {len(ingredient_map)} hoạt chất chuẩn hóa.")

        # ======================================================================
        # 3. BẢNG TƯƠNG TÁC THUỐC - THUỐC (DDI) TỪ ddi_rules.json
        # ======================================================================
        ddi_file = os.path.join(RAW_DIR, "ddi_rules.json")
        total_ddi = 0
        if os.path.exists(ddi_file):
            with open(ddi_file, "r", encoding="utf-8") as f:
                ddi_data = json.load(f)

            for rule in ddi_data:
                ing_a = rule.get("ingredient_a")
                ing_b = rule.get("ingredient_b")
                severity = rule.get("severity")
                mechanism = rule.get("mechanism")
                advice = rule.get("clinical_management")

                if ing_a in ingredient_map and ing_b in ingredient_map:
                    id1 = ingredient_map[ing_a]
                    id2 = ingredient_map[ing_b]
                    # Canonical pair invariant: ID_A < ID_B
                    a_id = min(id1, id2)
                    b_id = max(id1, id2)

                    existing_ddi = db.query(DrugDrugInteraction).filter(
                        DrugDrugInteraction.ingredient_a_id == a_id,
                        DrugDrugInteraction.ingredient_b_id == b_id
                    ).first()

                    if not existing_ddi:
                        ddi = DrugDrugInteraction(
                            ingredient_a_id=a_id,
                            ingredient_b_id=b_id,
                            severity=severity,
                            mechanism=mechanism,
                            clinical_management=advice
                        )
                        db.add(ddi)
                        total_ddi += 1

            print(f"✅ Đã nạp {total_ddi} cặp tương tác Thuốc - Thuốc (DDI) chuẩn hóa từ ddi_rules.json.")

        # ======================================================================
        # 4. BẢNG TƯƠNG TÁC THUỐC - BỆNH NỀN / THAI KỲ (DCI)
        # ======================================================================
        raw_dci = [
            ("Ibuprofen", "K25", "RED", "ABSOLUTE", "Ibuprofen ức chế COX-1 bảo vệ niêm mạc, gây tái phát loét và xuất huyết tiêu hóa ồ ạt."),
            ("Aspirin", "K25", "RED", "ABSOLUTE", "Tuyệt đối chống chỉ định trên người có tiền sử loét hoặc đang xuất huyết dạ dày."),
            ("Metformin", "N18", "RED", "ABSOLUTE", "Nguy cơ tích lũy thuốc gây nhiễm toan lactic tử vong cao trên bệnh nhân suy thận nặng."),
            ("Enalapril", "Z33", "RED", "ABSOLUTE", "Thuốc ức chế men chuyển gây độc tính nghiêm trọng trên thai nhi và gây quái thai."),
            ("Aspirin", "Z33", "RED", "ABSOLUTE", "Dùng trong 3 tháng cuối thai kỳ có thể gây đóng sớm ống động mạch và kéo dài chuyển dạ."),
            ("Ibuprofen", "J45", "RED", "RELATIVE", "Có thể kích hoạt cơn co thắt phế quản cấp tính nặng ở bệnh nhân hen suyễn nhạy cảm với aspirin."),
            ("Amlodipine", "K70", "YELLOW", "RELATIVE", "Chuyển hóa qua gan chậm, cần giảm liều ở người suy giảm chức năng gan."),
        ]

        total_dci = 0
        for ing_name, icd_code, severity, c_type, advice in raw_dci:
            if ing_name in ingredient_map and icd_code in condition_map:
                ing_id = ingredient_map[ing_name]
                cond_id = condition_map[icd_code]

                existing_dci = db.query(DrugConditionInteraction).filter(
                    DrugConditionInteraction.ingredient_id == ing_id,
                    DrugConditionInteraction.condition_id == cond_id
                ).first()

                if not existing_dci:
                    dci = DrugConditionInteraction(
                        ingredient_id=ing_id,
                        condition_id=cond_id,
                        severity=severity,
                        contraindication_type=c_type,
                        clinical_advice=advice
                    )
                    db.add(dci)
                    total_dci += 1

        print(f"✅ Đã nạp {total_dci} quy tắc tương tác Thuốc - Bệnh nền / Thai kỳ (DCI).")

        db.commit()
        print("🎉 QUÁ TRÌNH NẠP SEED DATA THÀNH CÔNG RỰC RỠ 100%!")

    except Exception as e:
        db.rollback()
        print(f"❌ Lỗi khi nạp dữ liệu: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    raise SystemExit("Legacy dataset loader disabled. Use python -m data_seed.seed_dev after Alembic; port reviewed datasets to the UUID schema.")
