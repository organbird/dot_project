"""
meeting_router.py - 회의록 분석 API

회의 음성 파일 업로드, 텍스트 변환, 요약 기능 제공:
1. 회의록 목록 조회 (페이징)
2. 회의록 상세 조회
3. 회의록 업로드 (음성 파일)
4. 회의록 삭제
5. 회의록 수정 (제목, 참석자)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
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
from app.utils import format_duration, get_status_text

# Celery STT 작업 (런타임에 lazy import)
# Worker가 없는 환경에서도 기본 업로드 기능은 동작하도록 함
_transcribe_task = None

def _get_stt_task():
    """Celery STT 태스크를 런타임에 로드 (lazy import)"""
    global _transcribe_task
    if _transcribe_task is None:
        try:
            from worker.tasks import transcribe_audio_task
            _transcribe_task = transcribe_audio_task
        except Exception as e:
            print(f"[Meeting Router] Celery STT task 로드 실패: {e}")
    return _transcribe_task


router = APIRouter(
    prefix="/meeting",
    tags=["Meeting"]
)

# 파일 저장 경로
UPLOAD_DIR = "uploads/meetings"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ============================================================================
# Pydantic 스키마
# ============================================================================

class MeetingCreate(BaseModel):
    """회의록 생성 요청 스키마 (텍스트 직접 입력용)"""
    user_id: int
    title: str
    transcript: str
    summary: str
    duration: int = 0
    attendees: str = ""


class MeetingUpdate(BaseModel):
    """회의록 수정 요청 스키마"""
    title: Optional[str] = None
    attendees: Optional[str] = None
    summary: Optional[str] = None


# ============================================================================
# 1. 회의록 목록 조회 (페이징)
# ============================================================================

@router.get("/list/{user_id}")
def get_meeting_list(
    user_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=100, description="페이지당 항목 수"),
    search: Optional[str] = Query(None, description="검색어 (제목)"),
    db: Session = Depends(get_db)
):
    """
    회의록 목록을 페이징하여 반환합니다.

    Args:
        user_id: 사용자 ID
        page: 페이지 번호 (1부터 시작)
        size: 페이지당 항목 수
        search: 검색어 (제목에서 검색)

    Returns:
        페이징된 회의록 목록
    """
    # 사용자 확인
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 기본 쿼리
    query = db.query(models.MeetingNote).filter(models.MeetingNote.user_id == user_id)

    # 검색어 필터
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(models.MeetingNote.title.ilike(search_pattern))

    # 전체 개수
    total_count = query.count()

    # 페이징 적용 (최신순 정렬)
    offset = (page - 1) * size
    meetings = query.order_by(desc(models.MeetingNote.created_at)).offset(offset).limit(size).all()

    # 총 페이지 수 계산
    total_pages = (total_count + size - 1) // size

    # 목록 변환
    meeting_list = []
    for idx, m in enumerate(meetings):
        meeting_list.append({
            "id": m.id,
            "rowNum": total_count - offset - idx,
            "title": m.title,
            "duration": m.duration,
            "durationText": format_duration(m.duration),
            "attendees": m.attendees,
            "status": m.status,
            "statusText": get_status_text(m.status),
            "createdAt": m.created_at.strftime("%Y-%m-%d %H:%M") if m.created_at else None
        })

    return {
        "meetings": meeting_list,
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
# 2. 회의록 상세 조회
# ============================================================================

@router.get("/{meeting_id}")
def get_meeting_detail(meeting_id: int, db: Session = Depends(get_db)):
    """
    특정 회의록의 상세 정보를 반환합니다.

    Args:
        meeting_id: 회의록 ID

    Returns:
        회의록 상세 정보
    """
    meeting = db.query(models.MeetingNote).filter(models.MeetingNote.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의록을 찾을 수 없습니다.")

    author = db.query(models.User).filter(models.User.id == meeting.user_id).first()

    return {
        "id": meeting.id,
        "title": meeting.title,
        "fileName": meeting.file_name,
        "fileExt": meeting.file_ext,
        "fileSize": meeting.file_size,
        "transcript": meeting.transcript,
        "summary": meeting.summary,
        "duration": meeting.duration,
        "durationText": format_duration(meeting.duration),
        "attendees": meeting.attendees,
        "attendeeList": [a.strip() for a in meeting.attendees.split(",") if a.strip()],
        "status": meeting.status,
        "statusText": get_status_text(meeting.status),
        "authorId": meeting.user_id,
        "authorName": author.name if author else "알 수 없음",
        "createdAt": meeting.created_at.strftime("%Y-%m-%d %H:%M") if meeting.created_at else None,
        "updatedAt": meeting.updated_at.strftime("%Y-%m-%d %H:%M") if meeting.updated_at else None
    }


# ============================================================================
# 3. 회의록 생성 (텍스트 직접 입력)
# ============================================================================

@router.post("/")
def create_meeting(data: MeetingCreate, request: Request, db: Session = Depends(get_db)):
    """
    새로운 회의록을 생성합니다 (텍스트 직접 입력).

    Args:
        data: 회의록 생성 데이터

    Returns:
        생성된 회의록 정보
    """
    # 사용자 존재 확인
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 회의록 생성
    new_meeting = models.MeetingNote(
        user_id=data.user_id,
        title=data.title,
        file_name=f"{data.title}.txt",
        file_ext="txt",
        file_size=len(data.transcript.encode('utf-8')),
        transcript=data.transcript,
        summary=data.summary,
        duration=data.duration,
        attendees=data.attendees,
        task_id=str(uuid.uuid4()),
        status="COMPLETED"
    )

    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=data.user_id,
        action="MEETING_CREATE_SUCCESS",
        target_id=new_meeting.id,
        target_type="MEETING",
        ip_addr=request.client.host,
        details=f"회의록 생성: {new_meeting.title}"
    )

    return {
        "message": "회의록이 등록되었습니다.",
        "meeting": {
            "id": new_meeting.id,
            "title": new_meeting.title,
            "status": new_meeting.status,
            "createdAt": new_meeting.created_at.strftime("%Y-%m-%d %H:%M") if new_meeting.created_at else None
        }
    }


# ============================================================================
# 4. 회의록 파일 업로드
# ============================================================================

@router.post("/upload")
async def upload_meeting(
    request: Request,
    user_id: int = Form(...),
    title: str = Form(...),
    attendees: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    회의 음성 파일을 업로드하고 회의록을 생성합니다.

    실제 구현에서는 음성-텍스트 변환 서비스(Whisper 등)를 연동하여
    transcript와 summary를 자동 생성해야 합니다.

    Args:
        user_id: 사용자 ID
        title: 회의 제목
        attendees: 참석자 (쉼표 구분)
        file: 음성 파일

    Returns:
        생성된 회의록 정보
    """
    # 사용자 존재 확인
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 파일 확장자 확인
    file_ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    allowed_extensions = ["mp3", "wav", "m4a", "ogg", "webm", "mp4"]

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 파일 형식입니다. 지원 형식: {', '.join(allowed_extensions)}"
        )

    # 파일 저장
    file_id = str(uuid.uuid4())
    file_name = f"{file_id}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)

    contents = await file.read()
    file_size = len(contents)

    with open(file_path, "wb") as f:
        f.write(contents)

    # 회의록 생성 (처리 대기 상태)
    new_meeting = models.MeetingNote(
        user_id=user_id,
        title=title,
        file_name=file.filename,
        file_ext=file_ext,
        file_size=file_size,
        transcript="",  # STT 변환 후 채워짐
        summary="",     # LLM 요약 후 채워짐
        duration=0,     # STT 변환 후 계산됨
        attendees=attendees,
        task_id=file_id,  # 파일 식별용 UUID (삭제 시 사용)
        status="QUEUED"
    )

    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

    # Celery STT 작업 발행 (PC2 Worker의 gpu_stt 큐로 전달)
    stt_task_id = None
    stt_task = _get_stt_task()
    if stt_task:
        try:
            audio_filename = file_name  # {uuid}.{ext} 형식
            result = stt_task.delay(
                meeting_id=new_meeting.id,
                audio_filename=audio_filename,
                language="ko"
            )
            stt_task_id = result.id
            print(f"[Meeting Upload] STT 작업 발행 완료 (Celery Task ID: {stt_task_id})")
        except Exception as e:
            print(f"[Meeting Upload] STT 작업 발행 실패: {e}")
    else:
        print("[Meeting Upload] Celery Worker 미연결 (STT 비활성)")

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=user_id,
        action="MEETING_UPLOAD_SUCCESS",
        target_id=new_meeting.id,
        target_type="MEETING",
        ip_addr=request.client.host,
        details=f"회의록 파일 업로드: {title} ({file.filename})"
    )

    return {
        "message": "파일이 업로드되었습니다. 음성 변환 처리 중입니다.",
        "meeting": {
            "id": new_meeting.id,
            "title": new_meeting.title,
            "status": new_meeting.status,
            "taskId": new_meeting.task_id,
            "sttTaskId": stt_task_id
        }
    }


