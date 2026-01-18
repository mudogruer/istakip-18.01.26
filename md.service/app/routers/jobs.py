from copy import deepcopy
from datetime import datetime
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..data_loader import load_json, save_json

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _now_iso() -> str:
  return datetime.utcnow().isoformat()


def _jobs():
  return load_json("jobs.json")


def _save_jobs(data):
  save_json("jobs.json", data)


class JobCreate(BaseModel):
  customerId: str
  customerName: str
  title: str
  startType: str = Field(..., pattern="^(OLCU|MUSTERI_OLCUSU|SERVIS|ARSIV)$")
  roles: list = []
  serviceNote: str | None = None
  serviceFixedFee: float | None = None
  # Arşiv kaydı için
  isArchive: bool = False
  archiveDate: str | None = None
  archiveCompletedDate: str | None = None
  archiveTotalAmount: float | None = None
  archiveNote: str | None = None


class MeasureUpdate(BaseModel):
  measurements: dict | None = None
  appointment: dict | None = None
  service: dict | None = None  # Servis işleri için
  status: str | None = None  # Opsiyonel statü güncellemesi


class OfferUpdate(BaseModel):
  lines: list
  total: float
  status: str = "TEKLIF_TASLAK"


class ApprovalStart(BaseModel):
  paymentPlan: dict
  contractUrl: str | None = None
  stockNeeds: list = []


class StockItem(BaseModel):
  id: str
  name: str
  productCode: str | None = None
  colorCode: str | None = None
  qty: int
  unit: str | None = None

class StockStatus(BaseModel):
  ready: bool
  purchaseNotes: str | None = None
  items: list[StockItem] | None = None
  estimatedDate: str | None = None  # Tahmini hazır olma tarihi (Sonra Üret için)


class ProductionStatus(BaseModel):
  status: str = Field(..., pattern="^(URETIMDE|MONTAJA_HAZIR|ANLASMADA)$")
  note: str | None = None
  agreementDate: str | None = None


class AssemblySchedule(BaseModel):
  date: str
  note: str | None = None
  team: str | None = None


class AssemblyComplete(BaseModel):
  date: str | None = None
  note: str | None = None
  team: str | None = None
  completed: bool = True
  proof: dict | None = None


class FinanceClose(BaseModel):
  total: float
  payments: dict
  discount: dict | None = None  # {"amount": float, "note": str}


class StatusUpdate(BaseModel):
  status: str
  service: dict | None = None  # Servis işleri için ek bilgiler
  offer: dict | None = None  # Fiyat/teklif bilgileri
  rejection: dict | None = None  # Ret bilgileri


def _find_job(job_id: str):
  data = _jobs()
  for idx, job in enumerate(data):
    if job.get("id") == job_id:
      return data, idx, job
  raise HTTPException(status_code=404, detail="Job not found")


def _log(job: dict, action: str, note: str | None = None):
  logs = job.get("logs", [])
  logs.append({"at": _now_iso(), "action": action, "note": note})
  job["logs"] = logs


@router.get("/")
def list_jobs():
  return _jobs()


@router.get("/{job_id}")
def get_job(job_id: str):
  for job in _jobs():
    if job.get("id") == job_id:
      return job
  raise HTTPException(status_code=404, detail="Job not found")


