"""
schedule_router.py - 일정 관리 API

일정 CRUD 및 캘린더 데이터 제공 API:
1. 월별 일정 조회 (캘린더용)
2. 특정 날짜 일정 조회
3. 일정 생성
4. 일정 수정
5. 일정 삭제
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, extract
from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app import models
from app.crud import create_system_log

router = APIRouter(
    prefix="/schedule",
    tags=["Schedule"]
)


# ============================================================================
# Pydantic 스키마
# ============================================================================

class ScheduleCreate(BaseModel):
    """일정 생성 요청 스키마"""
    user_id: int
    title: str
    content: Optional[str] = None
    schedule_date: str  # YYYY-MM-DD
    start_time: str     # HH:MM
    end_time: str       # HH:MM
    category: Optional[str] = "일반"


class ScheduleUpdate(BaseModel):
    """일정 수정 요청 스키마"""
    title: Optional[str] = None
    content: Optional[str] = None
    schedule_date: Optional[str] = None  # YYYY-MM-DD
    start_time: Optional[str] = None     # HH:MM
    end_time: Optional[str] = None       # HH:MM
    category: Optional[str] = None


# ============================================================================
# 1. 월별 일정 조회 (캘린더용)
# ============================================================================

@router.get("/monthly/{user_id}")
def get_monthly_schedules(
    user_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    특정 월의 일정 목록을 반환합니다 (캘린더 표시용).

    Args:
        user_id: 사용자 ID
        year: 연도 (예: 2024)
        month: 월 (1-12)

    Returns:
        해당 월의 모든 일정 + 날짜별 일정 수
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 해당 월의 일정 조회
    schedules = db.query(models.Schedule).filter(
        models.Schedule.user_id == user_id,
        extract('year', models.Schedule.schedule_date) == year,
        extract('month', models.Schedule.schedule_date) == month
    ).order_by(
        models.Schedule.schedule_date.asc(),
        models.Schedule.start_time.asc()
    ).all()

    # 날짜별 일정 수 계산
    date_counts = {}
    for s in schedules:
        date_str = s.schedule_date.strftime("%Y-%m-%d")
        date_counts[date_str] = date_counts.get(date_str, 0) + 1

    # 일정 목록 변환
    schedule_list = [{
        "id": s.id,
        "title": s.title,
        "content": s.content,
        "scheduleDate": s.schedule_date.strftime("%Y-%m-%d"),
        "startTime": s.start_time.strftime("%H:%M"),
        "endTime": s.end_time.strftime("%H:%M"),
        "category": s.category
    } for s in schedules]

    return {
        "year": year,
        "month": month,
        "schedules": schedule_list,
        "dateCounts": date_counts,
        "totalCount": len(schedules)
    }


# ============================================================================
# 2. 특정 날짜 일정 조회
# ============================================================================

@router.get("/daily/{user_id}")
def get_daily_schedules(
    user_id: int,
    date_str: str,  # YYYY-MM-DD
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 일정 목록을 반환합니다.

    Args:
        user_id: 사용자 ID
        date_str: 조회할 날짜 (YYYY-MM-DD)

    Returns:
        해당 날짜의 일정 목록
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    schedules = db.query(models.Schedule).filter(
        models.Schedule.user_id == user_id,
        models.Schedule.schedule_date == target_date
    ).order_by(models.Schedule.start_time.asc()).all()

    return {
        "date": date_str,
        "totalCount": len(schedules),
        "schedules": [{
            "id": s.id,
            "title": s.title,
            "content": s.content,
            "startTime": s.start_time.strftime("%H:%M"),
            "endTime": s.end_time.strftime("%H:%M"),
            "category": s.category,
            "createdAt": s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else None
        } for s in schedules]
    }


# ============================================================================
# 3. 일정 상세 조회
# ============================================================================

@router.get("/{schedule_id}")
def get_schedule_detail(schedule_id: int, db: Session = Depends(get_db)):
    """
    특정 일정의 상세 정보를 반환합니다.

    Args:
        schedule_id: 일정 ID

    Returns:
        일정 상세 정보
    """
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")

    return {
        "id": schedule.id,
        "userId": schedule.user_id,
        "title": schedule.title,
        "content": schedule.content,
        "scheduleDate": schedule.schedule_date.strftime("%Y-%m-%d"),
        "startTime": schedule.start_time.strftime("%H:%M"),
        "endTime": schedule.end_time.strftime("%H:%M"),
        "category": schedule.category,
        "createdAt": schedule.created_at.strftime("%Y-%m-%d %H:%M") if schedule.created_at else None,
        "updatedAt": schedule.updated_at.strftime("%Y-%m-%d %H:%M") if schedule.updated_at else None
    }


# ============================================================================
# 4. 일정 생성
# ============================================================================

@router.post("/")
def create_schedule(data: ScheduleCreate, request: Request, db: Session = Depends(get_db)):
    """
    새로운 일정을 생성합니다.

    Args:
        data: 일정 생성 데이터

    Returns:
        생성된 일정 정보
    """
    # 사용자 존재 확인
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 날짜/시간 파싱
    try:
        schedule_date = datetime.strptime(data.schedule_date, "%Y-%m-%d").date()
        start_time = datetime.strptime(data.start_time, "%H:%M").time()
        end_time = datetime.strptime(data.end_time, "%H:%M").time()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 또는 시간 형식이 올바르지 않습니다.")

    # 시작 시간이 종료 시간보다 늦은 경우 체크
    if start_time >= end_time:
        raise HTTPException(status_code=400, detail="종료 시간은 시작 시간보다 늦어야 합니다.")

    # 일정 생성
    new_schedule = models.Schedule(
        user_id=data.user_id,
        title=data.title,
        content=data.content,
        schedule_date=schedule_date,
        start_time=start_time,
        end_time=end_time,
        category=data.category or "일반"
    )

    db.add(new_schedule)
    db.commit()
    db.refresh(new_schedule)

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=data.user_id,
        action="SCHEDULE_CREATE_SUCCESS",
        target_id=new_schedule.id,
        target_type="SCHEDULE",
        ip_addr=request.client.host,
        details=f"일정 생성: {new_schedule.title} ({data.schedule_date})"
    )

    return {
        "message": "일정이 등록되었습니다.",
        "schedule": {
            "id": new_schedule.id,
            "title": new_schedule.title,
            "scheduleDate": new_schedule.schedule_date.strftime("%Y-%m-%d"),
            "startTime": new_schedule.start_time.strftime("%H:%M"),
            "endTime": new_schedule.end_time.strftime("%H:%M"),
            "category": new_schedule.category
        }
    }


# ============================================================================
# 5. 일정 수정
# ============================================================================

@router.put("/{schedule_id}")
def update_schedule(schedule_id: int, data: ScheduleUpdate, request: Request, user_id: int = None, db: Session = Depends(get_db)):
    """
    기존 일정을 수정합니다.

    Args:
        schedule_id: 수정할 일정 ID
        data: 수정할 데이터

    Returns:
        수정된 일정 정보
    """
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")

    schedule_user_id = user_id or schedule.user_id

    # 필드별 업데이트
    if data.title is not None:
        schedule.title = data.title
    if data.content is not None:
        schedule.content = data.content
    if data.category is not None:
        schedule.category = data.category

    # 날짜 업데이트
    if data.schedule_date is not None:
        try:
            schedule.schedule_date = datetime.strptime(data.schedule_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")

    # 시간 업데이트
    if data.start_time is not None:
        try:
            schedule.start_time = datetime.strptime(data.start_time, "%H:%M").time()
        except ValueError:
            raise HTTPException(status_code=400, detail="시작 시간 형식이 올바르지 않습니다. (HH:MM)")

    if data.end_time is not None:
        try:
            schedule.end_time = datetime.strptime(data.end_time, "%H:%M").time()
        except ValueError:
            raise HTTPException(status_code=400, detail="종료 시간 형식이 올바르지 않습니다. (HH:MM)")

    # 시간 유효성 검사
    if schedule.start_time >= schedule.end_time:
        raise HTTPException(status_code=400, detail="종료 시간은 시작 시간보다 늦어야 합니다.")

    db.commit()
    db.refresh(schedule)

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=schedule_user_id,
        action="SCHEDULE_UPDATE_SUCCESS",
        target_id=schedule.id,
        target_type="SCHEDULE",
        ip_addr=request.client.host,
        details=f"일정 수정: {schedule.title}"
    )

    return {
        "message": "일정이 수정되었습니다.",
        "schedule": {
            "id": schedule.id,
            "title": schedule.title,
            "content": schedule.content,
            "scheduleDate": schedule.schedule_date.strftime("%Y-%m-%d"),
            "startTime": schedule.start_time.strftime("%H:%M"),
            "endTime": schedule.end_time.strftime("%H:%M"),
            "category": schedule.category
        }
    }


# ============================================================================
# 6. 일정 삭제
# ============================================================================

@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int, request: Request, user_id: int = None, db: Session = Depends(get_db)):
    """
    일정을 삭제합니다.

    Args:
        schedule_id: 삭제할 일정 ID

    Returns:
        삭제 완료 메시지
    """
    schedule = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다.")

    schedule_title = schedule.title
    schedule_user_id = user_id or schedule.user_id

    db.delete(schedule)
    db.commit()

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=schedule_user_id,
        action="SCHEDULE_DELETE_SUCCESS",
        target_id=schedule_id,
        target_type="SCHEDULE",
        ip_addr=request.client.host,
        details=f"일정 삭제: {schedule_title}"
    )

    return {"message": "일정이 삭제되었습니다."}


# ============================================================================
# 7. 카테고리 목록 조회
# ============================================================================

@router.get("/categories/{user_id}")
def get_categories(user_id: int, db: Session = Depends(get_db)):
    """
    사용자가 사용한 카테고리 목록을 반환합니다.

    Returns:
        카테고리 목록
    """
    categories = db.query(models.Schedule.category).filter(
        models.Schedule.user_id == user_id
    ).distinct().all()

    category_list = [c[0] for c in categories if c[0]]

    # 기본 카테고리 추가
    default_categories = ["일반", "업무", "회의", "개인", "중요"]
    for cat in default_categories:
        if cat not in category_list:
            category_list.append(cat)

    return {"categories": sorted(category_list)}
