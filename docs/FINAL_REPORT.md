# Ai DOT 최종 결과 보고서

## 문서 정보

| 항목 | 내용 |
|------|------|
| 프로젝트명 | Ai DOT (AI 기반 업무 협업 플랫폼) |
| 문서 버전 | 1.0 |
| 작성일 | 2026-02-07 |
| 개발 기간 | 2026년 1월 ~ 2026년 2월 (약 4주) |
| 개발 인원 | 4명 (김다흰 PM/AI, 박은비 프론트엔드, 박제연 백엔드, 이준일 문서/테스트) |

---

## 1. 프로젝트 개요

### 1.1 프로젝트 배경

기업 환경에서 문서, 회의, 일정 등 업무 도구가 분산되어 있어 생산성이 저하되는 문제가 발생합니다. 특히 보안이 중요한 환경에서는 외부 클라우드 AI 서비스를 사용할 수 없어, 로컬 AI 솔루션에 대한 요구가 증가하고 있습니다.

### 1.2 프로젝트 목적

**Ai DOT (Document Operations & Teamwork)** 는 다음 목적을 달성하기 위해 개발되었습니다:

- 폐쇄망 환경에서도 동작하는 온프레미스 AI 서비스 제공
- AI 챗봇, 이미지 생성, 음성 변환, 문서 RAG 등 통합 AI 기능 제공
- 문서 관리, 일정 관리, 회의록 분석 등 업무 협업 기능 통합
- GPU 자원을 효율적으로 분배하는 분산 아키텍처 구현
- 배포 관리 포탈(AIDot Admin)을 통한 솔루션 배포/라이선스 관리

### 1.3 프로젝트 범위

| 구분 | 포함 | 미포함 |
|------|------|--------|
| AI 챗봇 | RAG 기반 대화, 실시간 스트리밍, 세션 관리 | 다국어 지원 |
| 이미지 생성 | 6종 스타일, 3종 크기, 한글→영어 자동 번역 | 영상 생성 |
| 문서 관리 | 업로드, 검색, 카테고리 분류, RAG 인덱싱 | 협업 편집 |
| 회의록 분석 | 음성 파일 STT, AI 요약, 직접 작성 | 실시간 녹음 |
| 일정 관리 | 캘린더 CRUD, 카테고리 색상 구분 | 외부 캘린더 연동 |
| 관리자 | 대시보드 모니터링, 사용자/부서 관리 | 외부 SSO 연동 |
| 배포 포탈 | 배포 등록, 라이선스 발급, 다운로드 | 자동 업데이트 |

### 1.4 서비스 구성

| 서비스 | 설명 | URL |
|--------|------|-----|
| **Ai DOT Main** | 메인 AI 업무 협업 플랫폼 (React + FastAPI) | http://192.168.0.20:5173 |
| **AIDot Admin** | 배포 관리 포탈 (Spring Boot) | http://192.168.0.9:8081 |

---

## 2. 시스템 아키텍처

### 2.1 전체 시스템 구성

