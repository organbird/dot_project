# Ai DOT 시스템 요구사항 정의서

## 문서 정보

| 항목 | 내용 |
|------|------|
| 프로젝트명 | Ai DOT (AI 기반 업무 협업 플랫폼) |
| 문서 버전 | 1.6 |
| 작성일 | 2026-02-07 |
| 작성자 | 김다흰 (PM / AI) |

---

## 1. 프로젝트 개요

### 1.1 프로젝트 목적
Ai DOT는 기업 내 업무 효율성을 향상시키기 위한 AI 기반 통합 업무 협업 플랫폼입니다.
문서 관리, AI 챗봇, 이미지 생성, 회의록 분석, 일정 관리 등 다양한 기능을 제공하여
스마트한 업무 환경을 구축하는 것을 목표로 합니다.

### 1.2 프로젝트 범위
- AI 기반 대화형 챗봇 서비스
- AI 이미지 생성 서비스
- 문서 업로드 및 관리 시스템
- 음성 기반 회의록 분석 시스템
- 일정 관리 캘린더 시스템
- 사용자 및 부서 관리 시스템
- 시스템 모니터링 대시보드
- **AIDot Admin Portal** (독립 배포 관리 포털)

### 1.3 용어 정의

| 용어 | 설명 |
|------|------|
| USER | 일반 사용자 권한 |
| ADMIN | 시스템 관리자 권한 |
| 세션 | AI 챗봇과의 대화 단위 |
| RAG | Retrieval-Augmented Generation, 문서 기반 AI 응답 |
| STT | Speech-to-Text, 음성을 텍스트로 변환 |
| Admin Portal | AIDot Admin Portal, 독립 배포형 설치/라이선스 관리 웹 포털 |
| System Manager | Admin Portal을 통해 시스템을 배포·관리하는 운영 담당자 |

---

## 2. 시스템 구성

### 2.1 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                Client (Browser)                                  │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ HTTP
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
┌───────────────────────────┐ ┌───────────────────────────┐ ┌─────────────────────┐
│    Master Frontend        │ │     Web Frontend          │ │   External Access   │
│    :5173 (Vite)           │ │     :5174 (Vite)          │ │   (Network PCs)     │
└─────────────┬─────────────┘ └─────────────┬─────────────┘ └─────────────────────┘
              │ REST API                    │ REST API
              ▼                             ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│    Master Backend         │ │     Web Backend           │
│    :8000 (FastAPI)        │ │     :8001 (FastAPI)       │
│  ┌──────────────────────┐ │ │  ┌──────────────────────┐ │
│  │ /auth   /ai   /chat  │ │ │  │ 동일 API 구조        │ │
│  │ /image  /document    │ │ │  │ Master DB/Redis 사용 │ │
│  │ /meeting /schedule   │ │ │  └──────────────────────┘ │
│  │ /admin  /user        │ │ └─────────────┬─────────────┘
│  └──────────────────────┘ │               │
└─────────────┬─────────────┘               │
              │                             │
              └──────────────┬──────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Master Server (PC1: 192.168.0.9)                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────────────┐│
│  │   MySQL 8.0     │ │  Redis Alpine   │ │         AI Models (GPU)             ││
│  │   :3306         │ │   :6379         │ │  ┌─────────────────────────────────┐││
│  │                 │ │                 │ │  │ LLM: Bllossom 8B (GGUF)         │││
│  │  - users        │ │  - session      │ │  │ Image: SD 3.5 Medium (ComfyUI)  │││
│  │  - documents    │ │  - cache        │ │  │ Embedding: ko-sbert-nli          │││
│  │  - chat_*       │ │  - stream_queue │ │  │ (VRAM 동적 관리)                │││
│  │  - images       │ │  - task_broker  │ │  └─────────────────────────────────┘││
│  │  - meetings     │ │                 │ │                                     ││
│  │  - schedules    │ │                 │ │                                     ││
│  │  - system_logs  │ │                 │ │                                     ││
│  └─────────────────┘ └─────────────────┘ └─────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
                             │ Celery Task Queue
                             ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      Worker Server (PC2: 192.168.0.17)                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                           Celery Worker                                      ││
│  │   - PDF → Vector 변환 (RAG Ingestion)                                       ││
│  │   - 음성 → 텍스트 (Whisper STT)                                             ││
│  │   - 문서 임베딩 (ChromaDB 저장)                                              ││
│  │   - 채팅 메시지 DB 저장                                                      ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 포트 구성

| 서비스 | 포트 | 컨테이너명 | 설명 |
|--------|------|-----------|------|
| **Master Frontend** | 5173 | dot_frontend | React + Vite 개발 서버 |
| **Master Backend** | 8000 | dot_backend | FastAPI 메인 API 서버 |
| **Web Frontend** | 5174 | dot_frontend_web | 개발/테스트용 프론트엔드 |
| **Web Backend** | 8001 | dot_backend_web | 개발/테스트용 백엔드 |
| **MySQL** | 3306 | dot_db | 관계형 데이터베이스 |
| **Redis** | 6379 | dot_redis | 캐시 / 메시지 브로커 |

### 2.3 네트워크 구성

| 네트워크 | 용도 | 사용 서비스 |
|----------|------|------------|
| dot_network | Master 내부 통신 | backend, frontend, db, redis |
| dot-project_dot_network | Web ↔ Master 연결 | web_backend, web_frontend (external) |

