# =====================================================================
# Database Configuration - SQLAlchemy 설정
# =====================================================================
# 이 파일은 데이터베이스 연결 및 세션 관리를 담당합니다.
# - MySQL 데이터베이스 연결
# - 연결 재시도 로직
# - 세션 관리
# =====================================================================

import os
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# =====================================================================
# 데이터베이스 URL 설정
# =====================================================================
# 환경 변수 우선 적용 (Docker Compose 환경 변수 사용)
# 기본값: root 계정, 비밀번호 12345, db 호스트, aidot_db 데이터베이스
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:12345@db:3306/aidot_db"
)

# =====================================================================
# 데이터베이스 엔진 생성 및 연결 재시도
# =====================================================================
# SQLAlchemy 엔진 생성 (커넥션 풀 관리)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,    # 사용 전 연결 상태 확인 (끊어진 연결 자동 재생성)
    pool_recycle=3600,     # 1시간마다 커넥션 재생성 (MySQL wait_timeout 대비)
)

# DB 연결 재시도 로직 (컨테이너 시작 순서 문제 해결)
# MySQL 컨테이너가 준비될 때까지 최대 10번 시도 (각 5초 간격)
for i in range(10):
    try:
        # 실제 커넥션을 맺어봅니다
        with engine.connect() as connection:
            print("✅ Successfully connected to the database!")
            break
    except Exception as e:
        print(f"⏳ Database not ready yet... (Attempt {i+1}/10)")
        time.sleep(5)
else:
    # 10번 시도 후에도 연결 실패 시 예외 발생
    raise Exception("❌ Could not connect to the database after several attempts.")

# =====================================================================
# 세션 팩토리 생성
# =====================================================================
# autocommit=False: 수동 커밋 모드 (명시적 트랜잭션 관리)
# autoflush=False: 쿼리 실행 전 자동 플러시 비활성화
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# =====================================================================
# SQLAlchemy 2.0 스타일 Base 클래스
# =====================================================================
class Base(DeclarativeBase):
    """
    모든 ORM 모델의 기본 클래스

    Note:
        - SQLAlchemy 2.0 스타일 (DeclarativeBase 사용)
        - 모든 모델은 이 클래스를 상속해야 함
    """
    pass

# =====================================================================
# 데이터베이스 세션 의존성 주입 함수
# =====================================================================
def get_db():
    """
    FastAPI 의존성 주입용 DB 세션 생성 함수

    Yields:
        Session: SQLAlchemy 데이터베이스 세션

    Usage:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()

    Note:
        - 요청마다 새로운 세션 생성
        - 요청 완료 시 자동으로 세션 종료
        - try-finally로 안전한 리소스 정리 보장
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
