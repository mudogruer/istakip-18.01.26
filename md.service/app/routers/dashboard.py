from fastapi import APIRouter

from ..data_loader import load_json

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def dashboard_summary():
  data = load_json("dashboard.json")
  return data

