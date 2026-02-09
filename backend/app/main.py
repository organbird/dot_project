"""
main.py - FastAPI 애플리케이션 진입점
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app import models
from app.seed import seed_db
from app.utils import get_local_ip, get_kst_now
from app.routers import (
    ai_router, user_router, schedule_router,
    document_router, meeting_router, image_router,
    chat_router, auth_router, admin_router, monitoring_router,
)

# DB 테이블 생성 및 시드 데이터 삽입
models.Base.metadata.create_all(bind=engine)
seed_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 [System] 서버 시작: 초기화 진행 중...")
    ai_router.load_ai_models()
    yield
    print("👋 [System] 서버 종료")


# FastAPI 앱 생성
app = FastAPI(lifespan=lifespan)

# 라우터 등록
app.include_router(ai_router.router)
app.include_router(user_router.router)
app.include_router(schedule_router.router)
app.include_router(document_router.router)
app.include_router(meeting_router.router)
app.include_router(image_router.router)
app.include_router(chat_router.router)
app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(monitoring_router.router)

# CORS 설정
allow_origins_env = os.getenv("ALLOW_ORIGINS", "")
allow_origins_list = [origin.strip() for origin in allow_origins_env.split(",") if origin.strip()]

if allow_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# 로컬 IP 감지
current_ip = get_local_ip()
print(f"📡 Detected Local IP: {current_ip}")


@app.get("/")
def read_root():
    """루트 경로 (헬스체크)"""
    return {"status": "Running", "time": get_kst_now()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
