"""
document_router.py - 문서 보관함 API

PDF 파일 업로드 및 관리 기능 제공:
1. 문서 목록 조회 (검색, 카테고리 필터, 페이징)
2. 문서 상세 조회
3. PDF 파일 업로드
4. 문서 수정 (제목, 카테고리)
5. 문서 삭제
6. PDF 파일 다운로드
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
import uuid
import os

import json

from app.database import get_db
from app import models
from app.crud import create_system_log
from app.config import redis_client
from app.utils import format_file_size

# Celery Worker에게 RAG 작업 요청 (런타임에 lazy import)
# Worker가 없는 환경에서도 기본 업로드 기능은 동작하도록 함
ingest_pdf_task = None

def get_celery_tasks():
    """Celery 태스크를 런타임에 로드 (lazy import)"""
    global ingest_pdf_task
    if ingest_pdf_task is None:
        try:
            from worker.tasks import ingest_pdf_task as _ingest
            ingest_pdf_task = _ingest
        except Exception as e:
            print(f"⚠️ [Document Router] Celery 태스크 로드 실패 (RAG 비활성화): {e}")
    return ingest_pdf_task

# RAGEngine 싱글톤 (PC1에서 직접 벡터 저장/삭제용)
_rag_engine = None

def get_rag_engine():
    """RAGEngine을 런타임에 로드 (lazy singleton)"""
    global _rag_engine
    if _rag_engine is None:
        try:
            from ai_core.rag_engine import RAGEngine
            _rag_engine = RAGEngine()
        except Exception as e:
            print(f"⚠️ [Document Router] RAGEngine 로드 실패: {e}")
    return _rag_engine


router = APIRouter(
    prefix="/document",
    tags=["Document"]
)

# 파일 저장 경로 (PC1 로컬 - HTTP 전송으로 Worker와 공유)
UPLOAD_DIR = "/app/uploads/documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 허용되는 파일 확장자
ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "hwp"]


# ============================================================================
# Pydantic 스키마
# ============================================================================

class DocumentUpdate(BaseModel):
    """문서 수정 요청 스키마"""
    title: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None


# ============================================================================
# 1. 문서 목록 조회 (검색, 카테고리 필터, 페이징)
# ============================================================================

@router.get("/list/{user_id}")
def get_document_list(
    user_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
    category: Optional[str] = Query(None, description="카테고리 필터 (전체는 None)"),
    search: Optional[str] = Query(None, description="검색어 (제목, 요약)"),
    db: Session = Depends(get_db)
):
    """
    문서 목록을 페이징하여 반환합니다.
    """
    # 사용자 확인
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 기본 쿼리
    query = db.query(models.Document).filter(models.Document.user_id == user_id)

    # 카테고리 필터
    if category and category != "전체":
        query = query.filter(models.Document.category == category)

    # 검색어 필터
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                models.Document.title.ilike(search_pattern),
                models.Document.summary.ilike(search_pattern)
            )
        )

    # 전체 개수
    total_count = query.count()

    # 페이징 적용 (최신순 정렬)
    offset = (page - 1) * size
    documents = query.order_by(desc(models.Document.created_at)).offset(offset).limit(size).all()

    # 총 페이지 수 계산
    total_pages = (total_count + size - 1) // size

    # 작성자 정보 포함하여 반환
    document_list = []
    for idx, doc in enumerate(documents):
        author = db.query(models.User).filter(models.User.id == doc.user_id).first()
        document_list.append({
            "id": doc.id,
            "rowNum": total_count - offset - idx,
            "title": doc.title,
            "summary": doc.summary[:100] + "..." if doc.summary and len(doc.summary) > 100 else (doc.summary or ""),
            "category": doc.category,
            "fileName": doc.file_name,
            "fileExt": doc.file_ext,
            "fileSize": doc.file_size,
            "fileSizeText": format_file_size(doc.file_size),
            "authorId": doc.user_id,
            "authorName": author.name if author else "알 수 없음",
            "status": doc.status,
            "createdAt": doc.created_at.strftime("%Y-%m-%d %H:%M") if doc.created_at else None
        })

    return {
        "documents": document_list,
        "pagination": {
            "currentPage": page,
            "totalPages": total_pages,
            "totalCount": total_count,
            "pageSize": size,
            "hasNext": page < total_pages,
            "hasPrev": page > 1
        }
    }


# ============================================================================
# 2. 문서 상세 조회
# ============================================================================

@router.get("/{document_id}")
def get_document_detail(document_id: int, db: Session = Depends(get_db)):
    """
    특정 문서의 상세 정보를 반환합니다.
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    author = db.query(models.User).filter(models.User.id == document.user_id).first()

    return {
        "id": document.id,
        "title": document.title,
        "category": document.category,
        "summary": document.summary,
        "fileName": document.file_name,
        "fileExt": document.file_ext,
        "fileSize": document.file_size,
        "fileSizeText": format_file_size(document.file_size),
        "status": document.status,
        "chromaId": document.chroma_id,
        "authorId": document.user_id,
        "authorName": author.name if author else "알 수 없음",
        "downloadUrl": f"/document/download/{document.id}",
        "createdAt": document.created_at.strftime("%Y-%m-%d %H:%M") if document.created_at else None,
        "updatedAt": document.updated_at.strftime("%Y-%m-%d %H:%M") if document.updated_at else None
    }


