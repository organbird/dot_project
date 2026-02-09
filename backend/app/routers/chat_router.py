"""
chat_router.py - 채팅 세션 관리 API

채팅 세션 CRUD 기능 제공:
1. 세션 목록 조회
2. 세션 생성
3. 세션 제목 수정
4. 세션 삭제
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
import json

from app.database import get_db
from app import models
from app.crud import create_system_log
from app.config import redis_client


router = APIRouter(
    prefix="/chat",
    tags=["Chat Session"]
)


# ============================================================================
# Pydantic 스키마
# ============================================================================

class SessionCreate(BaseModel):
    """세션 생성 요청 스키마"""
    user_id: int
    title: Optional[str] = None


class SessionUpdate(BaseModel):
    """세션 수정 요청 스키마"""
    title: str


# ============================================================================
# 1. 세션 목록 조회
# ============================================================================

@router.get("/sessions/{user_id}")
def get_user_sessions(user_id: int, db: Session = Depends(get_db)):
    """
    사용자의 채팅 세션 목록을 조회합니다.
    최신순으로 정렬되어 반환됩니다.
    """
    # 사용자 확인
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 활성 세션만 조회 (최신순)
    sessions = db.query(models.ChatSession).filter(
        models.ChatSession.user_id == user_id,
        models.ChatSession.status == "ACTIVE"
    ).order_by(desc(models.ChatSession.updated_at)).all()

    session_list = []
    for session in sessions:
        # 마지막 메시지 조회
        last_message = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == session.id
        ).order_by(desc(models.ChatMessage.created_at)).first()

        session_list.append({
            "id": session.id,
            "title": session.title,
            "lastMessage": last_message.content[:50] + "..." if last_message and last_message.content and len(last_message.content) > 50 else (last_message.content if last_message else None),
            "messageCount": db.query(models.ChatMessage).filter(
                models.ChatMessage.session_id == session.id
            ).count(),
            "createdAt": session.created_at.strftime("%Y-%m-%d %H:%M") if session.created_at else None,
            "updatedAt": session.updated_at.strftime("%Y-%m-%d %H:%M") if session.updated_at else None
        })

    return {"sessions": session_list}


# ============================================================================
# 2. 세션 생성
# ============================================================================

@router.post("/sessions")
def create_session(data: SessionCreate, request: Request, db: Session = Depends(get_db)):
    """
    새로운 채팅 세션을 생성합니다.
    """
    # 사용자 확인
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 세션 생성
    new_session = models.ChatSession(
        user_id=data.user_id,
        title=data.title or "새 대화",
        status="ACTIVE"
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=data.user_id,
        action="CHAT_CREATE_SUCCESS",
        target_id=new_session.id,
        target_type="CHAT_SESSION",
        ip_addr=request.client.host,
        details=f"채팅 세션 생성: {new_session.title}"
    )

    return {
        "message": "세션이 생성되었습니다.",
        "session": {
            "id": new_session.id,
            "title": new_session.title,
            "createdAt": new_session.created_at.strftime("%Y-%m-%d %H:%M") if new_session.created_at else None
        }
    }


# ============================================================================
# 3. 세션 상세 조회
# ============================================================================

@router.get("/sessions/detail/{session_id}")
def get_session_detail(session_id: int, db: Session = Depends(get_db)):
    """
    특정 세션의 상세 정보와 메시지를 조회합니다.
    세션 진입 시 Redis에 요약 + 최근 10개 메시지를 캐싱합니다.
    """
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    # 메시지 조회 (시간순)
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.session_id == session_id
    ).order_by(models.ChatMessage.created_at.asc()).all()

    message_list = []
    for msg in messages:
        # reference_docs가 문자열인 경우 JSON으로 파싱
        ref_docs = msg.reference_docs
        if isinstance(ref_docs, str):
            try:
                ref_docs = json.loads(ref_docs)
            except (json.JSONDecodeError, TypeError):
                ref_docs = None

        message_list.append({
            "id": msg.id,
            "role": msg.sender,
            "content": msg.content,
            "referenceDocs": ref_docs if ref_docs else [],
            "createdAt": msg.created_at.strftime("%Y-%m-%d %H:%M:%S") if msg.created_at else None
        })

    # ============================================================================
    # Redis 캐싱: 요약 + 최근 10개 메시지 저장 (재요약 기능 활성화)
    # ============================================================================
    try:
        # 최근 10개 메시지만 추출 (오래된 순서로)
        recent_messages = messages[-10:] if len(messages) > 10 else messages

        redis_messages = []
        for msg in recent_messages:
            redis_messages.append({
                "sender": msg.sender,  # "user" 또는 "assistant"
                "content": msg.content
            })

        redis_context = {
            "summary": session.current_summary,
            "messages": redis_messages
        }

        redis_key = f"session:{session_id}:context"
        redis_client.setex(
            redis_key,
            3600,  # 1시간 TTL
            json.dumps(redis_context, ensure_ascii=False)
        )

        print(f"✅ [Cache Refill] 세션 {session_id} - 요약 + 최근 10개 메시지 Redis 저장")
        print(f"📝 [Summary]: {session.current_summary}")
        print(f"📝 [Messages Count]: {len(redis_messages)}개")
    except Exception as e:
        print(f"⚠️ [Cache Refill] Redis 저장 실패: {e}")

    return {
        "session": {
            "id": session.id,
            "title": session.title,
            "status": session.status,
            "createdAt": session.created_at.strftime("%Y-%m-%d %H:%M") if session.created_at else None,
            "updatedAt": session.updated_at.strftime("%Y-%m-%d %H:%M") if session.updated_at else None
        },
        "messages": message_list
    }


# ============================================================================
# 4. 세션 제목 수정
# ============================================================================

@router.put("/sessions/{session_id}")
def update_session(session_id: int, data: SessionUpdate, db: Session = Depends(get_db)):
    """
    세션 제목을 수정합니다.
    """
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    session.title = data.title
    db.commit()
    db.refresh(session)

    return {
        "message": "세션이 수정되었습니다.",
        "session": {
            "id": session.id,
            "title": session.title
        }
    }


# ============================================================================
# 5. 세션 삭제 (소프트 삭제 - 상태 변경)
# ============================================================================

@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, request: Request, user_id: int = None, db: Session = Depends(get_db)):
    """
    세션을 삭제합니다 (상태를 ARCHIVED로 변경).
    """
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    session_title = session.title
    session_user_id = user_id or session.user_id

    # 소프트 삭제 (상태 변경)
    session.status = "ARCHIVED"
    db.commit()

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=session_user_id,
        action="CHAT_DELETE_SUCCESS",
        target_id=session_id,
        target_type="CHAT_SESSION",
        ip_addr=request.client.host,
        details=f"채팅 세션 삭제: {session_title}"
    )

    return {"message": "세션이 삭제되었습니다."}


# ============================================================================
# 6. 세션 메시지 전체 삭제 (대화 내역 초기화)
# ============================================================================

@router.delete("/sessions/{session_id}/messages")
def clear_session_messages(session_id: int, db: Session = Depends(get_db)):
    """
    세션의 모든 메시지를 삭제합니다.
    """
    session = db.query(models.ChatSession).filter(
        models.ChatSession.id == session_id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    # 메시지 삭제
    db.query(models.ChatMessage).filter(
        models.ChatMessage.session_id == session_id
    ).delete()

    db.commit()

    return {"message": "대화 내역이 초기화되었습니다."}