### 2.4 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | React 19, Vite 7, TailwindCSS 4, Axios |
| Backend | FastAPI 0.109, Python 3.10+, SQLAlchemy 2.0 |
| Database | MySQL 8.0, Redis, ChromaDB |
| AI/ML | LLaMA 3 Bllossom 8B (LLM), SD 3.5 Medium GGUF (이미지, ComfyUI), Whisper (STT) |
| Infrastructure | Docker, Docker Compose, NVIDIA Container Toolkit |
| Task Queue | Celery + Redis (분산 처리) |

---

## 3. 기능 요구사항

### 3.1 사용자 관리 (UR: User Requirement)

#### UR-001: 회원가입
| 항목 | 내용 |
|------|------|
| 요구사항 ID | UR-001 |
| 요구사항명 | 회원가입 기능 |
| 우선순위 | High |
| 설명 | 신규 사용자가 시스템에 가입할 수 있어야 한다 |
| 상세 요구사항 | - 이메일 (필수, 최대 50자, 중복 불가)<br>- 이름 (필수, 2~50자)<br>- 비밀번호 (필수, 4~20자)<br>- 연락처 (필수, 010-XXXX-XXXX 형식)<br>- 성별 (필수, 남/여)<br>- 부서 (필수, 목록에서 선택) |
| 입력 검증 | - 이메일 형식 검증<br>- 비밀번호 길이 검증<br>- 연락처 형식 자동 변환 |
| 관련 유스케이스 | UC-AUTH-001 |
| 관련 화면 | SCR-002 |
| 관련 테스트케이스 | TC-SGN-001 ~ TC-SGN-015 |

#### UR-002: 로그인
| 항목 | 내용 |
|------|------|
| 요구사항 ID | UR-002 |
| 요구사항명 | 로그인 기능 |
| 우선순위 | High |
| 설명 | 등록된 사용자가 시스템에 로그인할 수 있어야 한다 |
| 상세 요구사항 | - 이메일과 비밀번호로 인증<br>- 로그인 성공 시 역할에 따른 페이지 이동 (USER→홈, ADMIN→대시보드)<br>- 로그인 정보 로컬 스토리지 저장 |
| 관련 유스케이스 | UC-AUTH-002 |
| 관련 화면 | SCR-001 |
| 관련 테스트케이스 | TC-LGN-001 ~ TC-LGN-011 |

#### UR-003: 로그아웃
| 항목 | 내용 |
|------|------|
| 요구사항 ID | UR-003 |
| 요구사항명 | 로그아웃 기능 |
| 우선순위 | High |
| 설명 | 로그인된 사용자가 시스템에서 로그아웃할 수 있어야 한다 |
| 상세 요구사항 | - 로컬 스토리지 사용자 정보 삭제<br>- 로그인 페이지로 리다이렉트 |
| 관련 유스케이스 | UC-AUTH-003 |
| 관련 화면 | 공통 (사이드바) |
| 관련 테스트케이스 | TC-NAV-004 |

#### UR-004: 개인정보 관리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | UR-004 |
| 요구사항명 | 개인정보 조회 및 수정 |
| 우선순위 | Medium |
| 설명 | 사용자가 자신의 개인정보를 조회하고 수정할 수 있어야 한다 |
| 상세 요구사항 | - 프로필 정보 조회 (이름, 이메일, 부서, 가입일, 역할)<br>- 이름 수정 (2~50자)<br>- 연락처 수정<br>- 비밀번호 변경 (현재 비밀번호 확인 필요) |
| 관련 유스케이스 | UC-USER-001 |
| 관련 화면 | SCR-004 |
| 관련 테스트케이스 | TC-MYP-001 ~ TC-MYP-014 |

#### UR-005: 활동 통계 조회
| 항목 | 내용 |
|------|------|
| 요구사항 ID | UR-005 |
| 요구사항명 | 사용자 활동 통계 |
| 우선순위 | Low |
| 설명 | 사용자가 자신의 시스템 활동 통계를 조회할 수 있어야 한다 |
| 상세 요구사항 | - 전체 활동 통계 (AI 대화, 문서, 이미지, 회의록, 일정 수)<br>- 이번 달 활동 통계 |
| 관련 유스케이스 | UC-USER-001 |
| 관련 화면 | SCR-003, SCR-004 |
| 관련 테스트케이스 | TC-HOM-001 ~ TC-HOM-014, TC-MYP-003 ~ TC-MYP-004 |

---

### 3.2 AI 챗봇 (CR: Chatbot Requirement)

#### CR-001: 대화 세션 관리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | CR-001 |
| 요구사항명 | 대화 세션 관리 |
| 우선순위 | High |
| 설명 | 사용자가 AI 챗봇과의 대화를 세션 단위로 관리할 수 있어야 한다 |
| 상세 요구사항 | - 새 대화 세션 생성<br>- 세션 목록 조회<br>- 세션 선택 및 대화 내역 로딩<br>- 세션 제목 수정 (최대 255자)<br>- 세션 삭제 |
| 관련 유스케이스 | UC-CHAT-001 |
| 관련 화면 | SCR-005 |
| 관련 테스트케이스 | TC-CHT-001, TC-CHT-006 ~ TC-CHT-011, TC-CHT-015 |

