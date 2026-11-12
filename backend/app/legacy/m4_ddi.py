from fastapi import APIRouter, Query
from typing import List
router = APIRouter()

@router.get("/check")
def check_interactions(drug_ids: List[int] = Query(...)):
    return {
        "status": "RED",
        "has_interaction": True,
        "warnings": ["Aspirin + Ibuprofen: Tăng nguy cơ loét dạ dày xuất huyết"]
    }