# ============================================================================
# 5. 회의록 수정
# ============================================================================

@router.put("/{meeting_id}")
def update_meeting(meeting_id: int, data: MeetingUpdate, db: Session = Depends(get_db)):
    """
    회의록을 수정합니다.

    Args:
        meeting_id: 수정할 회의록 ID
        data: 수정할 데이터

    Returns:
        수정된 회의록 정보
    """
    meeting = db.query(models.MeetingNote).filter(models.MeetingNote.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의록을 찾을 수 없습니다.")

    # 필드별 업데이트
    if data.title is not None:
        meeting.title = data.title
    if data.attendees is not None:
        meeting.attendees = data.attendees
    if data.summary is not None:
        meeting.summary = data.summary

    db.commit()
    db.refresh(meeting)

    return {
        "message": "회의록이 수정되었습니다.",
        "meeting": {
            "id": meeting.id,
            "title": meeting.title,
            "attendees": meeting.attendees,
            "updatedAt": meeting.updated_at.strftime("%Y-%m-%d %H:%M") if meeting.updated_at else None
        }
    }


# ============================================================================
# 6. 회의록 삭제
# ============================================================================

@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: int, request: Request, user_id: int = None, db: Session = Depends(get_db)):
    """
    회의록을 삭제합니다.

    Args:
        meeting_id: 삭제할 회의록 ID

    Returns:
        삭제 완료 메시지
    """
    meeting = db.query(models.MeetingNote).filter(models.MeetingNote.id == meeting_id).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="회의록을 찾을 수 없습니다.")

    meeting_title = meeting.title
    meeting_user_id = user_id or meeting.user_id

    # 파일도 삭제 (있는 경우)
    if meeting.task_id:
        file_path = os.path.join(UPLOAD_DIR, f"{meeting.task_id}.{meeting.file_ext}")
        if os.path.exists(file_path):
            os.remove(file_path)

    db.delete(meeting)
    db.commit()

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=meeting_user_id,
        action="MEETING_DELETE_SUCCESS",
        target_id=meeting_id,
        target_type="MEETING",
        ip_addr=request.client.host,
        details=f"회의록 삭제: {meeting_title}"
    )

    return {"message": "회의록이 삭제되었습니다."}


