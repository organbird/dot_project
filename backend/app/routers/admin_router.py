"""
관리자 API 라우터 - 부서/사용자 관리, 시스템 로그
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models
from app.schemas import DeptCreate, UserUpdateAdmin, UserUpdateDept
from app.crud import create_system_log
from app.utils import hash_password

router = APIRouter()


# =====================================================================
# 부서 관리
# =====================================================================

@router.get("/api/depts")
def get_depts(db: Session = Depends(get_db)):
    """전체 부서 목록 조회"""
    return db.query(models.Dept).all()


@router.post("/api/depts")
def create_dept(dept_data: DeptCreate, db: Session = Depends(get_db)):
    """부서 생성 (중복 검사 포함)"""
    existing = db.query(models.Dept).filter(models.Dept.dept_name == dept_data.dept_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 부서입니다.")

    new_dept = models.Dept(dept_name=dept_data.dept_name)
    db.add(new_dept)
    db.commit()
    return new_dept


@router.delete("/api/depts/{dept_id}")
def delete_dept(dept_id: int, db: Session = Depends(get_db)):
    """부서 삭제 (소속 직원 있으면 불가)"""
    dept = db.query(models.Dept).filter(models.Dept.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="부서를 찾을 수 없습니다.")
    if db.query(models.User).filter(models.User.dept_idx == dept_id).count() > 0:
        raise HTTPException(status_code=400, detail="소속 직원이 있는 부서는 삭제할 수 없습니다.")

    db.delete(dept)
    db.commit()
    return {"message": "부서 삭제 완료"}


# =====================================================================
# 사용자 관리
# =====================================================================

@router.patch("/api/admin/users/update")
def update_user_info(data: UserUpdateAdmin, request: Request, db: Session = Depends(get_db)):
    """관리자용 사용자 정보 수정 (권한/비밀번호)"""
    admin_id = 1

    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="해당 사용자를 찾을 수 없습니다.")

    if data.new_role:
        old_role = user.role
        user.role = data.new_role
        create_system_log(
            db, user_id=admin_id, action="USER_ROLE_UPDATED",
            target_id=user.id, target_type="USER",
            ip_addr=request.client.host,
            details=f"권한 변경: {old_role} -> {data.new_role} ({user.email})"
        )

    if data.new_password:
        user.password_hash = hash_password(data.new_password)
        create_system_log(
            db, user_id=admin_id, action="USER_PWD_RESET",
            target_id=user.id, target_type="USER",
            ip_addr=request.client.host,
            details=f"비밀번호 강제 초기화: {user.email}"
        )

    db.commit()
    return {"message": "사용자 정보가 업데이트되었습니다."}


@router.get("/api/admin/depts/{dept_id}/users")
def get_dept_users(dept_id: int, db: Session = Depends(get_db)):
    """특정 부서 소속 사용자 목록"""
    users = db.query(models.User).filter(models.User.dept_idx == dept_id).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role} for u in users]


@router.get("/api/admin/dept-distribution")
def get_dept_distribution(db: Session = Depends(get_db)):
    """부서별 직원 수 통계"""
    results = db.query(
        models.Dept.dept_name.label("name"),
        func.count(models.User.id).label("value")
    ).outerjoin(
        models.User, models.User.dept_idx == models.Dept.id
    ).group_by(models.Dept.dept_name).all()

    return [{"name": r.name, "value": r.value} for r in results]


@router.get("/api/admin/dept-activity")
def get_dept_activity(db: Session = Depends(get_db)):
    """부서별 활동량(로그 수) 통계"""
    results = db.query(
        models.Dept.dept_name.label("name"),
        func.count(models.SystemLog.id).label("count")
    ).outerjoin(
        models.User, models.User.dept_idx == models.Dept.id
    ).outerjoin(
        models.SystemLog, models.SystemLog.user_id == models.User.id
    ).group_by(models.Dept.dept_name).all()

    return [{"name": r.name, "count": r.count} for r in results]


@router.get("/api/admin/users")
def get_all_users(db: Session = Depends(get_db)):
    """전체 사용자 목록"""
    users = db.query(models.User).all()
    return [{"id": u.id, "email": u.email, "name": u.name, "role": u.role} for u in users]


# =====================================================================
# 시스템 로그
# =====================================================================

@router.get("/api/admin/logs")
def get_system_logs(
    page: int = 1, size: int = 10,
    q: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """시스템 로그 조회 (페이징 + 검색)"""
    query = db.query(
        models.SystemLog,
        models.User.name.label("user_name"),
        models.User.email.label("user_email")
    ).outerjoin(models.User, models.SystemLog.user_id == models.User.id)

    if q:
        search_filter = f"%{q}%"
        query = query.filter(
            (models.User.name.like(search_filter)) |
            (models.User.email.like(search_filter)) |
            (models.SystemLog.action.like(search_filter)) |
            (models.SystemLog.details.like(search_filter))
        )

    total_count = query.count()
    logs = query.order_by(models.SystemLog.created_at.desc()) \
        .offset((page - 1) * size).limit(size).all()

    log_list = [{
        "id": log.SystemLog.id,
        "user_name": log.user_name or "SYSTEM",
        "user_email": log.user_email or "-",
        "action": log.SystemLog.action,
        "details": log.SystemLog.details,
        "ip_addr": log.SystemLog.ip_addr,
        "target_type": log.SystemLog.target_type,
        "target_id": log.SystemLog.target_id,
        "created_at": log.SystemLog.created_at.strftime("%Y-%m-%d %H:%M:%S")
    } for log in logs]

    return {
        "items": log_list, "total": total_count,
        "page": page, "size": size,
        "total_pages": (total_count + size - 1) // size if total_count > 0 else 1
    }


@router.patch("/api/admin/users/move-dept")
def move_user_department(data: UserUpdateDept, request: Request, db: Session = Depends(get_db)):
    """사용자 부서 이동"""
    admin_id = 1

    try:
        user = db.query(models.User).filter(models.User.id == data.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="사용자 없음")

        new_dept = db.query(models.Dept).filter(models.Dept.id == data.new_dept_idx).first()
        if not new_dept:
            raise HTTPException(status_code=400, detail="부서 오류")

        user.dept_idx = data.new_dept_idx
        db.commit()

        create_system_log(
            db, user_id=admin_id, action="USER_MOVE_SUCCESS",
            target_id=user.id, target_type="USER",
            ip_addr=request.client.host,
            details=f"부서 이동: {new_dept.dept_name}"
        )

        return {"message": "이동 완료"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
