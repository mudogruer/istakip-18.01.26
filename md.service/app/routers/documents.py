import os
import uuid
import shutil
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..data_loader import load_json, save_json

router = APIRouter(prefix="/documents", tags=["documents"])

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DOCS_DIR = BASE_DIR / "md.docs" / "documents"

# Ensure directories exist
DOCS_DIR.mkdir(parents=True, exist_ok=True)
for subdir in ["olcu", "teknik", "sozlesme", "teklif", "diger", "servis"]:
    (DOCS_DIR / subdir).mkdir(exist_ok=True)

ALLOWED_TYPES = {
    # Görsel formatları
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    # PDF
    "application/pdf": ".pdf",
    # Microsoft Office
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    # CAD formatları
    "application/acad": ".dwg",
    "application/x-acad": ".dwg",
    "application/x-autocad": ".dwg",
    "image/vnd.dwg": ".dwg",
    "image/x-dwg": ".dwg",
    "application/dxf": ".dxf",
    "image/vnd.dxf": ".dxf",
    "image/x-dxf": ".dxf",
    # Arşiv
    "application/zip": ".zip",
    "application/x-rar-compressed": ".rar",
    "application/x-7z-compressed": ".7z",
    # Metin
    "text/plain": ".txt",
    "text/csv": ".csv",
    # Fallback - bilinmeyen tipler için uzantıya bak
    "application/octet-stream": None,  # Uzantıya göre belirlenecek
}

# Uzantıya göre izin verilen dosyalar (content-type belirsiz olduğunda)
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".dwg", ".dxf", ".zip", ".rar", ".7z", ".txt", ".csv"
}


class DocumentMeta(BaseModel):
    jobId: str
    type: str
    description: str | None = None


@router.get("/")
def list_documents(job_id: str | None = None, doc_type: str | None = None):
    """List all documents, optionally filtered by jobId or type"""
    docs = load_json("documents.json")
    if job_id:
        docs = [d for d in docs if d.get("jobId") == job_id]
    if doc_type:
        docs = [d for d in docs if d.get("type") == doc_type]
    return docs


@router.get("/{doc_id}")
def get_document(doc_id: str):
    """Get document metadata by ID"""
    docs = load_json("documents.json")
    for doc in docs:
        if doc.get("id") == doc_id:
            return doc
    raise HTTPException(status_code=404, detail="Döküman bulunamadı")


@router.get("/{doc_id}/download")
def download_document(doc_id: str):
    """Download a document file"""
    docs = load_json("documents.json")
    doc = None
    for d in docs:
        if d.get("id") == doc_id:
            doc = d
            break
    
    if not doc:
        raise HTTPException(status_code=404, detail="Döküman bulunamadı")
    
    file_path = BASE_DIR / "md.docs" / doc["path"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    
    return FileResponse(
        path=str(file_path),
        filename=doc.get("originalName", doc["filename"]),
        media_type=doc.get("mimeType", "application/octet-stream")
    )


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    jobId: str = Form(...),
    docType: str = Form(...),
    description: str = Form(None)
):
    """
    Upload a document file.
    docType: olcu, teknik, sozlesme, teklif, diger, measure_*, technical_*
    """
    # Validate type - ana tipler ve iş kolu bazlı tipler
    valid_base_types = ["olcu", "teknik", "sozlesme", "teklif", "diger", "servis_oncesi", "servis_sonrasi"]
    is_role_based = docType.startswith("measure_") or docType.startswith("technical_")
    
    if docType not in valid_base_types and not is_role_based:
        raise HTTPException(status_code=400, detail="Geçersiz döküman tipi")
    
    # Dosya uzantısını al
    original_name = file.filename or "unnamed"
    file_ext = os.path.splitext(original_name)[1].lower()
    
    # content-type veya uzantıya göre kontrol
    content_type = file.content_type or ""
    
    # Önce content-type'a bak
    if content_type in ALLOWED_TYPES and ALLOWED_TYPES[content_type] is not None:
        ext = ALLOWED_TYPES[content_type]
    # content-type bilinmiyorsa uzantıya bak
    elif file_ext in ALLOWED_EXTENSIONS:
        ext = file_ext
    # application/octet-stream ise uzantıya güven
    elif content_type == "application/octet-stream" and file_ext in ALLOWED_EXTENSIONS:
        ext = file_ext
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya tipi: {content_type or 'bilinmiyor'} ({file_ext}). "
                   f"Desteklenen formatlar: JPG, PNG, PDF, DOC, DOCX, XLS, XLSX, DWG, DXF, ZIP, RAR vb."
        )
    
    # Generate unique filename
    doc_id = f"DOC-{str(uuid.uuid4())[:8].upper()}"
    safe_name = f"{doc_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{ext}"
    
    # İş kolu bazlı dosyalar için klasör belirleme
    target_subdir = "diger"
    if docType in ["olcu", "teknik", "sozlesme", "teklif", "diger"]:
        target_subdir = docType
    elif docType.startswith("measure_"):
        target_subdir = "olcu"
    elif docType.startswith("technical_"):
        target_subdir = "teknik"
    elif docType.startswith("servis"):
        target_subdir = "servis"
    
    # Save file
    target_dir = DOCS_DIR / target_subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / safe_name
    
    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dosya kaydedilemedi: {str(e)}")
    
    # Get file size
    file_size = target_path.stat().st_size
    
    # Create metadata
    doc_meta = {
        "id": doc_id,
        "jobId": jobId,
        "type": docType,
        "filename": safe_name,
        "originalName": file.filename,
        "path": f"documents/{target_subdir}/{safe_name}",
        "mimeType": content_type,
        "size": file_size,
        "uploadedBy": "Kullanıcı",
        "uploadedAt": datetime.utcnow().isoformat() + "Z",
        "description": description
    }
    
    # Save to database
    docs = load_json("documents.json")
    docs.insert(0, doc_meta)
    save_json("documents.json", docs)
    
    return doc_meta


@router.delete("/{doc_id}")
def delete_document(doc_id: str):
    """Delete a document and its file"""
    docs = load_json("documents.json")
    doc = None
    doc_idx = -1
    
    for idx, d in enumerate(docs):
        if d.get("id") == doc_id:
            doc = d
            doc_idx = idx
            break
    
    if not doc:
        raise HTTPException(status_code=404, detail="Döküman bulunamadı")
    
    # Delete file
    file_path = BASE_DIR / "md.docs" / doc["path"]
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass  # File deletion is best effort
    
    # Remove from database
    docs.pop(doc_idx)
    save_json("documents.json", docs)
    
    return {"success": True, "id": doc_id}


@router.get("/job/{job_id}")
def get_job_documents(job_id: str):
    """Get all documents for a specific job"""
    docs = load_json("documents.json")
    return [d for d in docs if d.get("jobId") == job_id]