```
                         ┌──────────────┐
                         │   Client     │
                         │  (Browser)   │
                         └──────┬───────┘
                                │ HTTP / WebSocket
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                  PC1 - Master Server (192.168.0.9)            │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌───────────────┐  │
│  │ Frontend │  │ Backend  │  │ MySQL  │  │    Redis      │  │
│  │  :5173   │  │  :8000   │  │ :3306  │  │    :6379      │  │
│  └──────────┘  └────┬─────┘  └────────┘  └───────────────┘  │
│                     │                                         │
│          ┌──────────┴──────────┐  ┌──────────────────────┐   │
│          │    AI Models (GPU)   │  │  AIDot Admin Portal │   │
│          │  - LLaMA 3 Bllossom │  │     :8081 (Spring)  │   │
│          │  - ChromaDB (RAG)   │  └──────────────────────┘   │
│          └─────────────────────┘                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ Celery Task Queue (Redis)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  PC2 - Worker Server (192.168.0.17)           │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                  Celery Worker                         │    │
│  │  - 이미지 생성 (ComfyUI + SD 3.5 Medium)              │    │
│  │  - 음성 전사 (Faster Whisper STT)                      │    │
│  │  - 문서 임베딩 (RAG Ingestion)                         │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 작업 분배 전략

| 서버 | 역할 | 처리 작업 |
|------|------|----------|
| **PC1 (Master)** | 메인 서버 | API 서비스, LLM 추론, RAG 검색, DB 관리, AIDot Admin |
| **PC2 (Worker)** | AI Worker | 이미지 생성, STT 음성 변환, 문서 벡터화 |

### 2.3 핵심 기술 설계

#### GPU 메모리(VRAM) 동시성 제어
```
LLM 요청 → llm_lock 획득 → LLM 추론 → llm_lock 해제
이미지 요청 → Celery → PC2 Worker → ComfyUI 처리 → 결과 반환
```
- Master의 LLM과 Worker의 이미지 생성이 서로 다른 GPU에서 독립 처리
- Thread Lock 기반으로 동일 GPU 내 동시 접근 방지

#### RAG (Retrieval-Augmented Generation) 파이프라인
```
문서 업로드 → PDF 파싱 → 텍스트 청킹 → 임베딩 → ChromaDB 저장
질문 입력 → 임베딩 → 유사도 검색 → 관련 문서 추출 → LLM 컨텍스트 주입 → 응답 생성
```

#### 실시간 스트리밍 응답
```
사용자 질문 → Backend → LLM 토큰 생성 → Redis Queue → SSE → Frontend 실시간 표시
```

---

## 3. 기술 스택

### 3.1 Ai DOT Main (React + FastAPI)

#### Backend

| 기술 | 버전 | 용도 |
|------|------|------|
| FastAPI | 0.109.0 | 비동기 REST API 서버 |
| Uvicorn | 0.27.0 | ASGI 서버 |
| SQLAlchemy | 2.0.25 | ORM |
| PyMySQL | 1.1.0 | MySQL 드라이버 |
| Celery | 5.3.6 | 분산 태스크 큐 (AI 작업 비동기 처리) |
| Redis | 5.0.1 | 캐시/메시지 브로커 |
| Passlib + bcrypt | 1.7.4 / 4.0.1 | 비밀번호 해싱 |
| Pydantic | 2.5.3 | 데이터 검증 |

#### AI/ML

| 기술 | 버전 | 용도 |
|------|------|------|
| PyTorch | 2.4.0 (CUDA 12.1) | GPU 가속 딥러닝 |
| llama-cpp-python | latest | 로컬 LLM 추론 (GGUF) |
| LLaMA 3 Korean Bllossom 8B | - | 한국어 특화 LLM |
| Stable Diffusion 3.5 Medium | - | 이미지 생성 (ComfyUI + GGUF) |
| Faster Whisper | Large-v3 | 음성→텍스트 변환 (INT8) |
| LangChain | 0.2.14 | RAG 파이프라인 |
| ChromaDB | 0.4.22 | 벡터 데이터베이스 |
| ko-sbert-nli | - | 한국어 문서 임베딩 |

#### Frontend

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19 | 컴포넌트 기반 SPA |
| Vite | 7 | 빌드 도구 |
| TailwindCSS | 4 | 유틸리티 기반 CSS |
| Recharts | - | 차트 시각화 |
| Axios | - | HTTP 클라이언트 |
| React Router | v7 | SPA 라우팅 |

#### Infrastructure

| 기술 | 버전 | 용도 |
|------|------|------|
| Docker + Docker Compose | - | 컨테이너 기반 배포 |
| MySQL | 8.0 | RDBMS |
| Redis | Alpine | 세션 캐시 + 메시지 브로커 |
| NVIDIA CUDA | 12.1 | GPU 가속 |

### 3.2 AIDot Admin Portal (Spring Boot)

| 기술 | 버전 | 용도 |
|------|------|------|
| Spring Boot | 4.0.1 | 메인 프레임워크 |
| Java | 17 (LTS) | 개발 언어 |
| Spring Security | - | 인증/인가 |
| Spring Data JPA | - | ORM |
| Thymeleaf | - | 서버 사이드 템플릿 엔진 |
| MySQL | 8.0 | RDBMS (aidot_admin_db) |
| BCrypt | - | 비밀번호 암호화 |
| Spring Mail | - | 이메일 발송 |

---

## 4. 데이터베이스 설계

### 4.1 Ai DOT Main DB (ERD)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  depts   │──┐  │    users     │──┐  │ chat_sessions│
│          │  └──│  dept_idx FK │  ├──│  user_id FK  │
└──────────┘     └──────┬───────┘  │  └──────┬───────┘
                        │          │         │
                        │          │  ┌──────────────┐
                        │          │  │chat_messages │
                        │          │  │session_id FK │
                        │          │  └──────────────┘
                        │          │
                  ┌─────┼─────┬────┼──────────┐
                  │     │     │    │          │
           ┌──────┴──┐ ┌┴────┴─┐ ┌┴────────┐ ┌┴──────────┐
           │documents│ │images │ │meetings │ │schedules  │
           │user_id  │ │user_id│ │user_id  │ │user_id    │
           └─────────┘ └───────┘ └─────────┘ └───────────┘

                        ┌──────────────┐
                        │ system_logs  │
                        │  user_id FK  │
                        └──────────────┘
```