#### CR-002: AI 대화
| 항목 | 내용 |
|------|------|
| 요구사항 ID | CR-002 |
| 요구사항명 | AI 대화 기능 |
| 우선순위 | High |
| 설명 | 사용자가 AI와 실시간으로 대화할 수 있어야 한다 |
| 상세 요구사항 | - 메시지 입력 및 전송<br>- 스트리밍 방식 실시간 응답 표시<br>- 대화 내역 유지<br>- 응답 생성 중단 기능 |
| 관련 유스케이스 | UC-CHAT-001 |
| 관련 화면 | SCR-005 |
| 관련 테스트케이스 | TC-CHT-002 ~ TC-CHT-005, TC-CHT-016 ~ TC-CHT-017 |

#### CR-003: 문서 기반 응답
| 항목 | 내용 |
|------|------|
| 요구사항 ID | CR-003 |
| 요구사항명 | RAG 기반 문서 참조 응답 |
| 우선순위 | Medium |
| 설명 | AI가 업로드된 문서를 참조하여 응답할 수 있어야 한다 |
| 상세 요구사항 | - 업로드된 문서 벡터화 저장<br>- 질문 관련 문서 검색<br>- 참고 문서 정보 표시 |
| 관련 유스케이스 | UC-CHAT-001 |
| 관련 화면 | SCR-005 |
| 관련 테스트케이스 | TC-CHT-004 |

---

### 3.3 이미지 생성 (IR: Image Requirement)

#### IR-001: AI 이미지 생성
| 항목 | 내용 |
|------|------|
| 요구사항 ID | IR-001 |
| 요구사항명 | AI 이미지 생성 |
| 우선순위 | High |
| 설명 | 사용자가 텍스트 프롬프트로 이미지를 생성할 수 있어야 한다 |
| 상세 요구사항 | - 프롬프트 입력 (한글/영어 모두 지원)<br>- 한글 프롬프트 자동 영어 번역 (LLM 활용)<br>- 스타일 선택 (기업/비즈니스, 제품 촬영, 포스터/타이포, 사실적, 애니메이션, 만화)<br>- 크기 선택 (512x512, 768x768, 1024x1024)<br>- SD 3.5 Medium GGUF 모델 사용 (ComfyUI, 28 스텝) |
| 관련 유스케이스 | UC-IMG-001 |
| 관련 화면 | SCR-006 |
| 관련 테스트케이스 | TC-IMG-001 ~ TC-IMG-003, TC-IMG-009, TC-IMG-012 ~ TC-IMG-014 |

#### IR-002: 이미지 갤러리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | IR-002 |
| 요구사항명 | 생성 이미지 관리 |
| 우선순위 | Medium |
| 설명 | 생성된 이미지를 갤러리 형태로 관리할 수 있어야 한다 |
| 상세 요구사항 | - 이미지 목록 조회 (페이지당 12개)<br>- 프롬프트 검색<br>- 이미지 상세 보기<br>- 이미지 다운로드<br>- 이미지 삭제 |
| 관련 유스케이스 | UC-IMG-001 |
| 관련 화면 | SCR-006 |
| 관련 테스트케이스 | TC-IMG-004 ~ TC-IMG-008, TC-IMG-010 ~ TC-IMG-011 |

---

### 3.4 문서 관리 (DR: Document Requirement)

#### DR-001: 문서 업로드
| 항목 | 내용 |
|------|------|
| 요구사항 ID | DR-001 |
| 요구사항명 | 문서 업로드 |
| 우선순위 | High |
| 설명 | 사용자가 다양한 형식의 문서를 업로드할 수 있어야 한다 |
| 상세 요구사항 | - 지원 형식: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, HWP<br>- 제목 입력 (최대 255자)<br>- 카테고리 선택 (업무, 개인, 아이디어)<br>- 요약 입력 (선택) |
| 관련 유스케이스 | UC-DOC-001 |
| 관련 화면 | SCR-007 |
| 관련 테스트케이스 | TC-DOC-002 ~ TC-DOC-006, TC-DOC-018 |

#### DR-002: 문서 목록 조회
| 항목 | 내용 |
|------|------|
| 요구사항 ID | DR-002 |
| 요구사항명 | 문서 목록 및 검색 |
| 우선순위 | High |
| 설명 | 업로드된 문서를 목록으로 조회하고 검색할 수 있어야 한다 |
| 상세 요구사항 | - 문서 목록 테이블 (번호, 문서명, 형식, 크기, 등록일)<br>- 카테고리 필터링<br>- 제목/내용 검색<br>- 페이지네이션 (10개/페이지) |
| 관련 유스케이스 | UC-DOC-002 |
| 관련 화면 | SCR-007 |
| 관련 테스트케이스 | TC-DOC-001, TC-DOC-007 ~ TC-DOC-009, TC-DOC-015 ~ TC-DOC-017 |

#### DR-003: 문서 관리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | DR-003 |
| 요구사항명 | 문서 상세 및 관리 |
| 우선순위 | Medium |
| 설명 | 문서의 상세 정보를 조회하고 관리할 수 있어야 한다 |
| 상세 요구사항 | - 문서 상세 조회 (메타정보, 요약)<br>- 문서 정보 수정 (제목, 카테고리, 요약)<br>- 문서 삭제<br>- 원본 파일 다운로드 |
| 관련 유스케이스 | UC-DOC-002 |
| 관련 화면 | SCR-007 |
| 관련 테스트케이스 | TC-DOC-010 ~ TC-DOC-014 |

---

### 3.5 회의록 분석 (MR: Meeting Requirement)

