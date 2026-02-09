"""
user_router.py - 사용자 홈페이지 및 마이페이지 API
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, date, timedelta
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app import models
from app.utils import format_file_size, format_duration, verify_password, hash_password


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

router = APIRouter(prefix="/user", tags=["User Home"])


@router.get("/{user_id}/stats")
def get_user_stats(user_id: int, db: Session = Depends(get_db)):
    """사용자 활동 통계 (채팅, 문서, 이미지, 일정 수)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    today = date.today()
    return {
        "chatCount": db.query(models.ChatSession).filter(models.ChatSession.user_id == user_id).count(),
        "documentCount": db.query(models.Document).filter(models.Document.user_id == user_id).count(),
        "imageCount": db.query(models.GeneratedImage).filter(models.GeneratedImage.user_id == user_id).count(),
        "scheduleCount": db.query(models.Schedule).filter(
            models.Schedule.user_id == user_id, models.Schedule.schedule_date == today
        ).count()
    }


@router.get("/{user_id}/recent-chats")
def get_recent_chats(user_id: int, limit: int = 5, db: Session = Depends(get_db)):
    """최근 AI 대화 세션 목록"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    sessions = db.query(models.ChatSession).filter(
        models.ChatSession.user_id == user_id
    ).order_by(desc(models.ChatSession.updated_at)).limit(limit).all()

    result = []
    for session in sessions:
        last_message = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == session.id
        ).order_by(desc(models.ChatMessage.created_at)).first()

        message_count = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == session.id
        ).count()

        result.append({
            "id": session.id,
            "title": session.title,
            "preview": last_message.content[:50] + "..." if last_message and last_message.content and len(last_message.content) > 50 else (last_message.content if last_message else ""),
            "time": format_relative_time(session.updated_at),
            "messageCount": message_count,
            "status": session.status
        })

    return result


@router.get("/{user_id}/recent-documents")
def get_recent_documents(user_id: int, limit: int = 5, db: Session = Depends(get_db)):
    """최근 문서 목록"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    documents = db.query(models.Document).filter(
        models.Document.user_id == user_id
    ).order_by(desc(models.Document.created_at)).limit(limit).all()

    return [{
        "id": doc.id,
        "title": doc.title,
        "category": doc.category,
        "fileName": doc.file_name,
        "fileExt": doc.file_ext,
        "fileSize": format_file_size(doc.file_size),
        "date": doc.created_at.strftime("%Y-%m-%d"),
        "status": doc.status
    } for doc in documents]


@router.get("/{user_id}/recent-meetings")
def get_recent_meetings(user_id: int, limit: int = 5, db: Session = Depends(get_db)):
    """최근 회의록 목록"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    meetings = db.query(models.MeetingNote).filter(
        models.MeetingNote.user_id == user_id
    ).order_by(desc(models.MeetingNote.created_at)).limit(limit).all()

    return [{
        "id": meeting.id,
        "title": meeting.title,
        "duration": format_duration(meeting.duration, compact=True),
        "attendees": meeting.attendees,
        "summary": meeting.summary[:100] + "..." if len(meeting.summary) > 100 else meeting.summary,
        "date": meeting.created_at.strftime("%Y-%m-%d"),
        "status": meeting.status
    } for meeting in meetings]


@router.get("/{user_id}/recent-images")
def get_recent_images(user_id: int, limit: int = 5, db: Session = Depends(get_db)):
    """최근 생성 이미지 목록"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    images = db.query(models.GeneratedImage).filter(
        models.GeneratedImage.user_id == user_id
    ).order_by(desc(models.GeneratedImage.created_at)).limit(limit).all()

    return [{
        "id": img.id,
        "prompt": img.prompt[:50] + "..." if len(img.prompt) > 50 else img.prompt,
        "imgFile": img.img_file,
        "imgExt": img.img_ext,
        "imgSize": format_file_size(img.img_size),
        "date": img.created_at.strftime("%Y-%m-%d")
    } for img in images]