### 4.2 테이블 목록 (9개)

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|----------|
| **depts** | 부서 | dept_name |
| **users** | 사용자 | email, name, role, dept_idx |
| **chat_sessions** | 대화 세션 | title, current_summary |
| **chat_messages** | 대화 메시지 | sender, content, reference_docs |
| **documents** | 문서 | title, category, file_name, chroma_id |
| **generated_images** | 생성 이미지 | prompt, img_file |
| **meeting_notes** | 회의록 | transcript, summary, attendees |
| **schedules** | 일정 | title, schedule_date, category |
| **system_logs** | 시스템 로그 | action, target_type, ip_addr |

### 4.3 AIDot Admin DB

| 테이블 | 설명 |
|--------|------|
| system_manager | 관리자 계정 |
| deployments | 배포 내역 (기관명, 버전, 라이선스키) |

---

## 5. 주요 기능 구현

### 5.1 인증 및 사용자 관리

- JWT 토큰 기반 인증 (python-jose, 24시간 만료)
- bcrypt 비밀번호 해싱 (Passlib)
- 역할 기반 접근 제어 (USER / ADMIN)
- 회원가입 시 이메일/연락처 중복 체크
- 부서 기반 사용자 분류

| 역할 | 접근 가능 영역 |
|------|---------------|
| ADMIN | 모든 기능 + 대시보드, 사용자 관리, 부서 관리 |
| USER | 홈, AI 챗봇, 이미지 생성, 문서, 회의록, 일정, 마이페이지 |
| Guest | 랜딩페이지, 로그인, 회원가입 |

### 5.2 AI 챗봇

- 한국어 특화 LLM (LLaMA 3 Korean Bllossom 8B)으로 자연스러운 한국어 대화
- 업로드된 문서를 참조하여 RAG 기반 정확한 답변 생성
- 실시간 스트리밍으로 응답을 토큰 단위로 즉시 표시 (SSE + Redis Queue)
- 대화 세션 관리 (생성, 제목 변경, 삭제)
- Redis 캐싱으로 대화 컨텍스트 빠르게 유지

### 5.3 AI 이미지 생성

- Stable Diffusion 3.5 Medium 모델 사용 (ComfyUI + GGUF)
- 한글 프롬프트 입력 시 LLM이 자동으로 영어 번역
- 6종 스타일 지원: 기업/비즈니스, 제품 촬영, 포스터/타이포, 사실적, 애니메이션, 만화
- 3종 크기 선택: 512x512, 768x768, 1024x1024
- Celery를 통한 비동기 처리로 사용자 대기 시간 최소화

### 5.4 문서 보관함

- 다양한 형식 지원: PDF, DOC, DOCX, XLS, PPT, TXT, HWP
- 업로드 즉시 Celery Worker가 백그라운드에서 RAG 벡터화 처리
- 카테고리 필터링 (전체, 업무, 개인, 아이디어)
- 제목/내용 기반 검색
- 파일 다운로드 지원

### 5.5 회의록 분석

- 음성 파일 업로드 (MP3, WAV, M4A, MP4, WebM)
- Faster Whisper Large-v3로 음성→텍스트 변환 (STT)
- LLM으로 회의 내용 자동 요약 생성
- 처리 상태 실시간 모니터링 (대기 → 처리중 → 완료)
- 직접 텍스트 작성 모드 지원

### 5.6 일정 관리

- 월별 캘린더 뷰
- 날짜별 일정 목록 표시
- 카테고리별 색상 구분 (일반, 업무, 회의, 개인, 중요)
- 일정 CRUD (생성, 조회, 수정, 삭제)

### 5.7 관리자 대시보드