@router.post("/", status_code=201)
def create_job(payload: JobCreate):
  data = _jobs()
  new_id = f"JOB-{str(uuid.uuid4())[:8].upper()}"
  
  # Arşiv işi mi kontrol et
  if payload.isArchive or payload.startType == "ARSIV":
    # Arşiv kaydı - doğrudan KAPALI durumunda
    job = {
        "id": new_id,
        "title": payload.title,
        "customerId": payload.customerId,
        "customerName": payload.customerName,
        "status": "KAPALI",
        "startType": "ARSIV",
        "roles": payload.roles or [],
        "measure": {"completed": True},
        "offer": {"completed": True},
        "approval": {
            "started": True,
            "completed": True,
            "totalAmount": payload.archiveTotalAmount or 0,
            "paymentPlan": {"type": "archive"},
            "archiveDate": payload.archiveDate,
        },
        "stock": {"ready": True, "completed": True},
        "production": {"status": "completed", "completed": True},
        "assembly": {"completed": True, "date": payload.archiveCompletedDate},
        "finance": {
            "closed": True,
            "total": payload.archiveTotalAmount or 0,
        },
        "service": {},
        "roleFiles": {},
        "rolePrices": {},
        "logs": [],
        "notes": payload.archiveNote,
        "isArchive": True,
        "archiveDate": payload.archiveDate,
        "archiveCompletedDate": payload.archiveCompletedDate,
        "createdAt": payload.archiveDate or _now_iso(),
    }
    _log(job, "archive_created", f"Arşiv kaydı oluşturuldu - Tutar: {payload.archiveTotalAmount}")
    data.insert(0, job)
    _save_jobs(data)
    return job
  
  # Normal iş akışı
  # Başlatma türüne göre statü belirle
  status_map = {
      "OLCU": "OLCU_RANDEVU_BEKLIYOR",
      "MUSTERI_OLCUSU": "MUSTERI_OLCUSU_BEKLENIYOR",  # Henüz dosya yüklenmedi
      "SERVIS": "SERVIS_RANDEVU_BEKLIYOR"
  }
  status = status_map.get(payload.startType, "OLCU_RANDEVU_BEKLIYOR")
  
  job = {
      "id": new_id,
      "title": payload.title,
      "customerId": payload.customerId,
      "customerName": payload.customerName,
      "status": status,
      "startType": payload.startType,
      "roles": payload.roles or [],
      "measure": {},
      "offer": {},
      "approval": {},
      "stock": {},
      "production": {},
      "assembly": {},
      "finance": {},
      "service": {
          "note": payload.serviceNote,
          "fixedFee": payload.serviceFixedFee,
          "extraMaterials": [],
          "completed": False
      } if payload.startType == "SERVIS" else {},
      "roleFiles": {},  # İş kolu bazlı dosyalar için
      "rolePrices": {},  # İş kolu bazlı fiyatlar için
      "logs": [],
      "createdAt": _now_iso(),
  }
  _log(job, "created", f"startType={payload.startType}")
  data.insert(0, job)
  _save_jobs(data)
  return job


@router.put("/{job_id}/measure")
def update_measure(job_id: str, payload: MeasureUpdate):
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  
  # Mevcut measure bilgilerini koru ve güncelle
  existing_measure = job.get("measure", {})
  
  if payload.measurements is not None:
    existing_measure["measurements"] = payload.measurements
  if payload.appointment is not None:
    existing_measure["appointment"] = payload.appointment
  
  job["measure"] = existing_measure
  
  # Servis bilgilerini ayrı kaydet
  if payload.service:
    existing_service = job.get("service", {})
    job["service"] = {**existing_service, **payload.service}
  
  # Statü güncellemesi
  if payload.status:
    old_status = job.get("status", "")
    job["status"] = payload.status
    _log(job, "status.updated", f"{old_status} -> {payload.status}")
  else:
    _log(job, "measure.updated")
  
  data[idx] = job
  _save_jobs(data)
  return job


@router.put("/{job_id}/offer")
def update_offer(job_id: str, payload: OfferUpdate):
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  job["offer"] = payload.model_dump()
  job["status"] = payload.status or "TEKLIF_TASLAK"
  _log(job, "offer.updated")
  data[idx] = job
  _save_jobs(data)
  return job


@router.post("/{job_id}/approval/start")
def start_approval(job_id: str, payload: ApprovalStart):
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  job["approval"] = payload.model_dump()
  job["status"] = "ANLASMA_TAMAMLANDI"
  _log(job, "approval.started")
  data[idx] = job
  _save_jobs(data)
  return job


class PaymentUpdate(BaseModel):
  paymentPlan: dict


@router.put("/{job_id}/approval/payment")
def update_payment(job_id: str, payload: PaymentUpdate):
  """Ödeme planını güncelle (tahsilat, çek detayı vs.)"""
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  
  if "approval" not in job:
    job["approval"] = {}
  
  job["approval"]["paymentPlan"] = payload.paymentPlan
  _log(job, "payment.updated")
  data[idx] = job
  _save_jobs(data)
  return job


@router.put("/{job_id}/stock")
def update_stock(job_id: str, payload: StockStatus):
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  stock = job.get("stock", {})
  stock["ready"] = payload.ready
  stock["purchaseNotes"] = payload.purchaseNotes
  # Seçilen stok kalemlerini kaydet (arşiv için)
  if payload.items:
    stock["items"] = [item.model_dump() for item in payload.items]
  # Tahmini hazır olma tarihi (Sonra Üret için)
  if payload.estimatedDate:
    stock["estimatedDate"] = payload.estimatedDate
  job["stock"] = stock
  # ready=True -> Üretime Hazır, ready=False -> Sonra Üretilecek (rezerve edildi)
  job["status"] = "URETIME_HAZIR" if payload.ready else "SONRA_URETILECEK"
  _log(job, "stock.updated", f"ready={payload.ready}, items={len(payload.items or [])}, estimatedDate={payload.estimatedDate}")
  data[idx] = job
  _save_jobs(data)
  return job