#### MR-001: 회의록 작성
| 항목 | 내용 |
|------|------|
| 요구사항 ID | MR-001 |
| 요구사항명 | 회의록 직접 작성 |
| 우선순위 | High |
| 설명 | 사용자가 회의록을 직접 텍스트로 작성할 수 있어야 한다 |
| 상세 요구사항 | - 제목 입력 (최대 255자)<br>- 참석자 입력 (쉼표 구분)<br>- 회의 시간 입력 (초 단위)<br>- 회의 내용 입력<br>- 요약 입력 |
| 관련 유스케이스 | UC-MTG-001 |
| 관련 화면 | SCR-008 |
| 관련 테스트케이스 | TC-MTG-001, TC-MTG-003 ~ TC-MTG-005 |

#### MR-002: 음성 파일 업로드
| 항목 | 내용 |
|------|------|
| 요구사항 ID | MR-002 |
| 요구사항명 | 회의 녹음 파일 업로드 |
| 우선순위 | High |
| 설명 | 회의 녹음 파일을 업로드하여 자동 분석할 수 있어야 한다 |
| 상세 요구사항 | - 지원 형식: MP3, WAV, M4A, OGG, WebM, MP4<br>- STT(음성→텍스트) 변환<br>- AI 기반 자동 요약 생성<br>- 처리 상태 표시 (대기중, 처리중, 완료, 오류) |
| 관련 유스케이스 | UC-MTG-001 |
| 관련 화면 | SCR-008 |
| 관련 테스트케이스 | TC-MTG-002, TC-MTG-006, TC-MTG-012, TC-MTG-015 |

#### MR-003: 회의록 관리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | MR-003 |
| 요구사항명 | 회의록 조회 및 관리 |
| 우선순위 | Medium |
| 설명 | 작성된 회의록을 조회하고 관리할 수 있어야 한다 |
| 상세 요구사항 | - 회의록 목록 조회<br>- 제목 검색<br>- 상세 보기 (전문, 요약, 참석자)<br>- 회의록 수정<br>- 회의록 삭제 |
| 관련 유스케이스 | UC-MTG-002 |
| 관련 화면 | SCR-008 |
| 관련 테스트케이스 | TC-MTG-007 ~ TC-MTG-011, TC-MTG-013 ~ TC-MTG-014 |

---

### 3.6 일정 관리 (SR: Schedule Requirement)

#### SR-001: 캘린더 뷰
| 항목 | 내용 |
|------|------|
| 요구사항 ID | SR-001 |
| 요구사항명 | 월별 캘린더 표시 |
| 우선순위 | High |
| 설명 | 월별 캘린더 형태로 일정을 표시해야 한다 |
| 상세 요구사항 | - 월별 캘린더 그리드<br>- 오늘 날짜 강조 표시<br>- 날짜별 일정 개수 표시<br>- 이전/다음 월 이동<br>- "오늘" 버튼 |
| 관련 유스케이스 | UC-SCH-001 |
| 관련 화면 | SCR-009 |
| 관련 테스트케이스 | TC-SCH-001 ~ TC-SCH-005, TC-SCH-013 |

#### SR-002: 일정 등록
| 항목 | 내용 |
|------|------|
| 요구사항 ID | SR-002 |
| 요구사항명 | 일정 추가 |
| 우선순위 | High |
| 설명 | 새로운 일정을 등록할 수 있어야 한다 |
| 상세 요구사항 | - 일정 제목 (최대 100자)<br>- 날짜 선택<br>- 시작/종료 시간<br>- 카테고리 (일반, 업무, 회의, 개인, 중요)<br>- 상세 내용 (선택) |
| 관련 유스케이스 | UC-SCH-001 |
| 관련 화면 | SCR-009 |
| 관련 테스트케이스 | TC-SCH-006 ~ TC-SCH-009, TC-SCH-012 |

#### SR-003: 일정 관리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | SR-003 |
| 요구사항명 | 일정 조회 및 관리 |
| 우선순위 | Medium |
| 설명 | 등록된 일정을 조회하고 관리할 수 있어야 한다 |
| 상세 요구사항 | - 날짜별 일정 목록<br>- 일정 상세 보기<br>- 일정 수정<br>- 일정 삭제<br>- 카테고리별 색상 구분 |
| 관련 유스케이스 | UC-SCH-001 |
| 관련 화면 | SCR-009 |
| 관련 테스트케이스 | TC-SCH-010 ~ TC-SCH-011, TC-SCH-014 ~ TC-SCH-015 |

---

### 3.7 관리자 기능 (AR: Admin Requirement)

#### AR-001: 시스템 대시보드
| 항목 | 내용 |
|------|------|
| 요구사항 ID | AR-001 |
| 요구사항명 | 시스템 모니터링 대시보드 |
| 우선순위 | High |
| 설명 | 관리자가 시스템 전반을 모니터링할 수 있어야 한다 |
| 상세 요구사항 | - 서버 리소스 현황 (CPU, 메모리, 디스크)<br>- 실행 중인 프로세스 목록<br>- 통계 카드 (사용자, 문서, 이미지 수 등)<br>- 일별 활동 추이 차트<br>- AI 기능 사용 현황 차트<br>- 부서별 인원/활동 분포<br>- 실시간 시스템 로그 |
| 관련 유스케이스 | UC-ADM-001 |
| 관련 화면 | SCR-010 |
| 관련 테스트케이스 | TC-DSH-001 ~ TC-DSH-011 |