- 서버 리소스 실시간 모니터링 (CPU, 메모리, 디스크)
- 통계 카드: 전체 사용자(88명), 운영 부서(3), 오늘 접속자, 성공률(89%)
- AI 기능 사용 현황 카드 (채팅, 이미지, 문서, 회의록)
- 실시간 프로세스 테이블
- 시스템 로그

### 5.8 관리자 부서/사용자 관리

- 부서별 인원 관리 (개발부, 관리자부서, 디자인부)
- 전체 사용자 계정 관리 (88명)
- 역할 부여/변경 (ADMIN / USER)
- 사용자 검색 및 필터링

### 5.9 AIDot Admin Portal (배포 관리)

- 시스템 관리자 전용 로그인
- 신규 배포 등록 (기관명, 버전, 배포일)
- 배포 내역 테이블 관리 (스마트인재개발원 v1.0 등)
- 라이선스 키 생성 및 발급
- 솔루션 다운로드 페이지 (라이선스 키 인증)
- 이메일 알림 발송

---

## 6. 화면 구성 (스크린샷)

### 6.1 Ai DOT Main 서비스

#### 6.1.1 메인 랜딩 페이지

![메인 랜딩 페이지](../screenshot/dot_01_index.png)

- "내 손안의 똑똑한 AI 비서" 메인 슬로건
- 주황/크림 테마, 로봇 마스코트 캐릭터
- "왜 AiDOT 인가요?" 서비스 소개 섹션
- "지금 시작하기" CTA 버튼

#### 6.1.2 로그인 페이지

![로그인 페이지](../screenshot/dot_02_login.png)

- "반가워요! Ai DOT.입니다" 환영 메시지
- 이메일/비밀번호 입력 폼
- 주황색 로그인 버튼
- 회원가입 링크

#### 6.1.3 회원가입 페이지

![회원가입 페이지](../screenshot/dot_03_signup.png)

- 이메일, 이름, 연락처, 성별(남성/여성), 비밀번호 입력
- 소속 부서 드롭다운 선택
- 실시간 입력값 유효성 검증
- 이메일/연락처 중복 체크

#### 6.1.4 홈 (사용자 대시보드)

![홈 페이지](../screenshot/dot_04_home.png)

- 좌측 사이드바 네비게이션 (메인화면, 에이닷 챗봇, 문서보관함, 회의록분석, 이미지생성, 일정관리, 마이페이지)
- 상단 인사 배너 (사용자명 표시)
- 4종 통계 카드: AI 채팅 횟수, 생성 문서 수, 이미지 생성 수, 오늘 일정
- 최근 AI 대화 목록
- 최근 문서 목록
- 우측 프로필 정보 카드

#### 6.1.5 관리자 대시보드

![관리자 대시보드](../screenshot/dot_05_dashboard.png)

- "시스템 통합 대시보드" 타이틀
- 서버 상태: HEALTHY 표시
- 실시간 프로세스 테이블
- 통계 요약: 전체 사용자 88명, 운영 부서 3, 오늘 접속자 1, 성공률 89%
- AI 기능별 사용 현황 카드 (채팅, 이미지, 문서, 회의록)

#### 6.1.6 AI 챗봇

![AI 챗봇](../screenshot/dot_06_chatbot.png)

- "에이닷 챗봇" 페이지
- 좌측: 대화 세션 목록 (생성/삭제)
- "새 대화 시작하기" 버튼
- 기능 소개 카드: 자연스러운 대화, 문서 기반 답변, 대화 기록 저장

#### 6.1.7 일정 관리

![일정 관리](../screenshot/dot_07_schedule.png)

- "일정 관리" 타이틀
- 2026년 2월 월별 캘린더 뷰
- 날짜 선택 시 일정 목록 패널 표시
- 카테고리별 색상 구분

#### 6.1.8 문서 보관함

![문서 보관함](../screenshot/dot_08_documents.png)

- "문서 보관함" 타이틀
- 검색바 (제목/내용 검색)
- 카테고리 필터 탭: 전체, 업무, 개인, 아이디어
- 문서 리스트 테이블 (제목, 카테고리, 업로드일, 다운로드)

#### 6.1.9 회의록 분석

![회의록 분석](../screenshot/dot_09_meeting.png)

- "회의록 분석" 타이틀
- 검색바
- 빈 상태: "등록된 회의록이 없습니다"
- "직접 작성" / "파일 업로드" 2종 등록 방식

#### 6.1.10 AI 이미지 생성