@router.get("/{user_id}/schedules")
def get_user_schedules(user_id: int, start_date: Optional[str] = None,
                       end_date: Optional[str] = None, limit: int = 10,
                       db: Session = Depends(get_db)):
    """사용자 일정 목록 (날짜 필터 지원)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    query = db.query(models.Schedule).filter(models.Schedule.user_id == user_id)
    if start_date:
        query = query.filter(models.Schedule.schedule_date >= start_date)
    if end_date:
        query = query.filter(models.Schedule.schedule_date <= end_date)

    schedules = query.order_by(
        models.Schedule.schedule_date.asc(), models.Schedule.start_time.asc()
    ).limit(limit).all()

    return [{
        "id": s.id, "title": s.title, "content": s.content,
        "scheduleDate": s.schedule_date.strftime("%Y-%m-%d"),
        "startTime": s.start_time.strftime("%H:%M"),
        "endTime": s.end_time.strftime("%H:%M"),
        "category": s.category,
        "createdAt": s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else None
    } for s in schedules]


@router.get("/{user_id}/schedules/today")
def get_today_schedules(user_id: int, db: Session = Depends(get_db)):
    """사용자 오늘 일정 목록"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    today = date.today()
    schedules = db.query(models.Schedule).filter(
        models.Schedule.user_id == user_id, models.Schedule.schedule_date == today
    ).order_by(models.Schedule.start_time.asc()).all()

    return [{
        "id": s.id, "title": s.title, "content": s.content,
        "startTime": s.start_time.strftime("%H:%M"),
        "endTime": s.end_time.strftime("%H:%M"),
        "category": s.category
    } for s in schedules]


@router.get("/{user_id}/recent-schedules")
def get_recent_schedules(user_id: int, limit: int = 5, db: Session = Depends(get_db)):
    """다가오는 일정 목록 (오늘 이후)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    today = date.today()
    schedules = db.query(models.Schedule).filter(
        models.Schedule.user_id == user_id, models.Schedule.schedule_date >= today
    ).order_by(
        models.Schedule.schedule_date.asc(), models.Schedule.start_time.asc()
    ).limit(limit).all()

    return [{
        "id": s.id, "title": s.title, "content": s.content,
        "scheduleDate": s.schedule_date.strftime("%Y-%m-%d"),
        "startTime": s.start_time.strftime("%H:%M"),
        "endTime": s.end_time.strftime("%H:%M"),
        "category": s.category,
        "daysUntil": (s.schedule_date - today).days
    } for s in schedules]


@router.get("/{user_id}/profile")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    """사용자 프로필 정보 (부서명 포함)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    dept = db.query(models.Dept).filter(models.Dept.id == user.dept_idx).first()
    return {
        "id": user.id, "email": user.email, "name": user.name,
        "role": user.role, "phone": user.phone,
        "deptIdx": user.dept_idx, "deptName": dept.dept_name if dept else "미지정",
        "createdAt": user.created_at.strftime("%Y-%m-%d") if user.created_at else None
    }


@router.get("/{user_id}/home-data")
def get_home_data(user_id: int, db: Session = Depends(get_db)):
    """HomePage 통합 데이터 (통계 + 최근 대화 + 최근 문서 + 프로필)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    today = date.today()
    stats = {
        "chatCount": db.query(models.ChatSession).filter(models.ChatSession.user_id == user_id).count(),
        "documentCount": db.query(models.Document).filter(models.Document.user_id == user_id).count(),
        "imageCount": db.query(models.GeneratedImage).filter(models.GeneratedImage.user_id == user_id).count(),
        "scheduleCount": db.query(models.Schedule).filter(
            models.Schedule.user_id == user_id, models.Schedule.schedule_date == today
        ).count()
    }

    recent_sessions = db.query(models.ChatSession).filter(
        models.ChatSession.user_id == user_id, models.ChatSession.status == "ACTIVE"
    ).order_by(desc(models.ChatSession.updated_at)).limit(3).all()

    recent_chats = []
    for session in recent_sessions:
        last_msg = db.query(models.ChatMessage).filter(
            models.ChatMessage.session_id == session.id
        ).order_by(desc(models.ChatMessage.created_at)).first()

        recent_chats.append({
            "id": session.id, "title": session.title,
            "preview": (last_msg.content[:50] + "...") if last_msg and last_msg.content and len(last_msg.content) > 50 else (last_msg.content if last_msg else ""),
            "time": format_relative_time(session.updated_at)
        })

    recent_docs = db.query(models.Document).filter(
        models.Document.user_id == user_id
    ).order_by(desc(models.Document.created_at)).limit(3).all()

    recent_documents = [{
        "id": doc.id, "title": doc.title, "type": doc.file_ext,
        "date": doc.created_at.strftime("%Y-%m-%d")
    } for doc in recent_docs]

    dept = db.query(models.Dept).filter(models.Dept.id == user.dept_idx).first()
    profile = {
        "id": user.id, "email": user.email, "name": user.name,
        "role": user.role, "deptIdx": user.dept_idx,
        "deptName": dept.dept_name if dept else "미지정"
    }

    return {"stats": stats, "recentChats": recent_chats, "recentDocuments": recent_documents, "profile": profile}


def format_relative_time(dt: datetime) -> str:
    """datetime을 상대 시간 문자열로 변환 (예: '5분 전', '어제')"""
    if dt is None:
        return ""
    seconds = (datetime.now() - dt).total_seconds()
    if seconds < 60:
        return "방금 전"
    elif seconds < 3600:
        return f"{int(seconds / 60)}분 전"
    elif seconds < 86400:
        return f"{int(seconds / 3600)}시간 전"
    elif seconds < 172800:
        return "어제"
    elif seconds < 604800:
        return f"{int(seconds / 86400)}일 전"
    return dt.strftime("%Y-%m-%d")


@router.put("/{user_id}/profile")
def update_user_profile(user_id: int, data: ProfileUpdate, db: Session = Depends(get_db)):
    """프로필 수정 (이름, 전화번호)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if data.name is not None:
        user.name = data.name
    if data.phone is not None:
        existing = db.query(models.User).filter(
            models.User.phone == data.phone, models.User.id != user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="이미 사용 중인 전화번호입니다.")
        user.phone = data.phone

    db.commit()
    db.refresh(user)

    dept = db.query(models.Dept).filter(models.Dept.id == user.dept_idx).first()
    return {
        "message": "프로필이 수정되었습니다.",
        "profile": {
            "id": user.id, "email": user.email, "name": user.name,
            "phone": user.phone, "role": user.role,
            "deptIdx": user.dept_idx, "deptName": dept.dept_name if dept else "미지정"
        }
    }