# ============================================================================
# 3. PDF 파일 업로드
# ============================================================================

@router.post("/upload")
async def upload_document(
    request: Request,
    user_id: int = Form(...),
    title: str = Form(...),
    category: str = Form(...),
    summary: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    PDF 등 문서 파일을 업로드합니다.

    Args:
        user_id: 사용자 ID
        title: 문서 제목
        category: 카테고리 (업무, 개인, 아이디어)
        summary: 문서 요약 (선택)
        file: 업로드할 파일

    Returns:
        생성된 문서 정보
    """
    # 사용자 존재 확인
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 파일 확장자 확인
    original_filename = file.filename
    file_ext = original_filename.split(".")[-1].lower() if "." in original_filename else ""

    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 파일 저장
    file_id = str(uuid.uuid4())
    saved_filename = f"{file_id}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, saved_filename)

    contents = await file.read()
    file_size = len(contents)

    with open(file_path, "wb") as f:
        f.write(contents)

    # PDF 파일인 경우 RAG 벡터화 작업 트리거
    rag_task_id = None
    doc_status = "INDEXED"  # 기본값 (비PDF 파일)

    if file_ext == "pdf":
        # Worker에게 RAG 벡터화 작업 요청 (비동기)
        _ingest_task = get_celery_tasks()
        if _ingest_task:
            try:
                task = _ingest_task.delay(file_path)
                rag_task_id = task.id
                doc_status = "INDEXING"  # PDF 처리 중 (RAG 벡터화)
                print(f"📄 [Document Upload] Worker에게 RAG 작업 전달 (Task ID: {task.id})")
            except Exception as e:
                print(f"⚠️ [Document Upload] RAG 작업 큐잉 실패 (파일은 저장됨): {e}")
                doc_status = "INDEXED"  # Worker 없이도 파일은 저장됨
        else:
            print("⚠️ [Document Upload] Celery Worker 미연결 (RAG 비활성화)")
            doc_status = "INDEXED"  # Worker 없이도 파일은 저장됨

    # 문서 생성
    new_document = models.Document(
        user_id=user_id,
        title=title,
        category=category,
        file_name=original_filename,
        file_ext=file_ext,
        file_size=file_size,
        summary=summary or f"{title} 문서입니다.",
        status=doc_status,
        chroma_id=file_id
    )

    db.add(new_document)
    db.commit()
    db.refresh(new_document)

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=user_id,
        action="DOC_UPLOAD_SUCCESS",
        target_id=new_document.id,
        target_type="DOCUMENT",
        ip_addr=request.client.host,
        details=f"문서 업로드: {title} ({original_filename})" + (f" - RAG 처리 중 (Task: {rag_task_id})" if rag_task_id else "")
    )

    response = {
        "message": "문서가 업로드되었습니다." + (" RAG 벡터화 작업이 백그라운드에서 진행 중입니다." if rag_task_id else ""),
        "document": {
            "id": new_document.id,
            "title": new_document.title,
            "fileName": new_document.file_name,
            "fileSize": format_file_size(new_document.file_size),
            "category": new_document.category,
            "status": new_document.status,
            "createdAt": new_document.created_at.strftime("%Y-%m-%d %H:%M") if new_document.created_at else None
        }
    }

    # PDF 파일인 경우 RAG 작업 ID 추가
    if rag_task_id:
        response["ragTaskId"] = rag_task_id

    return response


# ============================================================================
# 4. 문서 수정
# ============================================================================

@router.put("/{document_id}")
def update_document(document_id: int, data: DocumentUpdate, db: Session = Depends(get_db)):
    """
    문서 정보를 수정합니다 (제목, 카테고리, 요약).
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    # 필드별 업데이트
    if data.title is not None:
        document.title = data.title
    if data.category is not None:
        document.category = data.category
    if data.summary is not None:
        document.summary = data.summary

    db.commit()
    db.refresh(document)

    return {
        "message": "문서가 수정되었습니다.",
        "document": {
            "id": document.id,
            "title": document.title,
            "category": document.category,
            "updatedAt": document.updated_at.strftime("%Y-%m-%d %H:%M") if document.updated_at else None
        }
    }


# ============================================================================
# 5. 문서 삭제
# ============================================================================

@router.delete("/{document_id}")
def delete_document(document_id: int, request: Request, user_id: int = Query(...), db: Session = Depends(get_db)):
    """
    문서를 삭제합니다.
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    doc_title = document.title
    doc_filename = document.file_name
    doc_file_ext = document.file_ext
    doc_chroma_id = document.chroma_id

    # PDF인 경우 ChromaDB에서 벡터 직접 삭제 (PC1에서 처리)
    vector_deleted = False
    if doc_file_ext == "pdf" and doc_chroma_id:
        file_path = os.path.join(UPLOAD_DIR, f"{doc_chroma_id}.{doc_file_ext}")
        rag = get_rag_engine()
        if rag:
            try:
                result = rag.delete_by_source(file_path)
                vector_deleted = True
                print(f"🗑️ [Document Delete] ChromaDB 벡터 직접 삭제 완료: {result}")
            except Exception as e:
                print(f"⚠️ [Document Delete] 벡터 삭제 실패: {e}")

    # 물리적 파일 삭제
    if doc_chroma_id:
        file_path = os.path.join(UPLOAD_DIR, f"{doc_chroma_id}.{doc_file_ext}")
        if os.path.exists(file_path):
            os.remove(file_path)

    # DB에서 문서 삭제
    db.delete(document)
    db.commit()

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=user_id,
        action="DOC_DELETE_SUCCESS",
        target_id=document_id,
        target_type="DOCUMENT",
        ip_addr=request.client.host,
        details=f"문서 삭제: {doc_title} ({doc_filename})" + (" - 벡터 삭제 완료" if vector_deleted else "")
    )

    response = {"message": "문서가 삭제되었습니다."}
    if vector_deleted:
        response["message"] += " ChromaDB 벡터도 삭제되었습니다."

    return response


# ============================================================================
# 6. 파일 다운로드
# ============================================================================

@router.get("/download/{document_id}")
def download_document(document_id: int, db: Session = Depends(get_db)):
    """
    문서 파일을 다운로드합니다.
    """
    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")

    file_path = os.path.join(UPLOAD_DIR, f"{document.chroma_id}.{document.file_ext}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    # MIME 타입 설정
    media_type_map = {
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls": "application/vnd.ms-excel",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt": "application/vnd.ms-powerpoint",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "txt": "text/plain",
        "hwp": "application/x-hwp"
    }

    media_type = media_type_map.get(document.file_ext, "application/octet-stream")

    return FileResponse(
        path=file_path,
        filename=document.file_name,
        media_type=media_type
    )


# ============================================================================
# 7. 내부 API (Worker ↔ Backend HTTP 통신)
# ============================================================================

@router.get("/internal/file/{filename}")
def internal_get_file(filename: str):
    """
    Worker가 PDF 파일을 HTTP로 다운로드하는 내부 API

    PC2 Worker가 문서를 임베딩하기 위해 PC1에서 PDF를 가져갈 때 사용합니다.
    """
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {filename}")

    return FileResponse(path=file_path)


@router.post("/internal/store-vectors")
async def internal_store_vectors(request: Request):
    """
    Worker가 임베딩 벡터를 HTTP로 전송하는 내부 API

    PC2 Worker가 GPU로 생성한 임베딩 벡터를 PC1 ChromaDB에 저장합니다.

    Body (JSON):
        embeddings: 벡터 임베딩 리스트
        texts: 원본 텍스트 청크 리스트
        metadatas: 메타데이터 리스트 (source, page 등)
    """
    data = await request.json()

    embeddings = data.get("embeddings")
    texts = data.get("texts")
    metadatas = data.get("metadatas")

    if not embeddings or not texts or not metadatas:
        raise HTTPException(status_code=400, detail="embeddings, texts, metadatas 필드가 필요합니다.")

    if not (len(embeddings) == len(texts) == len(metadatas)):
        raise HTTPException(status_code=400, detail="embeddings, texts, metadatas 길이가 일치하지 않습니다.")

    rag = get_rag_engine()
    if not rag:
        raise HTTPException(status_code=500, detail="RAGEngine을 로드할 수 없습니다.")

    result = rag.store_precomputed_vectors(
        embeddings=embeddings,
        texts=texts,
        metadatas=metadatas
    )

    return {"message": result}


# ============================================================================
# 8. RAG 벡터화 진행률 조회
# ============================================================================

@router.get("/status/{task_id}")
def get_rag_status(task_id: str):
    """
    RAG 벡터화 작업의 진행률을 조회합니다.

    Args:
        task_id: Celery Task ID

    Returns:
        진행률 정보 (status, progress, message)

    Note:
        - Worker에서 Redis에 저장한 진행률 정보를 조회
        - 프론트엔드에서 폴링으로 호출
    """
    redis_key = f"rag_task:{task_id}:progress"

    try:
        cached_data = redis_client.get(redis_key)

        if cached_data:
            progress_data = json.loads(cached_data)
            return progress_data
        else:
            return {
                "status": "pending",
                "progress": 0,
                "message": "작업 대기 중..."
            }

    except Exception as e:
        print(f"⚠️ [RAG Status] Redis 조회 실패: {e}")
        return {
            "status": "unknown",
            "progress": 0,
            "message": "상태 조회 실패"
        }


# ============================================================================
# 9. 카테고리 목록 조회
# ============================================================================

@router.get("/categories/list")
def get_categories():
    """
    사용 가능한 카테고리 목록을 반환합니다.
    """
    return {
        "categories": ["전체", "업무", "개인", "아이디어"]
    }