![AI 이미지 생성](../screenshot/dot_10_images.png)

- "AI 이미지 생성" 타이틀
- 프롬프트 입력 영역 (한글 입력 가능)
- 6종 스타일 옵션: 기업/비즈니스, 제품촬영, 포스터/타이포, 사실적, 애니메이션, 만화
- 3종 크기 옵션: 512x512, 768x768, 1024x1024
- 생성된 이미지 갤러리

#### 6.1.11 마이페이지

![마이페이지](../screenshot/dot_11_mypage.png)

- "마이페이지" 타이틀
- 프로필 카드: 이름(관리자), 이메일(admin@dot.com), 역할(Administrator)
- 활동 통계 카드 (대화, 문서, 이미지 등)
- 월별 활동 현황
- 계정 정보 수정 영역

#### 6.1.12 부서 관리

![부서 관리](../screenshot/dot_12_admin_depts.png)

- "부서 관리" 타이틀
- 부서 목록: 개발부, 관리자부서, 디자인부
- 부서별 소속 인원 조회 패널
- 부서 추가/수정/삭제

#### 6.1.13 사용자 계정 관리

![사용자 계정 관리](../screenshot/dot_13_admin_settings.png)

- "사용자 계정 관리" 타이틀
- 전체 사용자 목록 (88명)
- 역할 뱃지 표시: ADMIN (빨강), USER (파랑)
- 사용자 검색/필터

---

### 6.2 AIDot Admin Portal

#### 6.2.1 메인 랜딩 페이지

![AIDot 랜딩](../screenshot/aidot_01_index.png)

- "내 손안의 똑똑한 AI 비서" AiDOT 브랜딩
- 서비스 특징 소개: 압도적 속도, 스마트 분석, 철저한 보안
- "지금 시작하기" / "다운로드" CTA 버튼

#### 6.2.2 솔루션 다운로드

![다운로드](../screenshot/aidot_02_download.png)

- "솔루션 다운로드" 타이틀
- 라이선스 키 입력 폼
- 라이선스 인증 후 다운로드 진행

#### 6.2.3 관리자 로그인

![관리자 로그인](../screenshot/aidot_03_login.png)

- "AiDot Admin" 다크 테마 로그인 페이지
- 아이디/비밀번호 입력 폼
- 보라색 로그인 버튼

#### 6.2.4 배포 관리 대시보드

![배포 대시보드](../screenshot/aidot_04_dashboard.png)

- 다크 테마 관리자 대시보드
- "신규 배포 등록" 폼 (기관명, 버전, 배포일)
- 배포 내역 테이블 (스마트인재개발원 v1.0 등)
- 라이선스 키 생성/관리
- 이메일 알림 발송

#### 6.2.5 라이선스 관리

![라이선스 관리](../screenshot/aidot_05_license.png)

- 배포 상세 / 라이선스 인증서 뷰
- 라이선스 키 확인
- 배포 현황 관리

---

## 7. API 설계

### 7.1 Ai DOT Main REST API (50+개)

| 분류 | 메서드 | 엔드포인트 | 설명 |
|------|--------|-----------|------|
| **인증** | POST | /api/register | 회원가입 |
| | POST | /api/login | 로그인 (JWT 발급) |
| | GET | /api/verify | 토큰 검증 |
| **AI 챗봇** | POST | /api/chat/session | 새 대화 세션 생성 |
| | GET | /api/chat/sessions | 세션 목록 조회 |
| | POST | /api/chat/message | 메시지 전송 |
| | GET | /api/chat/stream | 실시간 스트리밍 (SSE) |
| | DELETE | /api/chat/session/{id} | 세션 삭제 |
| **이미지** | POST | /api/image/generate | 이미지 생성 요청 |
| | GET | /api/image/status/{id} | 생성 상태 확인 |
| | GET | /api/image/gallery | 갤러리 목록 |
| | GET | /api/image/{id} | 이미지 상세 |
| | DELETE | /api/image/{id} | 이미지 삭제 |
| **문서** | POST | /api/document/upload | 문서 업로드 |
| | GET | /api/documents | 문서 목록 |
| | GET | /api/document/{id} | 문서 상세 |
| | GET | /api/document/search | 문서 검색 |
| | GET | /api/document/download/{id} | 파일 다운로드 |
| | DELETE | /api/document/{id} | 문서 삭제 |
| **회의록** | POST | /api/meeting/upload | 음성 파일 업로드 |
| | POST | /api/meeting/create | 직접 작성 |
| | GET | /api/meetings | 목록 조회 |
| | GET | /api/meeting/{id} | 상세 조회 |
| | DELETE | /api/meeting/{id} | 삭제 |
| **일정** | GET | /api/schedules/month | 월별 일정 |
| | GET | /api/schedules/date | 일별 일정 |
| | POST | /api/schedule | 일정 생성 |
| | PUT | /api/schedule/{id} | 일정 수정 |
| | DELETE | /api/schedule/{id} | 일정 삭제 |
| **사용자** | GET | /api/user/profile | 프로필 조회 |
| | PUT | /api/user/profile | 프로필 수정 |
| | GET | /api/user/stats | 활동 통계 |
| **관리자** | GET | /api/admin/dashboard | 대시보드 데이터 |
| | GET | /api/admin/users | 사용자 목록 |
| | PUT | /api/admin/user/{id}/role | 역할 변경 |
| | GET | /api/admin/depts | 부서 목록 |
| | POST | /api/admin/dept | 부서 생성 |
| | GET | /api/admin/logs | 시스템 로그 |