@router.put("/{user_id}/password")
def change_password(user_id: int, data: PasswordChange, db: Session = Depends(get_db)):
    """비밀번호 변경"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 일치하지 않습니다.")

    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="새 비밀번호는 4자 이상이어야 합니다.")

    user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "비밀번호가 변경되었습니다."}


@router.get("/{user_id}/mypage-data")
def get_mypage_data(user_id: int, db: Session = Depends(get_db)):
    """마이페이지 통합 데이터 (프로필 + 통계 + 월간 활동)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    dept = db.query(models.Dept).filter(models.Dept.id == user.dept_idx).first()
    profile = {
        "id": user.id, "email": user.email, "name": user.name,
        "phone": user.phone, "role": user.role,
        "roleText": "관리자" if user.role == "ADMIN" else "일반 사용자",
        "deptIdx": user.dept_idx, "deptName": dept.dept_name if dept else "미지정",
        "createdAt": user.created_at.strftime("%Y-%m-%d") if user.created_at else None,
        "memberSince": _calculate_member_days(user.created_at)
    }

    today = date.today()
    stats = {
        "totalChats": db.query(models.ChatSession).filter(models.ChatSession.user_id == user_id).count(),
        "totalDocuments": db.query(models.Document).filter(models.Document.user_id == user_id).count(),
        "totalImages": db.query(models.GeneratedImage).filter(models.GeneratedImage.user_id == user_id).count(),
        "totalMeetings": db.query(models.MeetingNote).filter(models.MeetingNote.user_id == user_id).count(),
        "totalSchedules": db.query(models.Schedule).filter(models.Schedule.user_id == user_id).count(),
        "todaySchedules": db.query(models.Schedule).filter(
            models.Schedule.user_id == user_id, models.Schedule.schedule_date == today
        ).count()
    }

    first_day_of_month = today.replace(day=1)
    monthly_activity = {
        "chats": db.query(models.ChatSession).filter(
            models.ChatSession.user_id == user_id, models.ChatSession.created_at >= first_day_of_month
        ).count(),
        "documents": db.query(models.Document).filter(
            models.Document.user_id == user_id, models.Document.created_at >= first_day_of_month
        ).count(),
        "images": db.query(models.GeneratedImage).filter(
            models.GeneratedImage.user_id == user_id, models.GeneratedImage.created_at >= first_day_of_month
        ).count(),
        "meetings": db.query(models.MeetingNote).filter(
            models.MeetingNote.user_id == user_id, models.MeetingNote.created_at >= first_day_of_month
        ).count()
    }

    return {"profile": profile, "stats": stats, "monthlyActivity": monthly_activity}


def _calculate_member_days(created_at: datetime) -> str:
    """가입 후 경과 일수 계산"""
    if not created_at:
        return "알 수 없음"
    days = (datetime.now() - created_at).days
    if days == 0:
        return "오늘 가입"
    elif days < 30:
        return f"{days}일째 회원"
    elif days < 365:
        return f"{days // 30}개월째 회원"
    return f"{days // 365}년째 회원"
