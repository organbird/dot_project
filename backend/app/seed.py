from sqlalchemy.orm import Session
from app.database import SessionLocal
from app import models
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_db():
    db = SessionLocal()
    try:
        # 1. 기본 부서 생성
        admin_dept = db.query(models.Dept).filter(models.Dept.dept_name == "관리자부서").first()
        if not admin_dept:
            admin_dept = models.Dept(dept_name="관리자부서")
            db.add(admin_dept)
            db.commit()
            db.refresh(admin_dept)

        # 2. 관리자 계정 생성 (role='ADMIN')
        admin_user = db.query(models.User).filter(models.User.email == "admin@dot.com").first()
        if not admin_user:
            hashed_pw = pwd_context.hash("admin1234")
            admin_user = models.User(
                email="admin@dot.com",
                name ="관리자",
                password_hash=hashed_pw,
                dept_idx=admin_dept.id,
                phone="010-0000-0000",
                role="ADMIN"
            )
            db.add(admin_user)
            db.commit()
            print("✅ 관리자 데이터 생성 완료 (admin@dot.com / admin123)")

    except Exception as e:
        print(f"❌ Seed 에러: {e}")
        db.rollback()
    finally:
        db.close()