# ============================================================================
# 7. STT 진행률 조회 (프론트엔드 폴링)
# ============================================================================

@router.get("/status/{task_id}")
def get_stt_status(task_id: str):
    """
    STT 음성 변환 작업의 진행률을 조회합니다.

    Args:
        task_id: Celery Task ID

    Returns:
        진행률 정보 (status, progress, message)
    """
    redis_key = f"stt_task:{task_id}:progress"

    try:
        cached_data = redis_client.get(redis_key)
        if cached_data:
            return json.loads(cached_data)
        else:
            return {
                "status": "pending",
                "progress": 0,
                "message": "작업 대기 중..."
            }
    except Exception as e:
        print(f"[STT Status] Redis 조회 실패: {e}")
        return {
            "status": "unknown",
            "progress": 0,
            "message": "상태 조회 실패"
        }


# ============================================================================
# 8. 내부 API: PC2 Worker 오디오 파일 다운로드
# ============================================================================

@router.get("/internal/file/{filename}")
def internal_get_audio_file(filename: str):
    """
    PC2 Worker가 오디오 파일을 HTTP로 다운로드하는 내부 API

    PC2 Worker가 음성을 텍스트로 변환하기 위해 PC1에서 오디오 파일을 가져갈 때 사용합니다.

    Args:
        filename: 저장된 오디오 파일명 ({uuid}.{ext} 형식)
    """
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"파일을 찾을 수 없습니다: {filename}")

    return FileResponse(path=file_path)