### 7.2 AIDot Admin REST API

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | / | 랜딩 페이지 |
| GET | /download-page | 다운로드 페이지 |
| GET | /system-manager-login | 관리자 로그인 |
| POST | /system-manager-login | 로그인 처리 |
| GET | /deployment | 배포 관리 대시보드 |
| POST | /deployment | 신규 배포 등록 |
| GET | /deployment/license/{id} | 라이선스 인증서 |

---

## 8. 보안 설계

### 8.1 Ai DOT Main

| 항목 | 구현 방식 |
|------|----------|
| **인증** | JWT 토큰 기반 (python-jose, 24시간 만료) |
| **비밀번호** | bcrypt 해싱 (Passlib) |
| **권한 제어** | 역할 기반 접근 제어 (USER / ADMIN) |
| **SQL Injection 방지** | SQLAlchemy ORM 파라미터 바인딩 |
| **데이터 격리** | 사용자별 데이터 접근 분리 |
| **감사 로그** | 모든 주요 활동 SystemLog에 기록 |
| **CORS** | 프론트엔드 도메인만 허용 |

### 8.2 AIDot Admin

| 항목 | 구현 방식 |
|------|----------|
| **인증** | Spring Security Form Login |
| **비밀번호** | BCrypt 암호화 |
| **세션 관리** | Spring Session |
| **CSRF** | Spring Security 기본 활성화 |

---

## 9. 배포 환경

### 9.1 Docker Compose 구성

```
docker-compose-master.yml (PC1: 192.168.0.9)
├── dot_backend     (FastAPI + AI Models)
├── dot_frontend    (React + Vite)
├── dot_db          (MySQL 8.0)
└── dot_redis       (Redis)

docker-compose-worker.yml (PC2: 192.168.0.17)
├── dot_worker      (Celery Worker)
└── dot_comfyui     (ComfyUI Sidecar)
```

### 9.2 실행 방법

```bash
# PC1 (Master) - 메인 서버 실행
docker compose -f docker-compose-master.yml up -d

# PC2 (Worker) - AI Worker 실행
docker compose -f docker-compose-worker.yml up -d

# AIDot Admin - 별도 Spring Boot 서비스
java -jar aidot-admin.jar --server.port=8081
```

---

## 10. 화면 목록 (총 18개)

### 10.1 Ai DOT Main (13개)

| # | 화면 | 경로 | 접근 권한 | 스크린샷 |
|---|------|------|----------|----------|
| 1 | 메인 랜딩 | `/` | Public | dot_01_index.png |
| 2 | 로그인 | `/login` | Public | dot_02_login.png |
| 3 | 회원가입 | `/signup` | Public | dot_03_signup.png |
| 4 | 홈 | `/home` | USER, ADMIN | dot_04_home.png |
| 5 | 관리자 대시보드 | `/dashboard` | ADMIN | dot_05_dashboard.png |
| 6 | AI 챗봇 | `/chatbot` | USER, ADMIN | dot_06_chatbot.png |
| 7 | 일정 관리 | `/schedule` | USER, ADMIN | dot_07_schedule.png |
| 8 | 문서 보관함 | `/documents` | USER, ADMIN | dot_08_documents.png |
| 9 | 회의록 분석 | `/meeting` | USER, ADMIN | dot_09_meeting.png |
| 10 | AI 이미지 생성 | `/images` | USER, ADMIN | dot_10_images.png |
| 11 | 마이페이지 | `/mypage` | USER, ADMIN | dot_11_mypage.png |
| 12 | 부서 관리 | `/admin/depts` | ADMIN | dot_12_admin_depts.png |
| 13 | 사용자 관리 | `/admin/settings` | ADMIN | dot_13_admin_settings.png |

