# DOT Project 기술 스택

> **Document Operations & Teamwork** - AI 기반 업무 지원 시스템

## 목차

1. [Backend (Python)](#backend-python)
2. [Frontend (React)](#frontend-react)
3. [AI 모델](#ai-모델)
4. [인프라](#인프라)
5. [지원 파일 형식](#지원-파일-형식)
6. [아키텍처](#아키텍처)
7. [기능별 기술 매핑](#기능별-기술-매핑)
8. [관리자 대시보드 지표](#관리자-대시보드---성공률-지표)

---

## Backend (Python)

### 웹 프레임워크

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| FastAPI | 0.109.0 | 비동기 REST API 서버 |
| Uvicorn | 0.27.0 | ASGI 서버 |
| python-multipart | 0.0.6 | 파일 업로드 처리 |
| python-dotenv | 1.0.1 | 환경변수 관리 |

### 데이터베이스

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| SQLAlchemy | 2.0.25 | ORM |
| PyMySQL | 1.1.0 | MySQL 드라이버 |
| Redis | 5.0.1 | 캐시/메시지 브로커 |

### 비동기 작업

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| Celery | 5.3.6 | 분산 태스크 큐 (AI 작업 비동기 처리) |
| Flower | 2.0.1 | Celery 모니터링 UI |

### AI/딥러닝

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| PyTorch | 2.4.0 (CUDA 12.1) | GPU 가속 딥러닝 |
| torchvision | 0.19.0 | 이미지 처리 |
| torchaudio | 2.4.0 | 오디오 처리 |
| llama-cpp-python | latest | 로컬 LLM 추론 (GGUF 모델) |

### RAG 시스템

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| LangChain | 0.2.14 | RAG 파이프라인 구축 |
| LangChain-Community | 0.2.12 | 커뮤니티 통합 |
| LangChain-Core | 0.2.33 | 핵심 기능 |
| LangChain-Text-Splitters | 0.2.2 | 문서 분할 |
| LangChain-Chroma | 0.1.2 | ChromaDB 연동 |
| LangChain-HuggingFace | 0.0.3 | HuggingFace 연동 |
| ChromaDB | 0.4.22 | 벡터 데이터베이스 |
| Sentence-Transformers | >=2.6.1 | 임베딩 생성 |
| PyPDF | 4.0.1 | PDF 문서 파싱 |

### 보안

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| Passlib | 1.7.4 | 비밀번호 해싱 |
| bcrypt | 4.0.1 | 암호화 알고리즘 (버그 회피 버전 고정) |
| Cryptography | 42.0.2 | 암호화 라이브러리 |

### 유틸리티

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| Pydantic | 2.5.3 | 데이터 검증 |
| Pydantic-Settings | 2.1.0 | 설정 관리 |
| email-validator | 2.1.0.post1 | 이메일 형식 검증 |
| Requests | 2.31.0 | HTTP 클라이언트 |
| psutil | 5.9.8 | 시스템 모니터링 |

---

## Frontend (React)

### 코어

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| React | 19.2.0 | 컴포넌트 기반 UI |
| React DOM | 19.2.0 | DOM 렌더링 |
| React Router DOM | 6.20.0 | SPA 라우팅 |

### 스타일링

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| Tailwind CSS | 4.0.0 | 유틸리티 기반 CSS |
| @tailwindcss/vite | 4.1.18 | Vite 플러그인 |
| @tailwindcss/postcss | 4.1.18 | PostCSS 플러그인 |
| PostCSS | 8.5.6 | CSS 후처리 |
| Autoprefixer | 10.4.23 | 브라우저 호환성 |

### HTTP 통신

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| Axios | 1.6.0 | API 요청/응답 처리 |

### 데이터 시각화

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| Recharts | 3.6.0 | 차트 라이브러리 |

### UI 컴포넌트

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| Lucide React | 0.562.0 | 아이콘 라이브러리 |

### 빌드 도구

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| Vite | 7.2.4 | 개발 서버/번들러 |
| @vitejs/plugin-react | 5.1.1 | React 지원 |

### 코드 품질

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| ESLint | 9.39.1 | 코드 린팅 |
| eslint-plugin-react-hooks | 7.0.1 | React Hooks 규칙 |
| eslint-plugin-react-refresh | 0.4.24 | HMR 지원 |

### 타입 정의

| 라이브러리 | 버전 | 설명 |
|-----------|------|------|
| @types/react | 19.2.5 | React 타입 정의 |
| @types/react-dom | 19.2.3 | React DOM 타입 정의 |

---

## AI 모델

### LLM (대화형 AI)

| 모델 | 형식 | 용도 |
|------|------|------|
| LLaMA 3 Korean Bllossom 8B | GGUF (Q4_K_M) | 챗봇 대화, RAG 응답 생성, 한글→영어 번역 |
| EXAONE 3.5 | GGUF | 한국어 특화 LLM (대안) |

**모델 저장 경로**: `/ai_models/llm/`

### 이미지 생성

| 모델 | 형식 | 용도 |
|------|------|------|
| SD 3.5 Medium | GGUF (Q8_0) | 고품질 이미지 생성 (28 스텝, CFG 4.5) |

**모델 저장 경로**: `/ai_models/image/` (unet, clip, vae 분리)

**이미지 생성 인프라**:
| 기술 | 설명 |
|------|------|
| ComfyUI | 이미지 생성 서버 (사이드카 컨테이너, PC2) |
| ComfyUI-GGUF | GGUF 모델 로딩 커스텀 노드 |
| websocket-client | ComfyUI API 통신 |
| Pillow | 이미지 후처리 |

### 음성 인식 (STT)

| 모델 | 형식 | 용도 |
|------|------|------|
| Faster Whisper Large-v3 | CTranslate2 (INT8) | 회의록 음성 전사 |

**모델 저장 경로**: `/models/whisper/`

### 임베딩 모델

| 모델 | 용도 |
|------|------|
| jhgan/ko-sbert-nli | 한국어 문서 임베딩 (한국어 자연어 추론 학습) |
| sentence-transformers/all-MiniLM-L6-v2 | 다국어 임베딩 (대안) |

---

## 인프라

### 컨테이너

| 기술 | 설명 |
|------|------|
| Docker | 컨테이너 런타임 |
| Docker Compose | 멀티 컨테이너 오케스트레이션 |

### 데이터베이스

| 기술 | 포트 | 설명 |
|------|------|------|
| MySQL 8.0 | 3306 | 관계형 데이터베이스 |
| Redis Alpine | 6379 | 인메모리 캐시/메시지 브로커 |
| ChromaDB | - | 벡터 데이터베이스 (임베디드) |

### GPU 지원

| 기술 | 설명 |
|------|------|
| NVIDIA Container Toolkit | Docker GPU 가속 |
| CUDA 12.1 | GPU 컴퓨팅 플랫폼 |

### 파일 공유

| 기술 | 설명 |
|------|------|
| CIFS/SMB | Windows 네트워크 공유 (모델 파일) |

---

## 지원 파일 형식

### 문서 업로드

| 형식 | 확장자 | 처리 방식 |
|------|--------|----------|
| PDF | .pdf | PyPDF로 텍스트 추출 후 RAG 인덱싱 |
| Word | .docx | python-docx로 텍스트 추출 |
| 텍스트 | .txt | 직접 읽기 |

### 회의록 음성

| 형식 | 확장자 | 처리 방식 |
|------|--------|----------|
| MP3 | .mp3 | Whisper STT 변환 |
| WAV | .wav | Whisper STT 변환 |
| M4A | .m4a | Whisper STT 변환 |
| MP4 | .mp4 | 오디오 추출 후 STT |
| WebM | .webm | 오디오 추출 후 STT |

### 이미지 생성

| 형식 | 확장자 | 설명 |
|------|--------|------|
| PNG | .png | 생성된 이미지 저장 형식 |

---

## 아키텍처

### 시스템 구성도 (분산 아키텍처)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Client (Browser)                                    │
└───────────────────────────────────┬─────────────────────────────────────────────┘
                                    │ HTTP/REST
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────────────────┐
│  Master Frontend  │    │   Web Frontend    │    │       External Access         │
│   Port: 5173      │    │   Port: 5174      │    │    (Other PCs in Network)     │
└─────────┬─────────┘    └─────────┬─────────┘    └───────────────────────────────┘
          │                        │
          ▼                        ▼
┌───────────────────┐    ┌───────────────────┐
│  Master Backend   │    │   Web Backend     │
│   Port: 8000      │    │   Port: 8001      │
│  (dot_backend)    │    │ (dot_backend_web) │
└─────────┬─────────┘    └─────────┬─────────┘
          │                        │
          └────────────┬───────────┘
                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        Master Server (PC1: 192.168.0.9)                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                         Shared Services                                      │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │ │
│  │  │    MySQL 8.0    │  │  Redis Alpine   │  │      AI Models (GPU)        │  │ │
│  │  │   Port: 3306    │  │   Port: 6379    │  │  ┌─────────────────────────┐│  │ │
│  │  │  ┌───────────┐  │  │  ┌───────────┐  │  │  │ LLM: Bllossom 8B (GGUF)││  │ │
│  │  │  │ users     │  │  │  │ Cache     │  │  │  │ Embedding: ko-sbert-nli ││  │ │
│  │  │  │ sessions  │  │  │  │ Broker    │  │  │  │ (Image: PC2 ComfyUI)   ││  │ │
│  │  │  │ documents │  │  │  │ Stream Q  │  │  │  └─────────────────────────┘│  │ │
│  │  │  │ images    │  │  │  └───────────┘  │  │  VRAM 관리:                 │  │ │
│  │  │  │ meetings  │  │  │                 │  │  - LLM 전용 (Image는 PC2)    │  │ │
│  │  │  │ logs      │  │  │                 │  │  - Thread Lock 기반 동시성  │  │ │
│  │  │  └───────────┘  │  │                 │  └─────────────────────────────┘  │ │
│  │  └─────────────────┘  └─────────────────┘                                    │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Celery Task Queue (Redis)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        Worker Server (PC2: 192.168.0.17)                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                         Celery Worker                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐    │ │
│  │  │  Background Tasks (Heavy AI Processing)                              │    │ │
│  │  │  - PDF → Vector 변환 (RAG Ingestion)                                │    │ │
│  │  │  - 문서 임베딩 (ChromaDB 저장)                                       │    │ │
│  │  │  - 음성 → 텍스트 변환 (Whisper STT)                                  │    │ │
│  │  │  - 채팅 메시지 DB 저장                                               │    │ │
│  │  └─────────────────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### VRAM 동시성 제어

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      GPU VRAM Management (RTX 4060 Ti 8GB)                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  llm_lock (threading.Lock)                                               │    │
│  │  ├─ 채팅 요청: ensure_loaded() → LLM 사용                                │    │
│  │  ├─ 번역 요청: LLM 사용 → 이미지 생성 전 언로드                          │    │
│  │  └─ 이미지 생성 후: 자동 재로드                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  _generation_lock (threading.Lock)                                       │    │
│  │  └─ 이미지 생성: 한 번에 하나의 요청만 처리 (순차 처리)                   │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  이미지 생성 플로우:                                                     │    │
│  │  1. 한글 프롬프트 감지 → LLM으로 영어 번역                               │    │
│  │  2. Celery Task → PC2 Worker 전달                                       │    │
│  │  3. ComfyUI (SD 3.5 Medium GGUF)로 이미지 생성                          │    │
│  │  4. 생성된 이미지 PC1으로 반환                                           │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

```
사용자 요청 → Frontend → Backend API → 처리 분기 → 응답
                              │
                              ├── 동기 처리 (Backend 직접):
                              │   ├── 인증, CRUD, 간단한 조회
                              │   └── 챗봇 응답 생성 (LLM 스트리밍)
                              │
                              └── 비동기 처리 (Celery Worker, PC2):
                                  ├── 이미지 생성 (ComfyUI + SD 3.5 Medium)
                                  ├── PDF → Vector 변환 (RAG Ingestion)
                                  ├── 음성 전사 (Whisper STT)
                                  ├── 문서 임베딩 (ChromaDB)
                                  └── 채팅 메시지 DB 저장
```

### Docker Compose 구조

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  docker-compose-master.yml (PC1 - Master)                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  backend    │ │  frontend   │ │     db      │ │    redis    │           │
│  │  Port 8000  │ │  Port 5173  │ │  Port 3306  │ │  Port 6379  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  Network: dot_network                                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  docker-compose-web.yml (개발용 - 원격 PC에서 Master DB/Redis 사용)        │
│  ┌─────────────┐ ┌─────────────┐                                           │
│  │  backend    │ │  frontend   │  → MASTER_IP로 DB/Redis 접속             │
│  │  Port 8001  │ │  Port 5174  │                                           │
│  └─────────────┘ └─────────────┘                                           │
│  Network: dot_web_network (독립 bridge)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 기능별 기술 매핑

| 기능 | Frontend | Backend | AI/DB |
|------|----------|---------|-------|
| **로그인/회원가입** | React Router, Axios | FastAPI, Passlib, bcrypt | MySQL (Users) |
| **챗봇 대화** | useState, 커스텀 스트리밍 (Redis Queue) | FastAPI + Redis Queue | LLaMA 3 Bllossom + RAG (ko-sbert-nli) + ChromaDB |
| **이미지 생성** | FormData, Axios | FastAPI → Celery Worker | ComfyUI (SD 3.5 Medium GGUF) + LLM 번역 |
| **문서 관리** | FormData, Axios | Celery Worker | PyPDF + ChromaDB (벡터화) |
| **회의록 분석** | Audio upload, Axios | Celery Worker | Whisper STT + LLM 요약 |
| **일정 관리** | Custom Calendar | FastAPI CRUD | MySQL (Schedules) |
| **대시보드** | Recharts (Charts) | 집계 API, psutil | MySQL (SystemLog) |
| **관리자 설정** | Form controls | FastAPI CRUD | MySQL (Users, Depts) |

---

## 관리자 대시보드 - 성공률 지표

### 개요

관리자 대시보드에 표시되는 **성공률**은 시스템 전체의 작업 성공/실패 비율을 나타냅니다.

### 데이터 흐름

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   SystemLog     │ ──▶  │  Backend API    │ ──▶  │   Frontend      │
│   (MySQL)       │      │  /api/admin/    │      │   StatCards     │
│                 │      │  stats          │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

### Backend 로직 (`main.py`)

```python
# SystemLog 테이블에서 action 필드 기준으로 집계
success_logs = db.query(SystemLog).filter(
    SystemLog.action.like("%SUCCESS%")
).count()

fail_logs = db.query(SystemLog).filter(
    SystemLog.action.like("%FAIL%")
).count()
```

### Frontend 계산 (`StatCards.jsx`)

```javascript
const totalActions = successLogs + failLogs;
const successRate = totalActions > 0
    ? Math.round((successLogs / totalActions) * 100)
    : 100;  // 로그가 없으면 100%
```

### 성공률 계산 기준

| 항목 | 내용 |
|------|------|
| **대상 테이블** | `SystemLog` |
| **성공 조건** | `action` 필드에 `SUCCESS` 문자열 포함 |
| **실패 조건** | `action` 필드에 `FAIL` 문자열 포함 |
| **계산식** | `성공 로그 수 / (성공 + 실패) × 100` |
| **기본값** | 로그가 없을 경우 100% |

### UI 표시 기준

| 성공률 | 아이콘 | 색상 | 의미 |
|--------|--------|------|------|
| 90% 이상 | CheckCircle | 초록색 (green) | 정상 |
| 90% 미만 | XCircle | 빨간색 (red) | 주의 필요 |

### 포함되는 로그 유형

| 작업 | 성공 로그 | 실패 로그 |
|------|----------|----------|
| 로그인 | `LOGIN_SUCCESS` | `LOGIN_FAIL` |
| 문서 업로드 | `DOC_UPLOAD_SUCCESS` | `DOC_UPLOAD_FAIL` |
| 챗봇 응답 | `AI_CHAT_SUCCESS` | `AI_CHAT_FAIL` |
| 회의록 분석 | `MEETING_CREATE_SUCCESS` / `MEETING_UPLOAD_SUCCESS` | `MEETING_UPLOAD_FAIL` |
| 이미지 생성 | `IMAGE_GENERATE_REQUEST` | - |

### 갱신 주기

- **자동 갱신**: 30초마다 API 호출하여 최신 데이터 반영
- **수동 갱신**: 페이지 새로고침

---

## AIDot Admin Portal 기술 스택

> AIDot 본체와 독립적으로 배포되는 관리 포털

### 웹 프레임워크

| 기술 | 버전 | 설명 |
|------|------|------|
| Spring Boot | 4.0.1 | 관리 포털 서버 |
| Java | 17 (LTS) | 런타임 |
| Thymeleaf | 3.x (Boot 내장) | 서버 사이드 렌더링 템플릿 |
| Spring Security | 6.x (Boot 내장) | 인증·인가 |

### 프론트엔드

| 기술 | 설명 |
|------|------|
| Thymeleaf + Bootstrap 5 | SSR 기반 반응형 UI |
| HTML / CSS / JS | 네이티브 웹 기술 |

### 배포

| 항목 | 내용 |
|------|------|
| 빌드 | Maven Wrapper (mvnw) |
| 포트 | 독립 포트 (AIDot 본체와 별도) |
| DB | 필요 시 독립 DB 또는 AIDot DB 공유 |

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [REQUIREMENTS.md](./REQUIREMENTS.md) | 요구사항 정의서 |
| [USE_CASES.md](./USE_CASES.md) | 유스케이스 다이어그램 |
| [SCREEN_DESIGN.md](./SCREEN_DESIGN.md) | 화면 설계서 |
| [TEST_CASES.md](./TEST_CASES.md) | 테스트 케이스 |

---

*최종 업데이트: 2026-02-07*