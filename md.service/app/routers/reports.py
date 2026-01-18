from fastapi import APIRouter

from ..data_loader import load_json

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/")
def list_reports():
  return load_json("reports.json")