#### AR-002: 사용자 관리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | AR-002 |
| 요구사항명 | 사용자 계정 관리 |
| 우선순위 | High |
| 설명 | 관리자가 전체 사용자 계정을 관리할 수 있어야 한다 |
| 상세 요구사항 | - 사용자 목록 조회<br>- 사용자 검색<br>- 권한 변경 (USER ↔ ADMIN)<br>- 비밀번호 초기화 |
| 관련 유스케이스 | UC-ADM-002 |
| 관련 화면 | SCR-011 |
| 관련 테스트케이스 | TC-ADU-001 ~ TC-ADU-008 |

#### AR-003: 부서 관리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | AR-003 |
| 요구사항명 | 부서 및 인원 관리 |
| 우선순위 | Medium |
| 설명 | 관리자가 부서와 소속 인원을 관리할 수 있어야 한다 |
| 상세 요구사항 | - 부서 목록 조회<br>- 부서별 소속 직원 조회<br>- 직원 부서 이동<br>- 부서 추가/삭제 |
| 관련 유스케이스 | UC-ADM-003 |
| 관련 화면 | SCR-012 |
| 관련 테스트케이스 | TC-DPT-001 ~ TC-DPT-007, TC-DPM-001 ~ TC-DPM-008 |

---

### 3.8 AIDot Admin Portal (APR: Admin Portal Requirement)

#### APR-001: Admin Portal 인덱스
| 항목 | 내용 |
|------|------|
| 요구사항 ID | APR-001 |
| 요구사항명 | Admin Portal 메인 페이지 |
| 우선순위 | High |
| 설명 | System Manager가 Admin Portal에 접속하여 AIDot 시스템 개요를 확인할 수 있어야 한다 |
| 상세 요구사항 | - 시스템 소개 및 주요 기능 안내<br>- 다운로드/로그인/라이선스 페이지 네비게이션<br>- Spring Boot + Thymeleaf SSR 페이지 |
| 관련 유스케이스 | UC-APR-001 |
| 관련 화면 | ADM-SCR-001 |
| 관련 테스트케이스 | TC-APR-IDX-001 ~ TC-APR-IDX-003 |

#### APR-002: 설치 파일 다운로드
| 항목 | 내용 |
|------|------|
| 요구사항 ID | APR-002 |
| 요구사항명 | AIDot 설치 파일 다운로드 |
| 우선순위 | High |
| 설명 | System Manager가 AIDot 시스템 설치에 필요한 파일을 다운로드할 수 있어야 한다 |
| 상세 요구사항 | - Docker Compose, 환경설정 등 설치 패키지 다운로드<br>- 버전별 파일 관리<br>- 다운로드 이력 기록 |
| 관련 유스케이스 | UC-APR-002 |
| 관련 화면 | ADM-SCR-002 |
| 관련 테스트케이스 | TC-APR-DWN-001 ~ TC-APR-DWN-003 |

#### APR-003: Admin Portal 로그인
| 항목 | 내용 |
|------|------|
| 요구사항 ID | APR-003 |
| 요구사항명 | Admin Portal 관리자 로그인 |
| 우선순위 | High |
| 설명 | System Manager가 Admin Portal에 인증하여 관리 기능에 접근할 수 있어야 한다 |
| 상세 요구사항 | - 이메일/비밀번호 기반 인증<br>- Spring Security 폼 로그인<br>- 로그인 성공 시 대시보드 이동 |
| 관련 유스케이스 | UC-APR-003 |
| 관련 화면 | ADM-SCR-003 |
| 관련 테스트케이스 | TC-APR-LGN-001 ~ TC-APR-LGN-003 |

#### APR-004: 배포 현황 대시보드
| 항목 | 내용 |
|------|------|
| 요구사항 ID | APR-004 |
| 요구사항명 | 배포 현황 모니터링 대시보드 |
| 우선순위 | High |
| 설명 | System Manager가 AIDot 시스템의 배포 현황과 라이선스 상태를 한눈에 파악할 수 있어야 한다 |
| 상세 요구사항 | - 설치 현황 통계 (총 설치 수, 활성 라이선스 수)<br>- 최근 배포/업데이트 이력<br>- 시스템 상태 요약 |
| 관련 유스케이스 | UC-APR-004 |
| 관련 화면 | ADM-SCR-004 |
| 관련 테스트케이스 | TC-APR-DEP-001 ~ TC-APR-DEP-004 |

#### APR-005: 라이선스 관리
| 항목 | 내용 |
|------|------|
| 요구사항 ID | APR-005 |
| 요구사항명 | 라이선스 발급 및 관리 |
| 우선순위 | High |
| 설명 | System Manager가 AIDot 설치 인스턴스에 대한 라이선스를 발급하고 관리할 수 있어야 한다 |
| 상세 요구사항 | - 라이선스 키 발급<br>- 라이선스 유효기간 설정<br>- 라이선스 활성/비활성 관리<br>- 라이선스 목록 조회 |
| 관련 유스케이스 | UC-APR-005 |
| 관련 화면 | ADM-SCR-005 |
| 관련 테스트케이스 | TC-APR-LIC-001 ~ TC-APR-LIC-003 |

