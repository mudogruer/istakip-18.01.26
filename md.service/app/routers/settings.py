"""
Ayarlar Router

Sistem ayarları ve iş kolu yapılandırması yönetimi.
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..data_loader import load_json, save_json

router = APIRouter(prefix="/settings", tags=["settings"])


# ========== Models ==========

class GeneralSetting(BaseModel):
    label: str
    value: bool
    description: str | None = None


class JobRoleConfig(BaseModel):
    name: str
    description: str | None = None
    productionType: str = "internal"  # internal | external
    requiresGlass: bool = False
    defaultGlassSupplier: str | None = None
    defaultSupplier: str | None = None  # Dış sipariş için
    estimatedDays: int = 5
    active: bool = True


class GlassType(BaseModel):
    name: str
    code: str


# ========== Helpers ==========

def _gen_id(prefix: str) -> str:
    return f"{prefix}-{str(uuid.uuid4())[:8].upper()}"


def _get_settings():
    """Settings dosyasını oku, eski format ise migrate et"""
    data = load_json("settings.json")
    
    # Eski format kontrolü (array ise)
    if isinstance(data, list):
        # Migrate to new format
        data = {
            "general": data,
            "jobRoles": [],
            "glassTypes": [],
            "combinationTypes": []
        }
        save_json("settings.json", data)
    
    return data


# ========== General Settings ==========

@router.get("/")
def list_settings():
    """Tüm ayarları getir"""
    return _get_settings()


@router.get("/general")
def get_general_settings():
    """Genel ayarları getir"""
    settings = _get_settings()
    return settings.get("general", [])


@router.put("/general/{setting_id}")
def update_general_setting(setting_id: str, payload: GeneralSetting):
    """Genel ayar güncelle"""
    settings = _get_settings()
    general = settings.get("general", [])
    
    for idx, setting in enumerate(general):
        if setting.get("id") == setting_id:
            setting["label"] = payload.label
            setting["value"] = payload.value
            setting["description"] = payload.description
            general[idx] = setting
            settings["general"] = general
            save_json("settings.json", settings)
            return setting
    
    raise HTTPException(status_code=404, detail="Ayar bulunamadı")


# ========== Job Roles ==========

@router.get("/job-roles")
def get_job_roles(active_only: bool = False):
    """İş kollarını getir"""
    settings = _get_settings()
    roles = settings.get("jobRoles", [])
    
    if active_only:
        roles = [r for r in roles if r.get("active", True)]
    
    return roles


@router.get("/job-roles/{role_id}")
def get_job_role(role_id: str):
    """Tek bir iş kolunu getir"""
    settings = _get_settings()
    roles = settings.get("jobRoles", [])
    
    role = next((r for r in roles if r.get("id") == role_id), None)
    if not role:
        raise HTTPException(status_code=404, detail="İş kolu bulunamadı")
    
    return role


@router.post("/job-roles", status_code=201)
def create_job_role(payload: JobRoleConfig):
    """Yeni iş kolu oluştur"""
    settings = _get_settings()
    roles = settings.get("jobRoles", [])
    
    new_role = {
        "id": _gen_id("ROLE"),
        "name": payload.name,
        "description": payload.description,
        "productionType": payload.productionType,
        "requiresGlass": payload.requiresGlass,
        "defaultGlassSupplier": payload.defaultGlassSupplier,
        "defaultSupplier": payload.defaultSupplier,
        "estimatedDays": payload.estimatedDays,
        "active": payload.active,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    roles.append(new_role)
    settings["jobRoles"] = roles
    save_json("settings.json", settings)
    
    return new_role


@router.put("/job-roles/{role_id}")
def update_job_role(role_id: str, payload: JobRoleConfig):
    """İş kolunu güncelle"""
    settings = _get_settings()
    roles = settings.get("jobRoles", [])
    
    for idx, role in enumerate(roles):
        if role.get("id") == role_id:
            role["name"] = payload.name
            role["description"] = payload.description
            role["productionType"] = payload.productionType
            role["requiresGlass"] = payload.requiresGlass
            role["defaultGlassSupplier"] = payload.defaultGlassSupplier
            role["defaultSupplier"] = payload.defaultSupplier
            role["estimatedDays"] = payload.estimatedDays
            role["active"] = payload.active
            role["updatedAt"] = datetime.utcnow().isoformat()
            
            roles[idx] = role
            settings["jobRoles"] = roles
            save_json("settings.json", settings)
            return role
    
    raise HTTPException(status_code=404, detail="İş kolu bulunamadı")


@router.delete("/job-roles/{role_id}")
def delete_job_role(role_id: str):
    """İş kolunu sil (soft delete - inactive yap)"""
    settings = _get_settings()
    roles = settings.get("jobRoles", [])
    
    for idx, role in enumerate(roles):
        if role.get("id") == role_id:
            role["active"] = False
            role["deletedAt"] = datetime.utcnow().isoformat()
            roles[idx] = role
            settings["jobRoles"] = roles
            save_json("settings.json", settings)
            return {"success": True, "id": role_id}
    
    raise HTTPException(status_code=404, detail="İş kolu bulunamadı")


# ========== Glass Types ==========

@router.get("/glass-types")
def get_glass_types():
    """Cam tiplerini getir"""
    settings = _get_settings()
    return settings.get("glassTypes", [])


@router.post("/glass-types", status_code=201)
def create_glass_type(payload: GlassType):
    """Yeni cam tipi ekle"""
    settings = _get_settings()
    glass_types = settings.get("glassTypes", [])
    
    new_glass = {
        "id": _gen_id("GLASS"),
        "name": payload.name,
        "code": payload.code
    }
    
    glass_types.append(new_glass)
    settings["glassTypes"] = glass_types
    save_json("settings.json", settings)
    
    return new_glass


@router.put("/glass-types/{glass_id}")
def update_glass_type(glass_id: str, payload: GlassType):
    """Cam tipini güncelle"""
    settings = _get_settings()
    glass_types = settings.get("glassTypes", [])
    
    for idx, glass in enumerate(glass_types):
        if glass.get("id") == glass_id:
            glass["name"] = payload.name
            glass["code"] = payload.code
            glass_types[idx] = glass
            settings["glassTypes"] = glass_types
            save_json("settings.json", settings)
            return glass
    
    raise HTTPException(status_code=404, detail="Cam tipi bulunamadı")


@router.delete("/glass-types/{glass_id}")
def delete_glass_type(glass_id: str):
    """Cam tipini sil"""
    settings = _get_settings()
    glass_types = settings.get("glassTypes", [])
    glass_types = [g for g in glass_types if g.get("id") != glass_id]
    settings["glassTypes"] = glass_types
    save_json("settings.json", settings)
    return {"success": True, "id": glass_id}


# ========== Combination Types ==========

@router.get("/combination-types")
def get_combination_types():
    """Kombinasyon tiplerini getir (autocomplete için)"""
    settings = _get_settings()
    return settings.get("combinationTypes", [])


@router.post("/combination-types", status_code=201)
def add_combination_type(name: str):
    """Yeni kombinasyon tipi ekle"""
    settings = _get_settings()
    combinations = settings.get("combinationTypes", [])
    
    # Zaten varsa ekleme
    if any(c.get("name", "").lower() == name.lower() for c in combinations):
        return {"message": "Zaten mevcut"}
    
    new_comb = {
        "id": _gen_id("COMB"),
        "name": name,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    combinations.append(new_comb)
    settings["combinationTypes"] = combinations
    save_json("settings.json", settings)
    
    return new_comb
