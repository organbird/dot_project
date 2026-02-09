"""
인증 API 라우터 - 로그인, 회원가입, 토큰 검증
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.schemas import LoginRequest, UserCreate
from app.crud import create_system_log
from app.auth import create_access_token, get_current_user
from app.utils import hash_password, verify_password

router = APIRouter()


@router.post("/api/login")
def login(req_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """사용자 로그인 (JWT 토큰 발급)"""
    try:
        user = db.query(models.User).filter(models.User.email == req_data.email).first()

        if not user or not verify_password(req_data.password, user.password_hash):
            print(f"📡 로그인 실패 시도: {req_data.email}")
            log_user_id = user.id if user else 1
            try:
                create_system_log(
                    db, user_id=log_user_id, action="LOGIN_FAIL",
                    target_id=0, target_type="AUTH",
                    ip_addr=request.client.host,
                    details=f"로그인 실패: {req_data.email}"
                )
            except Exception as log_error:
                print(f"⚠️ 로그 기록 중 DB 에러 발생: {log_error}")
                db.rollback()
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 잘못되었습니다.")

        create_system_log(
            db, user_id=user.id, action="LOGIN_SUCCESS",
            target_id=user.id, target_type="USER",
            ip_addr=request.client.host,
            details=f"로그인 성공: {user.email}"
        )

        access_token = create_access_token(
            data={"sub": str(user.id), "email": user.email, "role": user.role}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id, "email": user.email, "name": user.name,
                "role": user.role, "dept_idx": user.dept_idx, "gender": user.gender
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ LOGIN CRITICAL ERROR: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="서버 내부 오류가 발생했습니다.")


@router.get("/api/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보 조회 (JWT 토큰 검증)"""
    return {
        "id": current_user.id, "email": current_user.email,
        "name": current_user.name, "role": current_user.role,
        "dept_idx": current_user.dept_idx, "gender": current_user.gender
    }


@router.post("/api/register")
def register(user_data: UserCreate, request: Request, db: Session = Depends(get_db)):
    """회원가입 (이메일/연락처 중복 검사 포함)"""
    existing_email = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="이미 등록된 이메일입니다.")

    if user_data.phone:
        existing_phone = db.query(models.User).filter(models.User.phone == user_data.phone).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="이미 등록된 연락처입니다.")

    new_user = models.User(
        email=user_data.email, name=user_data.name,
        password_hash=hash_password(user_data.password),
        phone=user_data.phone, dept_idx=user_data.dept_idx,
        role=user_data.role, gender=user_data.gender
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    create_system_log(
        db, user_id=new_user.id, action="REGISTER_SUCCESS",
        target_id=new_user.id, target_type="USER",
        ip_addr=request.client.host,
        details=f"신규 계정: {new_user.email}"
    )

    return {"message": "회원가입 성공"}