### 10.2 AIDot Admin Portal (5개)

| # | 화면 | 경로 | 접근 권한 | 스크린샷 |
|---|------|------|----------|----------|
| 1 | 랜딩 페이지 | `/` | Public | aidot_01_index.png |
| 2 | 다운로드 | `/download-page` | Public | aidot_02_download.png |
| 3 | 관리자 로그인 | `/system-manager-login` | Public | aidot_03_login.png |
| 4 | 배포 대시보드 | `/deployment` | ADMIN | aidot_04_dashboard.png |
| 5 | 라이선스 관리 | `/deployment/license/{id}` | ADMIN | aidot_05_license.png |

---

## 11. 프로젝트 성과

### 11.1 구현 결과

| 항목 | 수치 |
|------|------|
| 전체 화면 수 | 18개 (Main 13 + Admin 5) |
| API 엔드포인트 | 50+ 개 |
| DB 테이블 | 11개 (Main 9 + Admin 2) |
| AI 모델 | 4종 (LLM, SD, STT, Embedding) |
| Docker 서비스 | 6개 (Master 4 + Worker 2) |
| 등록 사용자 | 88명 |
| 운영 부서 | 3개 (개발부, 관리자부서, 디자인부) |

### 11.2 기술적 도전과 해결

| 도전 | 해결 방법 |
|------|----------|
| GPU 메모리 부족 | Master-Worker 분산 구조로 GPU 부하 분배 |
| LLM 응답 지연 | Redis Queue 기반 SSE 스트리밍으로 즉각적 피드백 |
| 한글 이미지 프롬프트 | LLM을 활용한 한글→영어 자동 번역 |
| 대화 컨텍스트 관리 | Redis 캐싱 + 자동 요약으로 토큰 최적화 |
| 폐쇄망 제약 | 모든 AI 모델을 로컬 GGUF/CTranslate2로 경량화 |
| 배포 관리 | Spring Boot 기반 별도 관리 포탈 구축 |

### 11.3 비기능 요구사항 충족

| 항목 | 기준 | 달성 |
|------|------|------|
| 페이지 로딩 | 3초 이내 | O |
| API 응답 시간 | 2초 이내 (일반 API) | O |
| LLM 첫 응답 | 5초 이내 (스트리밍 시작) | O |
| 이미지 생성 | 60초 이내 | O |
| STT 처리 | 음성 길이의 0.5배 이내 | O |
| 동시 접속 | 20명 이상 | O |

---

## 12. 관련 문서

| 문서 | 파일 | 설명 |
|------|------|------|
| 요구사항 정의서 | REQUIREMENTS.md | 시스템 요구사항 전체 |
| 기능명세서 | FUNCTIONAL_SPECIFICATION.md | 기능별 상세 명세 |
| 기술 스택 | TECH_STACK.md | 사용 기술 상세 |
| 화면 설계서 | SCREEN_DESIGN.md | 화면별 상세 설계 |
| 유스케이스 | USE_CASES.md | 유스케이스 상세 |
| 유스케이스 다이어그램 | USE_CASE_DIAGRAM.md | 유스케이스 다이어그램 |
| 테스트케이스 | TEST_CASES.md | 테스트 시나리오 |
| 통합 테스트 | INTEGRATION_TEST_CASES.md | 통합 테스트 케이스 |
| 성능 테스트 | PERFORMANCE_TEST_REPORT.md | 성능 테스트 결과 |
| 시연 자료 | PRESENTATION.md | 발표 자료 |
| 시연 슬라이드 | presentation.html | HTML 발표 슬라이드 |
| 데모 스크립트 | DEMO_SCRIPT.md | 시연 시나리오 |
| STT 가이드 | STT_GUIDE.md | 음성 변환 사용 가이드 |

---

*Ai DOT - Document Operations & Teamwork*
*AI 기반 통합 업무 협업 플랫폼*
