import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from ..data_loader import load_json, save_json

router = APIRouter(prefix="/roles", tags=["roles"])


class RoleIn(BaseModel):
  ad: str = Field(..., min_length=1, description="Rol adı")
  aciklama: str = Field("", description="Rol açıklaması")
  permissions: List[str] = Field(default_factory=list, description="İzin listesi")
  aktifMi: bool = Field(True, description="Aktif durumu")


@router.get("/")
def list_roles(aktifMi: bool = None):
  roles = load_json("roles.json")
  if aktifMi is not None:
    roles = [r for r in roles if r.get("aktifMi") == aktifMi]
  return roles


@router.get("/{role_id}")
def get_role(role_id: str):
  roles = load_json("roles.json")
  for r in roles:
    if r.get("id") == role_id:
      return r
  raise HTTPException(status_code=404, detail="Rol bulunamadı")


@router.post("/", status_code=201)
def create_role(payload: RoleIn):
  roles = load_json("roles.json")
  
  # Ad unique kontrolü
  existing_names = {r.get("ad") for r in roles if r.get("ad") and not r.get("deleted")}
  if payload.ad in existing_names:
    raise HTTPException(status_code=400, detail=f"Bu rol adı zaten kullanılıyor: {payload.ad}")
  
  new_id = f"ROL-{str(uuid.uuid4())[:8].upper()}"
  now = datetime.now().isoformat()
  
  new_item = {
    "id": new_id,
    "ad": payload.ad,
    "aciklama": payload.aciklama,
    "permissions": payload.permissions,
    "aktifMi": payload.aktifMi,
    "createdAt": now,
    "updatedAt": now,
    "deleted": False,
  }
  roles.append(new_item)
  save_json("roles.json", roles)
  return new_item


@router.put("/{role_id}")
def update_role(role_id: str, payload: RoleIn):
  roles = load_json("roles.json")
  
  # Ad unique kontrolü (kendisi hariç)
  existing_names = {r.get("ad") for r in roles if r.get("ad") and r.get("id") != role_id and not r.get("deleted")}
  if payload.ad in existing_names:
    raise HTTPException(status_code=400, detail=f"Bu rol adı zaten kullanılıyor: {payload.ad}")
  
  for idx, item in enumerate(roles):
    if item.get("id") == role_id:
      roles[idx] = {
        **item,
        "ad": payload.ad,
        "aciklama": payload.aciklama,
        "permissions": payload.permissions,
        "aktifMi": payload.aktifMi,
        "updatedAt": datetime.now().isoformat(),
      }
      save_json("roles.json", roles)
      return roles[idx]
  raise HTTPException(status_code=404, detail="Rol bulunamadı")


@router.delete("/{role_id}")
def soft_delete_role(role_id: str):
  roles = load_json("roles.json")
  for idx, item in enumerate(roles):
    if item.get("id") == role_id:
      roles[idx] = {
        **item,
        "deleted": True,
        "aktifMi": False,
        "updatedAt": datetime.now().isoformat(),
      }
      save_json("roles.json", roles)
      return {"id": role_id, "deleted": True}
  raise HTTPException(status_code=404, detail="Rol bulunamadı")
