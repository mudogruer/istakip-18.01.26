import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, EmailStr

from ..data_loader import load_json, save_json

router = APIRouter(prefix="/personnel", tags=["personnel"])


class PersonnelIn(BaseModel):
  ad: str = Field(..., min_length=1, description="Personel adı")
  soyad: str = Field(..., min_length=1, description="Personel soyadı")
  email: EmailStr = Field(..., description="E-posta adresi (unique)")
  telefon: str = Field("", description="Telefon numarası")
  unvan: str = Field("", description="Ünvan/paylaşım")
  aktifMi: bool = Field(True, description="Aktif durumu")
  rolId: str = Field("", description="Rol ID (opsiyonel)")


@router.get("/")
def list_personnel(aktifMi: bool = None):
  personnel = load_json("personnel.json")
  if aktifMi is not None:
    personnel = [p for p in personnel if p.get("aktifMi") == aktifMi]
  return personnel


@router.get("/{personnel_id}")
def get_personnel(personnel_id: str):
  personnel = load_json("personnel.json")
  for p in personnel:
    if p.get("id") == personnel_id:
      return p
  raise HTTPException(status_code=404, detail="Personel bulunamadı")


@router.post("/", status_code=201)
def create_personnel(payload: PersonnelIn):
  personnel = load_json("personnel.json")
  
  # Email unique kontrolü
  existing_emails = {p.get("email") for p in personnel if p.get("email") and not p.get("deleted")}
  if payload.email in existing_emails:
    raise HTTPException(status_code=409, detail=f"Bu e-posta adresi zaten kullanılıyor: {payload.email}")
  
  new_id = f"PER-{str(uuid.uuid4())[:8].upper()}"
  now = datetime.now().isoformat()
  
  new_item = {
    "id": new_id,
    "ad": payload.ad,
    "soyad": payload.soyad,
    "email": payload.email,
    "telefon": payload.telefon,
    "unvan": payload.unvan,
    "aktifMi": payload.aktifMi,
    "rolId": payload.rolId,
    "createdAt": now,
    "updatedAt": now,
    "deleted": False,
  }
  personnel.append(new_item)
  save_json("personnel.json", personnel)
  return new_item


@router.put("/{personnel_id}")
def update_personnel(personnel_id: str, payload: PersonnelIn):
  personnel = load_json("personnel.json")
  
  # Email unique kontrolü (kendisi hariç)
  existing_emails = {p.get("email") for p in personnel if p.get("email") and p.get("id") != personnel_id and not p.get("deleted")}
  if payload.email in existing_emails:
    raise HTTPException(status_code=409, detail=f"Bu e-posta adresi zaten kullanılıyor: {payload.email}")
  
  for idx, item in enumerate(personnel):
    if item.get("id") == personnel_id:
      personnel[idx] = {
        **item,
        "ad": payload.ad,
        "soyad": payload.soyad,
        "email": payload.email,
        "telefon": payload.telefon,
        "unvan": payload.unvan,
        "aktifMi": payload.aktifMi,
        "rolId": payload.rolId,
        "updatedAt": datetime.now().isoformat(),
      }
      save_json("personnel.json", personnel)
      return personnel[idx]
  raise HTTPException(status_code=404, detail="Personel bulunamadı")


@router.patch("/{personnel_id}/aktif")
def toggle_personnel_status(personnel_id: str, aktifMi: bool):
  personnel = load_json("personnel.json")
  for idx, item in enumerate(personnel):
    if item.get("id") == personnel_id:
      personnel[idx] = {
        **item,
        "aktifMi": aktifMi,
        "updatedAt": datetime.now().isoformat(),
      }
      save_json("personnel.json", personnel)
      return personnel[idx]
  raise HTTPException(status_code=404, detail="Personel bulunamadı")


@router.delete("/{personnel_id}")
def soft_delete_personnel(personnel_id: str):
  personnel = load_json("personnel.json")
  for idx, item in enumerate(personnel):
    if item.get("id") == personnel_id:
      personnel[idx] = {
        **item,
        "deleted": True,
        "aktifMi": False,
        "updatedAt": datetime.now().isoformat(),
      }
      save_json("personnel.json", personnel)
      return {"id": personnel_id, "deleted": True}
  raise HTTPException(status_code=404, detail="Personel bulunamadı")


@router.post("/{personnel_id}/rol")
def assign_role(personnel_id: str, rolId: str):
  personnel = load_json("personnel.json")
  roles = load_json("roles.json")
  
  # Rol var mı kontrol et
  role_exists = any(r.get("id") == rolId for r in roles if not r.get("deleted"))
  if not role_exists:
    raise HTTPException(status_code=404, detail="Rol bulunamadı")
  
  for idx, item in enumerate(personnel):
    if item.get("id") == personnel_id:
      personnel[idx] = {
        **item,
        "rolId": rolId,
        "updatedAt": datetime.now().isoformat(),
      }
      save_json("personnel.json", personnel)
      return personnel[idx]
  raise HTTPException(status_code=404, detail="Personel bulunamadı")
