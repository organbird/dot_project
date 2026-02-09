# =====================================================================
# Database Models - SQLAlchemy ORM 모델 정의
# =====================================================================
# 이 파일은 데이터베이스 테이블 구조를 정의합니다.
# - 부서 (Dept)
# - 사용자 (User)
# - 채팅 세션 및 메시지 (ChatSession, ChatMessage)
# - 생성 이미지 (GeneratedImage)
# - 시스템 로그 (SystemLog)
# - 문서 (Document)
# - 회의록 (MeetingNote)
# - 일정 (Schedule)
# =====================================================================

from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey, TIMESTAMP, JSON, TEXT, Enum, Date, Time
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

# =====================================================================
# 1. 부서 테이블 (depts)
# =====================================================================
class Dept(Base):
    """
    부서 정보를 저장하는 테이블

    Attributes:
        id (int): 부서 고유 ID (기본 키, 자동 증가)
        dept_name (str): 부서명 (고유값, 최대 255자)

    Relationships:
        users: 이 부서에 소속된 사용자 목록
    """
    __tablename__ = "depts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dept_name = Column(String(255), nullable=False, unique=True)

    # 관계 설정: 부서 -> 사용자 (1:N)
    users = relationship("User", back_populates="department")

# =====================================================================
# 2. 사용자 테이블 (users)
# =====================================================================
class User(Base):
    """
    사용자 정보를 저장하는 테이블

    Attributes:
        id (int): 사용자 고유 ID (기본 키, 자동 증가)
        email (str): 이메일 주소 (최대 50자)
        name (str): 사용자 이름 (최대 50자)
        password_hash (str): bcrypt 해시된 비밀번호 (최대 255자)
        dept_idx (int): 소속 부서 ID (외래 키 -> depts.id)
        phone (str): 전화번호 (고유값, 최대 20자)
        role (str): 사용자 권한 (USER, ADMIN 등, 최대 50자)
        gender (str): 성별 (M: 남성, F: 여성, 최대 1자)
        created_at (datetime): 계정 생성 시각 (자동 생성)

    Relationships:
        department: 소속 부서 정보
        chat_sessions: 사용자가 생성한 채팅 세션 목록
        documents: 사용자가 업로드한 문서 목록
        generated_images: 사용자가 생성한 이미지 목록
        logs: 사용자의 활동 로그 목록
        meeting_notes: 사용자가 작성한 회의록 목록
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(50), nullable=False)
    name = Column(String(50), nullable=False)
    password_hash = Column(String(255), nullable=False)
    dept_idx = Column(Integer, ForeignKey("depts.id"), nullable=False)
    phone = Column(String(20), nullable=False, unique=True)
    role = Column(String(50), nullable=False)
    gender = Column(String(1), nullable=False, default="M")  # M: 남성, F: 여성
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 관계 설정
    department = relationship("Dept", back_populates="users")
    chat_sessions = relationship("ChatSession", back_populates="owner")
    documents = relationship("Document", back_populates="owner")
    generated_images = relationship("GeneratedImage", back_populates="owner")
    logs = relationship("SystemLog", back_populates="owner")
    meeting_notes = relationship("MeetingNote", back_populates="owner")
    schedules = relationship("Schedule", back_populates="owner")

# =====================================================================
# 3. 채팅 세션 테이블 (chat_sessions)
# =====================================================================
class ChatSession(Base):
    """
    채팅방 세션 정보를 저장하는 테이블

    Attributes:
        id (int): 세션 고유 ID (기본 키, 자동 증가)
        title (str): 채팅방 제목 (최대 255자)
        user_id (int): 세션 소유자 ID (외래 키 -> users.id)
        created_at (datetime): 세션 생성 시각 (자동 생성)
        updated_at (datetime): 마지막 업데이트 시각 (자동 갱신)
        status (str): 세션 상태 (ACTIVE, ARCHIVED 등, 최대 50자)
        current_summary (TEXT): 세션별 대화 요약 (맥락 유지용, NULL 가능)

    Relationships:
        owner: 세션을 소유한 사용자
        messages: 이 세션에 속한 메시지 목록

    Note:
        - 하나의 사용자가 여러 세션을 가질 수 있음
        - 세션별로 대화 내역이 독립적으로 관리됨
        - current_summary는 전체 대화 히스토리 대신 요약본을 저장하여 토큰 절약
    """
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    status = Column(String(50), nullable=False)
    current_summary = Column(TEXT, nullable=True)

    # 관계 설정
    owner = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session")

# =====================================================================
# 4. 채팅 메시지 테이블 (chat_messages)
# =====================================================================
class ChatMessage(Base):
    """
    개별 채팅 메시지를 저장하는 테이블

    Attributes:
        id (int): 메시지 고유 ID (기본 키, 자동 증가)
        session_id (int): 소속 세션 ID (외래 키 -> chat_sessions.id)
        sender (str): 발신자 (user, assistant 등, 최대 50자)
        content (TEXT): 메시지 내용 (긴 텍스트, NULL 가능)
        emoticon (str): 이모티콘 (NULL 가능, 최대 255자)
        file (str): 첨부 파일 경로 (NULL 가능, 최대 255자)
        reference_docs (JSON): 참고 문서 정보 (RAG 검색 결과, NULL 가능)
        created_at (datetime): 메시지 생성 시각 (자동 생성)

    Relationships:
        session: 메시지가 속한 세션

    Note:
        - sender가 "user"이면 사용자 메시지, "assistant"이면 AI 응답
        - reference_docs는 RAG 검색 결과를 JSON 형태로 저장
    """
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    sender = Column(String(50), nullable=False)
    content = Column(TEXT, nullable=True)
    emoticon = Column(String(255), nullable=True)
    file = Column(String(255), nullable=True)
    reference_docs = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 관계 설정
    session = relationship("ChatSession", back_populates="messages")

# =====================================================================
# 5. 생성 이미지 테이블 (generated_images)
# =====================================================================
class GeneratedImage(Base):
    """
    AI로 생성한 이미지 정보를 저장하는 테이블

    Attributes:
        id (int): 이미지 고유 ID (기본 키, 자동 증가)
        user_id (int): 생성자 ID (외래 키 -> users.id)
        prompt (TEXT): 이미지 생성 프롬프트 (긴 텍스트)
        img_file (str): 이미지 파일 경로 (최대 255자)
        img_ext (str): 이미지 파일 확장자 (예: png, jpg, 최대 10자)
        img_size (int): 이미지 파일 크기 (바이트)
        created_at (datetime): 생성 시각 (자동 생성)

    Relationships:
        owner: 이미지를 생성한 사용자

    Note:
        - Stable Diffusion 등 이미지 생성 AI 사용 시 활용
        - prompt는 생성에 사용된 텍스트 설명
    """
    __tablename__ = "generated_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    prompt = Column(TEXT, nullable=False)
    img_file = Column(String(255), nullable=False)
    img_ext = Column(String(10), nullable=False)
    img_size = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 관계 설정
    owner = relationship("User", back_populates="generated_images")

# =====================================================================
# 6. 시스템 로그 테이블 (system_logs)
# =====================================================================
class SystemLog(Base):
    """
    시스템 활동 로그를 저장하는 테이블

    Attributes:
        id (int): 로그 고유 ID (기본 키, 자동 증가)
        user_id (int): 행위자 ID (외래 키 -> users.id)
        action (str): 행위 유형 (LOGIN_SUCCESS, USER_ROLE_UPDATED 등, 최대 50자)
        target_id (int): 대상 객체 ID
        target_type (str): 대상 객체 타입 (USER, DEPT, AUTH 등, 최대 20자)
        ip_addr (str): 요청 IP 주소 (최대 15자)
        details (TEXT): 상세 설명 (긴 텍스트)
        created_at (datetime): 로그 생성 시각 (자동 생성)

    Relationships:
        owner: 행위를 수행한 사용자

    Note:
        - 감사 추적(Audit Trail)용
        - 모든 중요한 시스템 작업을 기록
        - target_id와 target_type으로 작업 대상 식별
    """
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)
    target_id = Column(Integer, nullable=False)
    target_type = Column(String(20), nullable=False)
    ip_addr = Column(String(15), nullable=False)
    details = Column(TEXT, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    # 관계 설정
    owner = relationship("User", back_populates="logs")

# =====================================================================
# 7. 문서 테이블 (documents)
# =====================================================================
class Document(Base):
    """
    업로드된 문서 정보를 저장하는 테이블

    Attributes:
        id (int): 문서 고유 ID (기본 키, 자동 증가)
        user_id (int): 업로드한 사용자 ID (외래 키 -> users.id)
        title (str): 문서 제목 (최대 255자)
        category (str): 문서 카테고리 (최대 50자)
        file_name (str): 파일명 (최대 255자)
        file_ext (str): 파일 확장자 (pdf, docx 등, 최대 10자)
        file_size (int): 파일 크기 (바이트)
        summary (TEXT): 문서 요약 (AI 생성)
        status (Enum): 처리 상태 (PENDING, INDEXING, INDEXED, FAILED)
        chroma_id (str): 벡터DB(ChromaDB) 내 문서 ID (최대 255자)
        created_at (datetime): 업로드 시각 (자동 생성)
        updated_at (datetime): 마지막 업데이트 시각 (자동 갱신)

    Relationships:
        owner: 문서를 업로드한 사용자

    Note:
        - RAG 시스템에서 사용되는 문서 메타데이터
        - status: INDEXED 상태여야 검색 가능
        - chroma_id로 벡터DB의 임베딩과 연결
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_ext = Column(String(10), nullable=False)
    file_size = Column(Integer, nullable=False)
    summary = Column(TEXT, nullable=False)
    status = Column(Enum('PENDING', 'INDEXING', 'INDEXED', 'FAILED'), nullable=False)
    chroma_id = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 관계 설정
    owner = relationship("User", back_populates="documents")