#### APR-006: Admin Portal 기술 스택
| 항목 | 내용 |
|------|------|
| 요구사항 ID | APR-006 |
| 요구사항명 | Admin Portal 독립 기술 스택 |
| 우선순위 | Medium |
| 설명 | Admin Portal은 AIDot 본체와 독립된 기술 스택으로 구현한다 |
| 상세 요구사항 | - Spring Boot 4.0.1 / Java 17<br>- Thymeleaf 서버 사이드 렌더링<br>- 독립 배포 (별도 포트) |

---

## 4. 비기능 요구사항

### 4.1 성능 요구사항 (PR: Performance Requirement)

| ID | 요구사항명 | 설명 | 목표치 |
|----|----------|------|--------|
| PR-001 | 페이지 로딩 속도 | 동시 접속 환경에서 각 페이지 초기 로딩 시간 | 1초 이내 |
| PR-002 | API 응답 시간 | 동시 접속 환경에서 일반 API 요청 응답 시간 | 1초 이내 |
| PR-003 | 챗봇 서비스 응답 | LLM 기반 RAG 챗봇 응답 시간 | 3초 이내 |
| PR-004 | 이미지 생성 시간 (512px) | SD 3.5 Medium 이미지 생성 (ComfyUI Worker) | 2분 이내 |
| PR-005 | STT 변환 시간 | Faster Whisper 음성-텍스트 변환 (1.5시간 음성 기준) | 10분 이내 |
| PR-006 | 동시 접속자 | 동시 접속 가능 사용자 수 | 50명 이상 |

### 4.2 보안 요구사항 (SEC: Security Requirement)

| ID | 요구사항명 | 설명 |
|----|----------|------|
| SEC-001 | JWT 인증 | JWT 토큰 기반 인증 (python-jose 사용), 로컬 스토리지 저장 |
| SEC-002 | 권한 기반 접근 제어 | 역할(USER/ADMIN)에 따른 기능 접근 제한 |
| SEC-003 | 비밀번호 암호화 | 비밀번호 해시화 저장 (bcrypt) |
| SEC-004 | XSS 방지 | 사용자 입력값 이스케이프 처리 |
| SEC-005 | SQL Injection 방지 | ORM 사용 및 파라미터 바인딩 |
| SEC-006 | 데이터 격리 | 사용자별 데이터 접근 격리 |
| SEC-007 | 토큰 만료 | JWT 토큰 만료 시간 설정 (기본 24시간) |

### 4.3 사용성 요구사항 (UX: Usability Requirement)

| ID | 요구사항명 | 설명 |
|----|----------|------|
| UX-001 | 반응형 디자인 | 다양한 화면 크기 지원 (모바일, 태블릿, 데스크톱) |
| UX-002 | 다크모드 지원 | 라이트/다크 테마 전환 |
| UX-003 | 실시간 피드백 | 입력값 검증 결과 실시간 표시 |
| UX-004 | 로딩 상태 표시 | 데이터 로딩 중 시각적 피드백 |
| UX-005 | 에러 메시지 | 사용자 친화적 에러 메시지 표시 |

### 4.4 호환성 요구사항 (CP: Compatibility Requirement)

| ID | 요구사항명 | 설명 |
|----|----------|------|
| CP-001 | 브라우저 호환 | Chrome, Firefox, Edge 최신 버전 지원 |
| CP-002 | 폐쇄망 지원 | 외부 인터넷 연결 없이 동작 (로컬 리소스 사용) |
| CP-003 | Docker 환경 | Docker Compose 기반 배포 |

---

## 5. 데이터 요구사항

### 5.1 데이터 모델

#### 사용자 (users)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | INT | PK, AUTO_INCREMENT | 사용자 ID |
| email | VARCHAR(50) | UNIQUE, NOT NULL | 이메일 |
| password | VARCHAR(255) | NOT NULL | 암호화된 비밀번호 |
| name | VARCHAR(50) | NOT NULL | 이름 |
| phone | VARCHAR(20) | | 연락처 |
| role | VARCHAR(50) | DEFAULT 'USER' | 권한 (USER/ADMIN) |
| gender | CHAR(1) | DEFAULT 'M' | 성별 (M/F) |
| dept_idx | INT | FK | 부서 ID |
| created_at | DATETIME | | 가입일 |

#### 부서 (depts)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | INT | PK, AUTO_INCREMENT | 부서 ID |
| dept_name | VARCHAR(255) | NOT NULL | 부서명 |

#### 채팅 세션 (chat_sessions)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | INT | PK, AUTO_INCREMENT | 세션 ID |
| user_id | INT | FK | 사용자 ID |
| title | VARCHAR(255) | | 세션 제목 |
| status | VARCHAR(20) | DEFAULT 'ACTIVE' | 상태 (ACTIVE/ARCHIVED) |
| current_summary | TEXT | | 현재 대화 요약 |
| created_at | DATETIME | | 생성일 |
| updated_at | DATETIME | | 수정일 |

#### 채팅 메시지 (chat_messages)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | INT | PK, AUTO_INCREMENT | 메시지 ID |
| session_id | INT | FK | 세션 ID |
| sender | VARCHAR(20) | NOT NULL | 발신자 (user/assistant) |
| content | TEXT | | 메시지 내용 |
| reference_docs | JSON | | 참고 문서 정보 |
| created_at | DATETIME | | 생성일 |

