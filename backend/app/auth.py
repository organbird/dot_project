"""
auth.py - JWT 인증 모듈

JWT 토큰 생성, 검증 및 사용자 인증을 위한 유틸리티 함수들을 제공합니다.

주요 기능:
    - JWT 액세스 토큰 생성
    - JWT 토큰 검증 및 디코딩
    - FastAPI 의존성 주입용 현재 사용자 추출 함수
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

# ============================================================================
# JWT 설정
# ============================================================================

# 비밀 키 (환경 변수에서 가져오거나 기본값 사용)
# 프로덕션에서는 반드시 환경 변수로 안전한 키를 설정해야 함
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production-aidot-2026")

# 토큰 암호화 알고리즘
ALGORITHM = "HS256"

# 토큰 만료 시간 (분 단위, 기본 24시간)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

# HTTPBearer 스키마 (Authorization: Bearer <token>)
security = HTTPBearer()


# ============================================================================
# JWT 토큰 생성
# ============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT 액세스 토큰을 생성합니다.

    Args:
        data (dict): 토큰에 포함할 데이터 (보통 user_id, email 등)
        expires_delta (timedelta, optional): 토큰 만료 시간.
            기본값은 ACCESS_TOKEN_EXPIRE_MINUTES

    Returns:
        str: 인코딩된 JWT 토큰 문자열

    Example:
        token = create_access_token({"sub": str(user.id), "email": user.email})
    """
    to_encode = data.copy()

    # 만료 시간 설정
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})

    # JWT 토큰 생성
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt


# ============================================================================
# JWT 토큰 검증
# ============================================================================

def verify_token(token: str) -> dict:
    """
    JWT 토큰을 검증하고 페이로드를 반환합니다.

    Args:
        token (str): 검증할 JWT 토큰

    Returns:
        dict: 토큰 페이로드 (user_id, email 등)

    Raises:
        HTTPException(401): 토큰이 유효하지 않거나 만료된 경우
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================================
# FastAPI 의존성 - 현재 사용자 추출
# ============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """
    현재 인증된 사용자를 반환합니다.

    FastAPI 의존성 주입으로 사용되며, Authorization 헤더에서
    Bearer 토큰을 추출하여 사용자를 인증합니다.

    Args:
        credentials: HTTP Authorization 헤더의 Bearer 토큰
        db: 데이터베이스 세션

    Returns:
        models.User: 인증된 사용자 객체

    Raises:
        HTTPException(401): 토큰이 없거나 유효하지 않은 경우
        HTTPException(401): 사용자를 찾을 수 없는 경우

    Example:
        @app.get("/protected")
        def protected_route(current_user: models.User = Depends(get_current_user)):
            return {"user_id": current_user.id}
    """
    token = credentials.credentials

    # 토큰 검증
    payload = verify_token(token)

    # 사용자 ID 추출
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에서 사용자 정보를 찾을 수 없습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 데이터베이스에서 사용자 조회
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False)),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """
    현재 인증된 사용자를 반환합니다 (선택적).

    토큰이 없어도 에러를 발생시키지 않고 None을 반환합니다.
    인증이 선택적인 엔드포인트에서 사용합니다.

    Args:
        credentials: HTTP Authorization 헤더의 Bearer 토큰 (선택적)
        db: 데이터베이스 세션

    Returns:
        models.User | None: 인증된 사용자 또는 None
    """
    if credentials is None:
        return None

    try:
        token = credentials.credentials
        payload = verify_token(token)
        user_id = payload.get("sub")

        if user_id is None:
            return None

        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        return user
    except:
        return None