# =====================================================================
# 8. 회의록 테이블 (meeting_notes)
# =====================================================================
class MeetingNote(Base):
    """
    회의록 정보를 저장하는 테이블

    Attributes:
        id (int): 회의록 고유 ID (기본 키, 자동 증가)
        user_id (int): 작성자 ID (외래 키 -> users.id)
        title (str): 회의 제목 (최대 255자)
        file_name (str): 오디오 파일명 (최대 255자)
        file_ext (str): 파일 확장자 (mp3, wav 등, 최대 10자)
        file_size (int): 파일 크기 (바이트)
        transcript (TEXT): STT로 변환된 전체 텍스트
        summary (TEXT): AI 생성 요약
        duration (int): 회의 시간 (초)
        attendees (TEXT): 참석자 목록 (쉼표 구분 텍스트)
        task_id (str): Celery 작업 ID (처리 상태 추적용, 최대 255자)
        status (Enum): 처리 상태 (QUEUED, PROCESSING, COMPLETED, ERROR)
        created_at (datetime): 생성 시각 (자동 생성)
        updated_at (datetime): 마지막 업데이트 시각 (자동 갱신)

    Relationships:
        owner: 회의록을 작성한 사용자

    Note:
        - STT 엔진으로 오디오를 텍스트로 변환
        - LLM으로 요약 및 핵심 내용 추출
        - status로 처리 진행 상황 추적
    """
    __tablename__ = "meeting_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_ext = Column(String(10), nullable=False)
    file_size = Column(Integer, nullable=False)
    transcript = Column(LONGTEXT, nullable=False)
    summary = Column(TEXT, nullable=False)
    duration = Column(Integer, nullable=False)
    attendees = Column(TEXT, nullable=False)
    task_id = Column(String(255), nullable=False)
    status = Column(Enum('QUEUED', 'PROCESSING', 'COMPLETED', 'ERROR'), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 관계 설정
    owner = relationship("User", back_populates="meeting_notes")


# 9. 일정 테이블 (schedules)
class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    content = Column(TEXT, nullable=True)
    schedule_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    category = Column(String(30), default="일반")
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # 관계 설정
    owner = relationship("User", back_populates="schedules")