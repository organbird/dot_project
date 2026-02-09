"""
공용 설정 모듈 - Redis 클라이언트 등 전역 설정
"""

import os
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)
