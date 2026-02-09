"""
공용 유틸리티 함수 모듈
"""

import socket
import bcrypt
from datetime import datetime, timedelta


def get_kst_now():
    """한국 표준시(KST) 기준 현재 시각 반환 (UTC + 9)"""
    return datetime.utcnow() + timedelta(hours=9)


def hash_password(password: str) -> str:
    """평문 비밀번호를 bcrypt 해시로 변환"""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """평문 비밀번호와 해시 비밀번호 일치 여부 확인"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        print(f"Password verification error: {e}")
        return False


def get_local_ip() -> str:
    """서버의 로컬 IP 주소 자동 감지"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"


def format_file_size(size_bytes: int) -> str:
    """바이트를 읽기 좋은 파일 크기 문자열로 변환 (예: '1.5 MB')"""
    if size_bytes is None:
        return "0 B"
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def format_duration(seconds: int, compact: bool = False) -> str:
    """
    초를 읽기 좋은 시간 문자열로 변환

    compact=False: "5분 30초", "1시간 23분" (한국어 형식)
    compact=True:  "5:30", "1:23:00" (숫자 형식)
    """
    if seconds is None or seconds <= 0:
        return "0:00" if compact else "0분"

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if compact:
        if hours > 0:
            return f"{hours}:{minutes:02d}:{secs:02d}"
        return f"{minutes}:{secs:02d}"
    else:
        if hours > 0:
            return f"{hours}시간 {minutes}분"
        elif minutes > 0:
            return f"{minutes}분 {secs}초"
        return f"{secs}초"


def truncate_text(text: str, max_length: int = 50) -> str:
    """텍스트를 지정 길이로 자르고 '...' 추가"""
    if not text:
        return ""
    if len(text) <= max_length:
        return text
    return text[:max_length] + "..."


def get_status_text(status: str) -> str:
    """상태 코드를 한글 텍스트로 변환"""
    status_map = {
        "QUEUED": "대기 중",
        "PROCESSING": "처리 중",
        "COMPLETED": "완료",
        "ERROR": "오류"
    }
    return status_map.get(status, status)
