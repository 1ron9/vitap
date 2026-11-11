from sqlalchemy import Column, Integer, String, Text, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import declarative_base
Base = declarative_base()

class ActiveIngredient(Base):
    __tablename__ = "active_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    inn_name = Column(String(255), unique=True, nullable=False, index=True)
    atc_code = Column(String(10), nullable=True)
    drug_class = Column(String(100), nullable=True)

class BrandName(Base):
    __tablename__ = "brand_names"

    id = Column(Integer, primary_key=True, index=True)
    brand_name = Column(String(255), nullable=False, index=True)
    manufacturer = Column(String(255), nullable=True)
    dosage_form = Column(String(50), nullable=True)

class DrugIngredient(Base):
    __tablename__ = "legacy_drug_ingredients"

    brand_id = Column(Integer, ForeignKey("brand_names.id", ondelete="CASCADE"), primary_key=True)
    ingredient_id = Column(Integer, ForeignKey("active_ingredients.id", ondelete="RESTRICT"), primary_key=True)
    strength = Column(String(50), nullable=True)

class Condition(Base):
    __tablename__ = "conditions"

    id = Column(Integer, primary_key=True, index=True)
    icd10_code = Column(String(10), unique=True, nullable=False, index=True)
    condition_name = Column(String(255), nullable=False)

class DrugDrugInteraction(Base):
    __tablename__ = "drug_drug_interactions"

    id = Column(Integer, primary_key=True, index=True)
    ingredient_a_id = Column(Integer, ForeignKey("active_ingredients.id"), nullable=False)
    ingredient_b_id = Column(Integer, ForeignKey("active_ingredients.id"), nullable=False)
    severity = Column(String(10), nullable=False)  # RED, YELLOW, GREEN
    mechanism = Column(Text, nullable=False)
    clinical_management = Column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint("ingredient_a_id < ingredient_b_id", name="check_symmetric_order"),
        UniqueConstraint("ingredient_a_id", "ingredient_b_id", name="unique_pair_constraint"),
    )

class DrugConditionInteraction(Base):
    __tablename__ = "drug_condition_interactions"

    id = Column(Integer, primary_key=True, index=True)
    ingredient_id = Column(Integer, ForeignKey("active_ingredients.id"), nullable=False)
    condition_id = Column(Integer, ForeignKey("conditions.id"), nullable=False)
    severity = Column(String(10), nullable=False)  # RED, YELLOW
    contraindication_type = Column(String(20), default="ABSOLUTE")  # ABSOLUTE, RELATIVE
    clinical_advice = Column(Text, nullable=False)

    __table_args__ = (
        UniqueConstraint("ingredient_id", "condition_id", name="unique_ingredient_condition"),
    )
