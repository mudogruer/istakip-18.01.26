"""
Authentication endpoint: /me
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
from ..auth import get_current_user, UserContext
from ..data_loader import load_json

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
def get_me(current_user: Optional[UserContext] = Depends(get_current_user)):
  """
  Aktif kullanıcı bilgilerini döndür.
  Header: X-User-Id
  AUTH_MODE="prod": Header zorunlu, yoksa 401.
  AUTH_MODE="dev": Header opsiyonel, yoksa authenticated=false döner.
  """
  if not current_user:
    # Dev modu: kullanıcı yoksa authenticated=false döndür
    return {
      "user": None,
      "role": None,
      "permissions": [],
      "authenticated": False,
    }
  
  return {
    "user": {
      "id": current_user.user_id,
      "ad": current_user.personnel.get("ad"),
      "soyad": current_user.personnel.get("soyad"),
      "email": current_user.personnel.get("email"),
      "unvan": current_user.personnel.get("unvan"),
      "aktifMi": current_user.personnel.get("aktifMi"),
    },
    "role": {
      "id": current_user.role.get("id") if current_user.role else None,
      "ad": current_user.role.get("ad") if current_user.role else None,
      "aciklama": current_user.role.get("aciklama") if current_user.role else None,
    },
    "permissions": current_user.permissions,
    "authenticated": True,
  }