@router.put("/{job_id}/production")
def production_status(job_id: str, payload: ProductionStatus):
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  prod_data = {"status": payload.status, "note": payload.note}
  if payload.agreementDate:
    prod_data["agreementDate"] = payload.agreementDate
  job["production"] = prod_data
  job["status"] = payload.status
  _log(job, "production.updated", payload.status)
  data[idx] = job
  _save_jobs(data)
  return job


@router.put("/{job_id}/assembly/schedule")
def assembly_schedule(job_id: str, payload: AssemblySchedule):
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  job["assembly"] = job.get("assembly", {})
  job["assembly"]["schedule"] = payload.model_dump()
  job["status"] = "MONTAJ_TERMIN"
  _log(job, "assembly.scheduled")
  data[idx] = job
  _save_jobs(data)
  return job


@router.put("/{job_id}/assembly/complete")
def assembly_complete(job_id: str, payload: AssemblyComplete):
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  job["assembly"] = job.get("assembly", {})
  job["assembly"]["schedule"] = job["assembly"].get("schedule", {})
  if payload.date:
    job["assembly"]["schedule"]["date"] = payload.date
  if payload.note:
    job["assembly"]["schedule"]["note"] = payload.note
  if payload.team:
    job["assembly"]["schedule"]["team"] = payload.team
  job["assembly"]["complete"] = {"at": _now_iso(), "proof": payload.proof}
  job["status"] = "MUHASEBE_BEKLIYOR"
  _log(job, "assembly.complete", f"team={payload.team}")
  data[idx] = job
  _save_jobs(data)
  return job


@router.put("/{job_id}/status")
def update_status(job_id: str, payload: StatusUpdate):
  """Genel statü güncelleme - servis işleri ve diğer geçişler için"""
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)
  
  old_status = job.get("status", "")
  job["status"] = payload.status
  
  # Servis bilgileri varsa güncelle
  if payload.service:
    existing_service = job.get("service", {})
    job["service"] = {**existing_service, **payload.service}
  
  # Teklif/fiyat bilgileri varsa güncelle
  if payload.offer:
    existing_offer = job.get("offer", {})
    job["offer"] = {**existing_offer, **payload.offer}
  
  # Ret bilgileri varsa güncelle
  if payload.rejection:
    job["rejection"] = payload.rejection
  
  _log(job, "status.updated", f"{old_status} -> {payload.status}")
  data[idx] = job
  _save_jobs(data)
  return job


@router.put("/{job_id}/finance/close")
def finance_close(job_id: str, payload: FinanceClose):
  data, idx, job = _find_job(job_id)
  job = deepcopy(job)

  offer_total = float(job.get("offer", {}).get("total", 0))
  approval_plan = job.get("approval", {}).get("paymentPlan", {})
  
  # Pre-received amounts
  pre_cash = float(approval_plan.get("cash", 0))
  pre_card = float(approval_plan.get("card", 0))
  pre_cheque = float(approval_plan.get("cheque", 0))
  after_delivery = float(approval_plan.get("afterDelivery", 0))
  pre_total = pre_cash + pre_card + pre_cheque

  # Final payments
  payments = payload.payments or {}
  final_cash = float(payments.get("cash", 0))
  final_card = float(payments.get("card", 0))
  final_cheque = float(payments.get("cheque", 0))
  final_total = final_cash + final_card + final_cheque
  
  discount_amt = float(payload.discount.get("amount", 0)) if payload.discount else 0
  
  # Total received = pre + final + discount
  total_received = pre_total + final_total + discount_amt
  balance = round(offer_total - total_received, 2)
  
  if abs(balance) > 0.01:  # Allow small float differences
    raise HTTPException(status_code=400, detail=f"Bakiye 0 olmalı. Fark: {balance}₺")
  if discount_amt > 0 and not payload.discount.get("note"):
    raise HTTPException(status_code=400, detail="İskonto notu zorunlu")

  job["finance"] = {
    "total": offer_total,
    "prePayments": {"cash": pre_cash, "card": pre_card, "cheque": pre_cheque},
    "finalPayments": {"cash": final_cash, "card": final_card, "cheque": final_cheque},
    "discount": payload.discount,
    "closedAt": _now_iso()
  }
  job["status"] = "KAPALI"
  _log(job, "finance.closed", f"balance={balance}")
  data[idx] = job
  _save_jobs(data)
  return job