#### 문서 (documents)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | INT | PK, AUTO_INCREMENT | 문서 ID |
| user_id | INT | FK | 사용자 ID |
| title | VARCHAR(255) | NOT NULL | 문서 제목 |
| category | VARCHAR(50) | | 카테고리 (업무/개인/아이디어) |
| file_name | VARCHAR(255) | | 원본 파일명 |
| file_ext | VARCHAR(20) | | 파일 확장자 |
| file_size | INT | | 파일 크기 (바이트) |
| summary | TEXT | | 문서 요약 |
| chroma_id | VARCHAR(100) | | 벡터DB ID |
| status | VARCHAR(20) | | 상태 (INDEXED 등) |
| created_at | DATETIME | | 등록일 |
| updated_at | DATETIME | | 수정일 |

#### 회의록 (meeting_notes)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | INT | PK, AUTO_INCREMENT | 회의록 ID |
| user_id | INT | FK | 사용자 ID |
| title | VARCHAR(255) | NOT NULL | 회의 제목 |
| transcript | TEXT | | 회의 전문 |
| summary | TEXT | | 요약 |
| attendees | VARCHAR(500) | | 참석자 목록 |
| duration | INT | | 회의 시간 (초) |
| fileName | VARCHAR(255) | | 음성 파일명 |
| status | VARCHAR(20) | | 처리 상태 (QUEUED/PROCESSING/COMPLETED/ERROR) |
| created_at | DATETIME | | 등록일 |
| updated_at | DATETIME | | 수정일 |

#### 일정 (schedules)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 일정 ID |
| user_id | INT | FK | 사용자 ID |
| title | VARCHAR(100) | NOT NULL | 일정 제목 |
| content | TEXT | | 상세 내용 |
| schedule_date | DATE | NOT NULL | 일정 날짜 |
| start_time | TIME | NOT NULL | 시작 시간 |
| end_time | TIME | NOT NULL | 종료 시간 |
| category | VARCHAR(30) | | 카테고리 (일반/업무/회의/개인/중요) |
| created_at | DATETIME | | 생성일 |
| updated_at | DATETIME | | 수정일 |

#### 생성 이미지 (generated_images)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | INT | PK, AUTO_INCREMENT | 이미지 ID |
| user_id | INT | FK | 생성자 ID |
| prompt | TEXT | | 생성 프롬프트 |
| img_file | VARCHAR(255) | | 저장된 파일명 |
| img_ext | VARCHAR(20) | | 파일 확장자 |
| img_size | INT | | 파일 크기 (바이트) |
| created_at | DATETIME | | 생성일 |

#### 시스템 로그 (system_logs)
| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|---------|------|
| id | INT | PK, AUTO_INCREMENT | 로그 ID |
| user_id | INT | FK | 사용자 ID |
| action | VARCHAR(50) | | 작업 유형 (LOGIN_SUCCESS/DOC_UPLOAD_SUCCESS 등) |
| target_id | INT | | 대상 ID |
| target_type | VARCHAR(50) | | 대상 타입 (DOCUMENT/CHAT_SESSION 등) |
| ip_addr | VARCHAR(50) | | 클라이언트 IP |
| details | TEXT | | 상세 정보 |
| created_at | DATETIME | | 로그 생성일 |

---

## 6. 인터페이스 요구사항

### 6.1 화면 목록

| ID | 화면명 | 경로 | 접근 권한 | 설명 |
|----|--------|------|----------|------|
| SCR-001 | 로그인 | /login | Public | 사용자 로그인 |
| SCR-002 | 회원가입 | /signup | Public | 신규 사용자 가입 |
| SCR-003 | 홈 | /home | USER, ADMIN | 사용자 대시보드 |
| SCR-004 | 마이페이지 | /mypage | USER, ADMIN | 개인정보 관리 |
| SCR-005 | AI 챗봇 | /chatbot | USER, ADMIN | AI 대화 |
| SCR-006 | 이미지 생성 | /images | USER, ADMIN | AI 이미지 |
| SCR-007 | 문서 보관함 | /documents | USER, ADMIN | 문서 관리 |
| SCR-008 | 회의록 분석 | /meeting | USER, ADMIN | 회의록 관리 |
| SCR-009 | 일정 관리 | /schedule | USER, ADMIN | 캘린더 |
| SCR-010 | 관리자 대시보드 | /dashboard | ADMIN | 시스템 모니터링 |
| SCR-011 | 사용자 관리 | /admin/settings | ADMIN | 계정 관리 |
| SCR-012 | 부서 관리 | /admin/depts | ADMIN | 부서/인원 관리 |

### 6.2 API 인터페이스

#### 인증 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /api/login | 로그인 |
| POST | /api/register | 회원가입 |

#### 사용자 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /user/{id}/home-data | 홈 데이터 조회 |
| GET | /user/{id}/mypage-data | 마이페이지 데이터 |
| PUT | /user/{id}/profile | 프로필 수정 |
| PUT | /user/{id}/password | 비밀번호 변경 |

#### 챗봇 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /chat/sessions/{user_id} | 세션 목록 |
| POST | /chat/sessions | 세션 생성 |
| GET | /chat/sessions/detail/{id} | 세션 상세 |
| PUT | /chat/sessions/{id} | 세션 수정 |
| DELETE | /chat/sessions/{id} | 세션 삭제 |
| POST | /ai/chat/stream | 대화 (스트리밍) |
| POST | /ai/chat/stop | 생성 중단 |

