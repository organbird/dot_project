"""
Pydantic 스키마 - 요청/응답 데이터 모델
"""

from typing import Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    """로그인 요청"""
    email: str
    password: str


class UserCreate(BaseModel):
    """회원가입 요청"""
    email: str
    name: str
    password: str
    phone: str
    dept_idx: int
    role: str = "USER"
    gender: str = "M"


class DeptCreate(BaseModel):
    """부서 생성 요청"""
    dept_name: str


class UserUpdateAdmin(BaseModel):
    """관리자 사용자 정보 수정 요청"""
    user_id: int
    new_role: Optional[str] = None
    new_password: Optional[str] = None


class UserUpdateDept(BaseModel):
    """사용자 부서 이동 요청"""
    user_id: int
    new_dept_idx: int
