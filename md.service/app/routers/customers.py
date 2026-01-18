import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..data_loader import load_json, save_json

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerIn(BaseModel):
  name: str = Field(..., min_length=2)
  segment: str = "B2C"
  location: str = ""
  contact: str = ""
  phone: str = ""
  phone2: str = ""
  address: str = ""


@router.get("/")
def list_customers():
  return load_json("customers.json")


@router.post("/", status_code=201)
def create_customer(payload: CustomerIn):
  customers = load_json("customers.json")
  new_id = f"CST-{str(uuid.uuid4())[:8].upper()}"
  
  # Generate unique account code (Cari Kod) if not present
  existing_codes = {c.get("accountCode") for c in customers if c.get("accountCode")}
  
  # Simple strategy: C-{Year}-{Random4}
  import random
  from datetime import datetime
  year = datetime.now().year
  
  while True:
      code = f"C-{year}-{random.randint(1000, 9999)}"
      if code not in existing_codes:
          break

  new_item = {
      "id": new_id,
      "name": payload.name,
      "segment": payload.segment,
      "location": payload.location,
      "jobs": 0,
      "contact": payload.contact,
      "phone": payload.phone,
      "phone2": payload.phone2,
      "address": payload.address,
      "deleted": False,
      "accountCode": code
  }
  customers.append(new_item)
  save_json("customers.json", customers)
  return new_item


@router.put("/{customer_id}")
def update_customer(customer_id: str, payload: CustomerIn):
  customers = load_json("customers.json")
  for idx, item in enumerate(customers):
    if item.get("id") == customer_id:
      customers[idx] = {
          **item,
          "name": payload.name,
          "segment": payload.segment,
          "location": payload.location,
          "contact": payload.contact,
          "phone": payload.phone,
          "phone2": payload.phone2,
          "address": payload.address,
      }
      save_json("customers.json", customers)
      return customers[idx]
  raise HTTPException(status_code=404, detail="Customer not found")


@router.delete("/{customer_id}")
def soft_delete_customer(customer_id: str):
  customers = load_json("customers.json")
  for idx, item in enumerate(customers):
    if item.get("id") == customer_id:
      customers[idx] = {**item, "deleted": True}
      save_json("customers.json", customers)
      return {"id": customer_id, "deleted": True}
  raise HTTPException(status_code=404, detail="Customer not found")