#### 문서 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /document/list/{user_id} | 문서 목록 |
| POST | /document/upload | 문서 업로드 |
| GET | /document/{id} | 문서 상세 |
| PUT | /document/{id} | 문서 수정 |
| DELETE | /document/{id} | 문서 삭제 |
| GET | /document/download/{id} | 파일 다운로드 |

#### 이미지 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /image/list/{user_id} | 이미지 목록 |
| POST | /image/generate | 이미지 생성 |
| DELETE | /image/{id} | 이미지 삭제 |

#### 회의록 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /meeting/list/{user_id} | 회의록 목록 |
| POST | /meeting/ | 회의록 작성 |
| POST | /meeting/upload | 파일 업로드 |
| GET | /meeting/{id} | 회의록 상세 |
| PUT | /meeting/{id} | 회의록 수정 |
| DELETE | /meeting/{id} | 회의록 삭제 |

#### 일정 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /schedule/monthly/{user_id} | 월별 일정 |
| GET | /schedule/daily/{user_id} | 일별 일정 |
| POST | /schedule/ | 일정 생성 |
| PUT | /schedule/{id} | 일정 수정 |
| DELETE | /schedule/{id} | 일정 삭제 |

#### 관리자 API
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | /api/admin/users | 사용자 목록 |
| PATCH | /api/admin/users/update | 사용자 수정 |
| GET | /api/admin/depts/{id}/users | 부서별 사용자 |
| PATCH | /api/admin/users/move-dept | 부서 이동 |

---

## 7. 환경설정

### 7.1 환경변수 목록

| 변수명 | 설명 | 기본값 | 필수 |
|--------|------|--------|------|
| MASTER_IP | 마스터 서버 IP 주소 | - | O |
| DB_USER | MySQL 사용자명 | root | O |
| DB_PASSWORD | MySQL 비밀번호 | - | O |
| DB_NAME | 데이터베이스명 | aidot_db | O |
| WORKER_DB_USER | 워커 DB 사용자명 | aidot_user | O |
| WORKER_DB_PASSWORD | 워커 DB 비밀번호 | - | O |
| REDIS_URL | Redis 연결 URL | redis://localhost:6379/0 | O |
| REDIS_DB | Redis 데이터베이스 번호 | 0 | X |
| SMB_USERNAME | SMB 공유폴더 사용자명 | - | X |
| SMB_PASSWORD | SMB 공유폴더 비밀번호 | - | X |
| SMB_SHARE | SMB 공유폴더명 | DOT_DATA | X |
| ALLOW_ORIGINS | CORS 허용 도메인 | http://localhost:5173 | O |
| VITE_API_URL | 프론트엔드 API URL | - | X |
| UPLOAD_PATH | 파일 업로드 경로 | /mnt/c/DOT_DATA | O |
| JWT_SECRET_KEY | JWT 서명 비밀키 | - | O |
| JWT_ALGORITHM | JWT 알고리즘 | HS256 | X |

### 7.2 환경설정 파일 예시

```env
# PC1 마스터 서버 IP
MASTER_IP=192.168.0.xxx

# 데이터베이스 설정 (Web/Backend)
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=aidot_db

# 데이터베이스 설정 (Worker)
WORKER_DB_USER=aidot_user
WORKER_DB_PASSWORD=your_password

# Redis 설정
REDIS_URL=redis://192.168.0.xxx:6379/0
REDIS_DB=0

# SMB/CIFS 공유 폴더 설정
SMB_USERNAME=your_username
SMB_PASSWORD=your_password
SMB_SHARE=DOT_DATA

# CORS 설정
ALLOW_ORIGINS=http://localhost:5173,http://192.168.0.xxx:5173

# Vite 설정 (동적 호스트 사용 시 비워둠)
VITE_API_URL=

# 로컬 업로드 경로
UPLOAD_PATH=/mnt/c/DOT_DATA
```

---

## 8. 제약사항

### 8.1 기술적 제약사항
- 폐쇄망 환경에서 동작해야 하므로 외부 CDN, API 사용 불가
- AI 모델은 로컬에서 실행 (GPU 서버 권장)
- 파일 업로드 용량 제한 필요 (설정 가능)

### 8.2 운영 제약사항
- Docker 환경에서 배포
- 마스터/워커 분산 구조 지원
- 정기적인 데이터 백업 필요

---

## 문서 이력

| 버전 | 변경일 | 변경자 | 변경 내용 |
|------|--------|--------|----------|
| 1.0 | 2026-01-22 | 김다흰 | 최초 작성 |
| 1.1 | 2026-01-23 | 김다흰 | JWT 인증, Redis 캐싱, 환경설정, 데이터 모델 최신화 |
| 1.2 | 2026-01-26 | 김다흰 | 이미지 생성 (SD 3.5 Medium, ComfyUI 사이드카), VRAM 동시성 제어, 한글 프롬프트 번역 추가 |
| 1.3 | 2026-02-03 | 김다흰 | 화면 경로, 접근 권한, 데이터 모델 실제 구현 기반 최신화 |
| 1.4 | 2026-02-04 | 김다흰 | 임베딩 모델명 수정 (ko-sroberta → ko-sbert-nli) |
| 1.5 | 2026-02-07 | 김다흰 | AIDot Admin Portal 요구사항 추가 (APR-001~006), 프로젝트 범위·용어 정의 확장 |
| 1.6 | 2026-02-08 | 김다흰 | 성능 요구사항을 성능 테스트 보고서 실측 기준 6개 항목으로 최신화 (PR-001~006) |