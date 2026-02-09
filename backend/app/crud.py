"""
CRUD Operations - 데이터베이스 작업 헬퍼 함수
"""

from app import models
from app.utils import get_kst_now


def create_system_log(db, user_id, action, target_id, target_type, ip_addr, details):
    """시스템 로그를 데이터베이스에 기록"""
    new_log = models.SystemLog(
        user_id=user_id,
        action=action,
        target_id=target_id,
        target_type=target_type,
        ip_addr=ip_addr,
        details=details,
        created_at=get_kst_now()
    )
    db.add(new_log)
    db.commit()
