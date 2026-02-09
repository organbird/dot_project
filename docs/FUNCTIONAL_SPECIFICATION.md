# Ai DOT 기능명세서

## 문서 정보

| 항목 | 내용 |
|------|------|
| 프로젝트명 | Ai DOT (AI 기반 업무 협업 플랫폼) |
| 문서 버전 | 1.3 |
| 작성일 | 2026-02-07 |
| 작성자 | 박제연 (백엔드) |

---

## 목차

1. [인증 및 사용자 관리](#1-인증-및-사용자-관리)
2. [홈 화면](#2-홈-화면)
3. [AI 챗봇](#3-ai-챗봇)
4. [문서 관리](#4-문서-관리)
5. [AI 이미지 생성](#5-ai-이미지-생성)
6. [회의록 분석](#6-회의록-분석)
7. [일정 관리](#7-일정-관리)
8. [마이페이지](#8-마이페이지)
9. [관리자 대시보드](#9-관리자-대시보드)
10. [관리자 부서 관리](#10-관리자-부서-관리)
11. [관리자 설정](#11-관리자-설정)
12. [AIDot Admin Portal](#12-aidot-admin-portal)

---

## 1. 인증 및 사용자 관리

### 1.1 회원가입

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-AUTH-001 |
| 화면 경로 | `/signup` |
| API 엔드포인트 | `POST /api/register` |
| 접근 권한 | Public (비로그인 사용자) |

#### 입력 항목

| 필드명 | 타입 | 필수 | 검증 규칙 | 설명 |
|--------|------|------|----------|------|
| email | VARCHAR(50) | O | 이메일 형식, 중복 불가 | 로그인 ID로 사용 |
| name | VARCHAR(50) | O | 2~50자 | 사용자 이름 |
| password | VARCHAR(20) | O | 4~20자 | 비밀번호 (bcrypt 해싱 저장) |
| phone | VARCHAR(20) | O | 010-XXXX-XXXX 형식, 중복 불가 | 연락처 |
| gender | CHAR(1) | O | M 또는 F | 성별 (기본값: M) |
| dept_idx | INT | O | 존재하는 부서 ID | 소속 부서 |
| role | String | X | USER 또는 ADMIN | 권한 (기본값: USER) |

#### 처리 로직

1. 클라이언트에서 입력값 유효성 검증 (실시간)
2. 이메일 중복 확인 (`users` 테이블 조회)
3. 연락처 중복 확인 (phone 필드가 있는 경우)
4. 비밀번호 bcrypt 해싱 처리
5. `users` 테이블에 신규 레코드 삽입
6. 시스템 로그 기록 (`REGISTER_SUCCESS`)
7. 성공 시 로그인 페이지로 리다이렉트

#### 출력

| 상태 | 응답 |
|------|------|
| 성공 | `200 OK` + `{ "message": "회원가입 성공" }` |
| 이메일 중복 | `400 Bad Request` + "이미 등록된 이메일입니다." |
| 연락처 중복 | `400 Bad Request` + "이미 등록된 연락처입니다." |
| 검증 실패 | `422 Unprocessable Entity` + 필드별 오류 메시지 |

---

### 1.2 로그인

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-AUTH-002 |
| 화면 경로 | `/login` |
| API 엔드포인트 | `POST /api/login` |
| 접근 권한 | Public |

#### 입력 항목

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| email | String | O | 등록된 이메일 |
| password | String | O | 비밀번호 |

#### 처리 로직

1. 이메일로 사용자 조회
2. `verify_password()`로 비밀번호 검증 (bcrypt)
3. 실패 시 시스템 로그 기록 (`LOGIN_FAIL`)
4. 성공 시 JWT 토큰 생성 (payload: sub=user_id, email, role / 만료: 24시간 / 알고리즘: HS256)
5. 시스템 로그 기록 (`LOGIN_SUCCESS`)
6. 클라이언트: 토큰 및 사용자 정보를 localStorage에 저장
7. 역할에 따라 페이지 이동:
   - `USER` → `/home`
   - `ADMIN` → `/dashboard`

#### 출력

| 상태 | 응답 |
|------|------|
| 성공 | `200 OK` + `{ access_token, token_type, user: { id, email, name, role, dept_idx, gender } }` |
| 실패 | `401 Unauthorized` + "이메일 또는 비밀번호가 잘못되었습니다." |

---

### 1.3 현재 사용자 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-AUTH-003 |
| API 엔드포인트 | `GET /api/me` |
| 접근 권한 | 인증 필요 (Bearer 토큰) |

- JWT 토큰을 검증하고 현재 로그인된 사용자 정보 반환
- 응답: `{ id, email, name, role, dept_idx, gender }`

---

### 1.4 로그아웃

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-AUTH-004 |
| 화면 위치 | 사이드바 하단 |
| 접근 권한 | USER, ADMIN |

#### 처리 로직

1. localStorage에서 사용자 정보 및 토큰 삭제
2. `/login` 페이지로 리다이렉트

---

### 1.5 인증 토큰 관리

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-AUTH-005 |
| 토큰 방식 | JWT (JSON Web Token) |
| 저장 위치 | localStorage |

#### JWT 토큰 구성

| 필드 | 설명 |
|------|------|
| sub | 사용자 ID (문자열) |
| email | 사용자 이메일 |
| role | 권한 (USER/ADMIN) |
| exp | 만료 시간 (발급 후 24시간, JWT_EXPIRE_MINUTES 환경변수로 조절 가능) |

#### API 요청 인증 흐름

1. Axios 인터셉터가 모든 요청 헤더에 `Authorization: Bearer {token}` 자동 첨부
2. 서버에서 `verify_token()` 으로 토큰 유효성 검증 (HTTPBearer 스키마)
3. `get_current_user()` 의존성으로 인증된 사용자 객체 추출
4. 토큰 만료 또는 유효하지 않은 경우 `401` 응답 → 클라이언트에서 로그아웃 처리

---

## 2. 홈 화면

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-HOME-001 |
| 화면 경로 | `/home` |
| API 엔드포인트 | `GET /user/{user_id}/home-data` |
| 접근 권한 | USER, ADMIN |

### 2.1 통합 홈 데이터 조회

하나의 API 호출로 홈 화면에 필요한 데이터를 반환한다.

#### 응답 데이터 구성

| 데이터 항목 | 키 | 설명 | 조회 조건 |
|------------|-----|------|----------|
| 활동 통계 | stats | chatCount, documentCount, imageCount, scheduleCount | 전체 대화/문서/이미지 수 + 오늘 일정 수 |
| 최근 대화 | recentChats | 최근 대화 세션 | 최신 3건, ACTIVE 상태만 |
| 최근 문서 | recentDocuments | 최근 문서 | 최신 3건 |
| 사용자 프로필 | profile | id, email, name, role, deptIdx, deptName | 부서 정보 포함 |

### 2.2 통계 카드 표시

| 통계 항목 | 키 | 설명 |
|----------|-----|------|
| AI 대화 | chatCount | 전체 대화 세션 수 |
| 문서 | documentCount | 업로드된 문서 수 |
| 이미지 | imageCount | 생성된 이미지 수 |
| 오늘 일정 | scheduleCount | 오늘 날짜 기준 일정 수 |

### 2.3 보조 API 엔드포인트

홈 화면에서 추가 데이터를 개별 API로 조회할 수 있다.

| API | 설명 | 기본 건수 |
|-----|------|----------|
| `GET /user/{user_id}/recent-chats` | 최근 대화 세션 | 5건 |
| `GET /user/{user_id}/recent-documents` | 최근 문서 | 5건 |
| `GET /user/{user_id}/recent-meetings` | 최근 회의록 | 5건 |
| `GET /user/{user_id}/recent-images` | 최근 이미지 | 5건 |
| `GET /user/{user_id}/schedules/today` | 오늘 일정 | 전체 |
| `GET /user/{user_id}/recent-schedules` | 다가오는 일정 | 5건 |
| `GET /user/{user_id}/profile` | 사용자 프로필 | - |
| `GET /user/{user_id}/stats` | 활동 통계 | - |

---

## 3. AI 챗봇

### 3.1 대화 세션 관리

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-CHAT-001 |
| 화면 경로 | `/chatbot` |
| 접근 권한 | USER, ADMIN |

#### 3.1.1 세션 목록 조회

| 항목 | 내용 |
|------|------|
| API | `GET /chat/sessions/{user_id}` |
| 표시 위치 | 좌측 사이드 패널 |

- ACTIVE 상태의 세션만 최신순으로 표시
- 각 세션: 제목, 마지막 메시지 프리뷰(50자), 메시지 수, 생성일시, 수정일시
- 세션 클릭 시 해당 세션의 메시지 내역 로딩

#### 3.1.2 세션 상세 조회

| 항목 | 내용 |
|------|------|
| API | `GET /chat/sessions/detail/{session_id}` |

- 세션 정보(id, title, status, createdAt, updatedAt) + 전체 메시지 목록 반환
- 메시지: id, role(sender), content, referenceDocs, createdAt
- Redis에 세션 컨텍스트 캐싱 (요약 + 최근 10개 메시지, TTL: 1시간)

#### 3.1.3 새 세션 생성

| 항목 | 내용 |
|------|------|
| API | `POST /chat/sessions` |
| 요청 Body | `{ user_id, title? }` |

- "새 대화" 버튼 클릭 시 세션 생성
- 기본 제목: "새 대화" (title 미지정 시)
- 초기 status: `ACTIVE`
- 시스템 로그: `CHAT_CREATE_SUCCESS`

#### 3.1.4 세션 제목 수정

| 항목 | 내용 |
|------|------|
| API | `PUT /chat/sessions/{session_id}` |
| 요청 Body | `{ title }` |

- 세션 제목 클릭 → 인라인 편집 모드 → 최대 255자

#### 3.1.5 세션 삭제 (소프트 삭제)

| 항목 | 내용 |
|------|------|
| API | `DELETE /chat/sessions/{session_id}` |

- **소프트 삭제**: status를 `ARCHIVED`로 변경 (데이터 보존)
- 메시지는 삭제하지 않음
- 시스템 로그: `CHAT_DELETE_SUCCESS`

#### 3.1.6 세션 메시지 전체 삭제

| 항목 | 내용 |
|------|------|
| API | `DELETE /chat/sessions/{session_id}/messages` |

- 세션의 모든 메시지를 물리적으로 삭제 (대화 내역 초기화)
- 세션 자체는 유지

---

### 3.2 AI 대화 (스트리밍)

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-CHAT-002 |
| API | `POST /ai/chat/stream` |
| 응답 방식 | StreamingResponse (Producer-Consumer 패턴) |

#### 입력

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| session_id | INT | O | 대화 세션 ID |
| message | String | O | 사용자 메시지 |
| history | List | X | 대화 이력 (기본값: []) |

#### 처리 로직

1. RAG 엔진으로 관련 문서 검색 (유사도 기반, 상위 3개)
2. 참조 문서가 있으면 프롬프트에 [참고 자료] 컨텍스트 추가
3. 백그라운드 스레드(Producer)에서 LLM 스트리밍 응답 생성
4. 생성된 토큰을 Redis 큐(`session:{session_id}:stream_queue`)에 푸시
5. Consumer가 Redis 큐에서 토큰을 읽어 클라이언트에 전송
6. 응답 완료 후 Celery `save_chat_task`로 사용자 메시지 + AI 응답 DB 저장
7. 참조 문서 정보 JSON으로 함께 저장

#### 스트리밍 이벤트 형식

```
TEXT_DATA:{토큰 텍스트}

DOCS_DATA:{참조문서 JSON}

STOPPED_DATA:

ERROR_DATA:{에러 메시지}
```

#### 응답 중단 기능

| 항목 | 내용 |
|------|------|
| API | `POST /ai/chat/stop` |
| 요청 Body | `{ session_id }` |
| 동작 | Redis 중단 플래그(`session:{session_id}:stop`) 설정 → Producer 스레드 종료 → DB 저장 안함 |

---

### 3.3 AI 대화 (비스트리밍)

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-CHAT-003 |
| API | `POST /ai/chat` |
| 요청 Body | `{ message }` |

- RAG 검색 후 완성된 응답을 한 번에 반환
- 응답: `{ reply, context_used }`

---

### 3.4 채팅 히스토리 조회 (캐시 기반)

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-CHAT-004 |
| API | `GET /ai/chat/sessions/{session_id}/messages` |

- Redis 캐시 우선 조회 (`session:{session_id}:context`)
- 캐시 미스 시 MySQL에서 최근 10개 메시지 조회 후 Redis에 저장 (TTL: 1시간)
- 응답: `{ summary, messages: [{ sender, content }] }`

---

### 3.5 대화 요약 업데이트

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-CHAT-005 |
| API | `POST /ai/sessions/{session_id}/update-summary` |
| 요청 Body | `{ oldest_message_ids: [int] }` |

- 가장 오래된 메시지 2개 이상 + 기존 요약을 기반으로 Celery `update_summary_task` 발행
- LLM이 대화 내용을 요약하여 `chat_sessions.current_summary`에 저장
- 이후 대화에서 전체 이력 대신 요약을 컨텍스트로 사용 (토큰 절약)

---

### 3.6 백그라운드 LLM 생성

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-CHAT-006 |
| API | `POST /ai/chat/generate` |
| 결과 조회 | `GET /ai/tasks/{task_id}` |

- Worker PC가 호출하는 백그라운드 LLM 생성 엔드포인트
- 결과를 Redis에 저장 (TTL: 5분), task_id로 폴링 조회

---

### 3.7 RAG 문서 참조

| 항목 | 내용 |
|------|------|
| 벡터 DB | ChromaDB (컬렉션: dot_project_docs) |
| 임베딩 모델 | ko-sbert-nli (한국어 자연어 추론 학습) |

#### 처리 로직

1. 사용자 질문으로 ChromaDB 유사도 검색 (상위 3개)
2. 관련 문서가 있으면 프롬프트에 참고 자료로 포함
3. 관련 없는 자료는 무시하고 LLM 자체 지식으로 답변하도록 지시
4. AI 응답과 함께 참조 문서 정보를 JSON으로 클라이언트에 전달

---

## 4. 문서 관리

### 4.1 문서 업로드

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-DOC-001 |
| 화면 경로 | `/documents` |
| API 엔드포인트 | `POST /document/upload` |
| 접근 권한 | USER, ADMIN |

#### 입력 항목 (multipart/form-data)

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| file | File | O | 업로드 파일 |
| title | String | O | 문서 제목 (최대 255자) |
| category | String | O | 카테고리 (업무/개인/아이디어) |
| summary | String | X | 문서 요약 (기본값: "{title} 문서입니다.") |
| user_id | INT | O | 사용자 ID |

#### 허용 파일 형식

pdf, doc, docx, xls, xlsx, ppt, pptx, txt, hwp

#### 처리 로직

1. 파일 확장자 검증
2. 파일을 UUID 파일명으로 서버 디스크에 저장 (`/app/uploads/documents/`)
3. `documents` 테이블에 메타데이터 삽입
4. **PDF 파일인 경우**: Celery `ingest_pdf_task`로 RAG 인덱싱 (status: `INDEXING`)
5. **비PDF 파일**: 즉시 `INDEXED` 상태로 저장
6. 시스템 로그 기록 (`DOC_UPLOAD_SUCCESS`)

---

### 4.2 문서 목록 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-DOC-002 |
| API 엔드포인트 | `GET /document/list/{user_id}` |

#### 쿼리 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| page | INT | 1 | 페이지 번호 (ge=1) |
| size | INT | 10 | 페이지당 항목 수 (1~100) |
| category | String | None | 카테고리 필터 ("전체"는 무시) |
| search | String | None | 제목/요약 검색 (ILIKE) |

#### 응답 구조

```json
{
  "documents": [
    { "id", "rowNum", "title", "summary", "category", "fileName", "fileExt",
      "fileSize", "fileSizeText", "authorId", "authorName", "status", "createdAt" }
  ],
  "pagination": { "currentPage", "totalPages", "totalCount", "pageSize", "hasNext", "hasPrev" }
}
```

---

### 4.3 문서 상세 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-DOC-003 |
| API 엔드포인트 | `GET /document/{document_id}` |

- 응답: id, title, category, summary, fileName, fileExt, fileSize, fileSizeText, status, chromaId, authorId, authorName, downloadUrl, createdAt, updatedAt

---

### 4.4 문서 수정

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-DOC-004 |
| API 엔드포인트 | `PUT /document/{document_id}` |

수정 가능 항목: title, category, summary (모두 Optional)

---

### 4.5 문서 삭제

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-DOC-005 |
| API 엔드포인트 | `DELETE /document/{document_id}?user_id={user_id}` |

#### 처리 로직

1. PDF 파일인 경우 ChromaDB에서 벡터 직접 삭제 (RAGEngine.delete_by_source)
2. 물리적 파일 삭제
3. DB 레코드 삭제
4. 시스템 로그 기록 (`DOC_DELETE_SUCCESS`)

---

### 4.6 문서 다운로드

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-DOC-006 |
| API 엔드포인트 | `GET /document/download/{document_id}` |

- 원본 파일을 FileResponse로 반환 (MIME 타입 자동 매핑)

---

### 4.7 RAG 벡터화 진행률 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-DOC-007 |
| API 엔드포인트 | `GET /document/status/{task_id}` |

- Redis에서 진행률 조회 (Key: `rag_task:{task_id}:progress`)
- 응답: `{ status, progress, message }`

---

### 4.8 카테고리 목록

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /document/categories/list` |

- 응답: `{ categories: ["전체", "업무", "개인", "아이디어"] }`

---

### 4.9 내부 API (Worker 통신)

| API | 설명 |
|-----|------|
| `GET /document/internal/file/{filename}` | Worker가 PDF 파일을 HTTP로 다운로드 |
| `POST /document/internal/store-vectors` | Worker가 임베딩 벡터를 PC1 ChromaDB에 저장 |

---

## 5. AI 이미지 생성

### 5.1 이미지 생성

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-IMG-001 |
| 화면 경로 | `/images` |
| API 엔드포인트 | `POST /image/generate` |
| 접근 권한 | USER, ADMIN |
| AI 모델 | Stable Diffusion 3.5 Medium (GGUF Q8_0) |
| 생성 서버 | ComfyUI (PC2 워커 서버) |

#### 입력 항목

| 필드명 | 타입 | 필수 | 기본값 | 설명 |
|--------|------|------|--------|------|
| user_id | INT | O | - | 사용자 ID |
| prompt | String | O | - | 이미지 생성 프롬프트 (한글/영어) |
| style | String | X | realistic | 스타일 코드 |
| size | String | X | 1024x1024 | 이미지 크기 |

#### 지원 스타일

| 스타일 코드 | 표시명 |
|------------|--------|
| corporate | 기업/비즈니스 |
| product | 제품 촬영 |
| typography | 포스터/타이포 |
| realistic | 사실적 (기본값) |
| anime | 애니메이션 |
| cartoon | 만화 |

#### 지원 크기

512x512, 768x768, 1024x1024 (기본값)

#### 처리 로직

1. 프롬프트에 한글이 포함되어 있는지 감지 (정규식: `[가-힣]`)
2. 한글이면 PC1의 LLM으로 영어 프롬프트로 변환 (자연어 묘사 형태)
3. DB에 초기 레코드 생성 (`img_size=0`으로 "처리 중" 표시)
4. Celery `generate_image_task`로 Worker에 이미지 생성 작업 전달
5. Worker가 ComfyUI API를 통해 SD 3.5 Medium으로 이미지 생성
6. 생성 완료 시 Worker가 `POST /image/internal/upload`로 PC1에 이미지 전송
7. 시스템 로그 기록 (`IMAGE_GENERATE_REQUEST`)

> **참고**: `generated_images` 테이블에는 style, size 컬럼이 없음. 프론트엔드에서 Worker로 전달되는 파라미터로만 사용됨. 완료 여부는 `img_size > 0`으로 판별.

---

### 5.2 이미지 갤러리 (목록)

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-IMG-002 |
| API 엔드포인트 | `GET /image/list/{user_id}` |

#### 쿼리 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| page | INT | 1 | 페이지 번호 |
| size | INT | 12 | 페이지당 이미지 수 (1~50) |
| search | String | None | 프롬프트 검색어 (ILIKE) |

#### 응답 구조

```json
{
  "images": [
    { "id", "prompt", "promptPreview", "fileName", "imageUrl", "fileSize",
      "fileSizeText", "status", "createdAt" }
  ],
  "pagination": { "currentPage", "totalPages", "totalCount", "pageSize", "hasNext", "hasPrev" }
}
```

- status: `img_size > 0` → "completed", `img_size == 0` → "processing"

---

### 5.3 이미지 생성 진행률 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-IMG-003 |
| API 엔드포인트 | `GET /image/status/{task_id}` |

- Redis에서 진행률 조회 (Key: `image_task:{task_id}:progress`)
- 응답: `{ status, progress, message }`

---

### 5.4 이미지 상세 조회

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /image/{image_id}` |

- 응답: id, prompt, fileName, fileExt, fileSize, fileSizeText, imageUrl, status, authorId, authorName, createdAt

---

### 5.5 이미지 파일 서빙

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /image/file/{file_name}` |

- PNG 이미지 파일을 FileResponse로 반환

---

### 5.6 이미지 삭제

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-IMG-004 |
| API 엔드포인트 | `DELETE /image/{image_id}` |

- 디스크에서 파일 삭제 + DB 레코드 삭제
- 시스템 로그: `IMAGE_DELETE_SUCCESS`

---

### 5.7 최근 이미지 조회

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /image/recent/{user_id}?limit=6` |

- 최근 생성 이미지 목록 반환 (기본 6건)

---

### 5.8 내부 API (Worker 통신)

| API | 설명 |
|-----|------|
| `POST /image/internal/upload` | Worker가 생성된 이미지를 HTTP로 PC1에 전송 (multipart: file + image_id) |

---

## 6. 회의록 분석

### 6.1 회의록 직접 작성

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MTG-001 |
| 화면 경로 | `/meeting` |
| API 엔드포인트 | `POST /meeting/` |
| 접근 권한 | USER, ADMIN |

#### 입력 항목 (JSON Body)

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| user_id | INT | O | 사용자 ID |
| title | String | O | 회의 제목 (최대 255자) |
| transcript | String | O | 회의 전문 내용 |
| summary | String | O | 회의 요약 |
| duration | INT | X | 회의 시간 (초 단위, 기본값: 0) |
| attendees | String | X | 참석자 (쉼표 구분, 기본값: "") |

- 직접 작성 시 status는 즉시 `COMPLETED`
- 시스템 로그: `MEETING_CREATE_SUCCESS`

---

### 6.2 음성 파일 업로드 (STT)

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MTG-002 |
| API 엔드포인트 | `POST /meeting/upload` |
| STT 모델 | Faster Whisper Large-v3 (INT8) |

#### 입력 항목 (multipart/form-data)

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| user_id | INT | O | 사용자 ID |
| title | String | O | 회의 제목 |
| attendees | String | X | 참석자 (쉼표 구분) |
| file | File | O | 음성 파일 |

#### 허용 음성 형식

mp3, wav, m4a, ogg, webm, mp4

#### 처리 로직

1. 파일 확장자 검증 및 UUID 파일명으로 저장 (`uploads/meetings/`)
2. `meeting_notes` 테이블에 레코드 삽입 (status: `QUEUED`, transcript/summary 빈 문자열)
3. Celery `transcribe_audio_task` 발행 (PC2 Worker의 gpu_stt 큐)
4. Worker에서 처리:
   - status → `PROCESSING`
   - Faster Whisper로 음성 → 텍스트 변환
   - 변환된 텍스트를 `transcript`에 저장
   - LLM으로 자동 요약 생성 → `summary`에 저장
   - 오디오 재생 시간 계산 → `duration`에 저장 (초 단위)
   - status → `COMPLETED` (실패 시 `ERROR`)
5. 시스템 로그: `MEETING_UPLOAD_SUCCESS`

---

### 6.3 STT 진행률 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MTG-003 |
| API 엔드포인트 | `GET /meeting/status/{task_id}` |

- Redis에서 진행률 조회 (Key: `stt_task:{task_id}:progress`)
- 응답: `{ status, progress, message }`

---

### 6.4 회의록 목록 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MTG-004 |
| API 엔드포인트 | `GET /meeting/list/{user_id}` |

#### 쿼리 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| page | INT | 1 | 페이지 번호 |
| size | INT | 10 | 페이지당 항목 수 (1~100) |
| search | String | None | 제목 검색어 (ILIKE) |

#### 응답 항목

```json
{
  "meetings": [
    { "id", "rowNum", "title", "duration", "durationText", "attendees",
      "status", "statusText", "createdAt" }
  ],
  "pagination": { ... }
}
```

---

### 6.5 회의록 상세 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MTG-005 |
| API 엔드포인트 | `GET /meeting/{meeting_id}` |

- 응답: id, title, fileName, fileExt, fileSize, transcript, summary, duration, durationText, attendees, attendeeList(배열), status, statusText, authorId, authorName, createdAt, updatedAt

---

### 6.6 회의록 수정

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MTG-006 |
| API 엔드포인트 | `PUT /meeting/{meeting_id}` |

수정 가능 항목: title, attendees, summary (모두 Optional)

---

### 6.7 회의록 삭제

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MTG-007 |
| API 엔드포인트 | `DELETE /meeting/{meeting_id}` |

- 음성 파일이 있는 경우 디스크에서 함께 삭제
- DB 레코드 삭제
- 시스템 로그: `MEETING_DELETE_SUCCESS`

---

### 6.8 내부 API (Worker 통신)

| API | 설명 |
|-----|------|
| `GET /meeting/internal/file/{filename}` | Worker가 오디오 파일을 HTTP로 다운로드 |

---

## 7. 일정 관리

### 7.1 월별 캘린더 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-SCH-001 |
| 화면 경로 | `/schedule` |
| API 엔드포인트 | `GET /schedule/monthly/{user_id}` |
| 접근 권한 | USER, ADMIN |

#### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| year | INT | O | 조회 연도 |
| month | INT | O | 조회 월 (1~12) |

#### 응답 구조

```json
{
  "year": 2026, "month": 2,
  "schedules": [ { "id", "title", "content", "scheduleDate", "startTime", "endTime", "category" } ],
  "dateCounts": { "2026-02-03": 2, "2026-02-05": 1 },
  "totalCount": 3
}
```

---

### 7.2 일별 일정 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-SCH-002 |
| API 엔드포인트 | `GET /schedule/daily/{user_id}` |

#### 쿼리 파라미터

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| date_str | String | 조회 날짜 (YYYY-MM-DD) |

---

### 7.3 일정 상세 조회

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-SCH-003 |
| API 엔드포인트 | `GET /schedule/{schedule_id}` |

- 응답: id, userId, title, content, scheduleDate, startTime, endTime, category, createdAt, updatedAt

---

### 7.4 일정 등록

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-SCH-004 |
| API 엔드포인트 | `POST /schedule/` |

#### 입력 항목

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| user_id | INT | O | 사용자 ID |
| title | String | O | 일정 제목 (최대 100자) |
| schedule_date | String | O | 일정 날짜 (YYYY-MM-DD) |
| start_time | String | O | 시작 시간 (HH:MM) |
| end_time | String | O | 종료 시간 (HH:MM) |
| category | String | X | 카테고리 (기본값: "일반") |
| content | String | X | 상세 내용 |

#### 검증 규칙

- start_time < end_time (종료 시간은 시작 시간보다 늦어야 함)
- 날짜/시간 형식 검증

#### 카테고리

| 카테고리 | 설명 |
|---------|------|
| 일반 | 기본 일정 (default) |
| 업무 | 업무 관련 |
| 회의 | 회의 일정 |
| 개인 | 개인 일정 |
| 중요 | 중요 일정 |

- 시스템 로그: `SCHEDULE_CREATE_SUCCESS`

---

### 7.5 일정 수정

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-SCH-005 |
| API 엔드포인트 | `PUT /schedule/{schedule_id}` |

- 모든 입력 항목 수정 가능 (모두 Optional)
- start_time/end_time 변경 시 유효성 재검증
- 시스템 로그: `SCHEDULE_UPDATE_SUCCESS`

---

### 7.6 일정 삭제

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-SCH-006 |
| API 엔드포인트 | `DELETE /schedule/{schedule_id}` |

- DB 레코드 삭제
- 시스템 로그: `SCHEDULE_DELETE_SUCCESS`

---

### 7.7 카테고리 목록 조회

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /schedule/categories/{user_id}` |

- 사용자가 사용한 카테고리 + 기본 카테고리 (일반, 업무, 회의, 개인, 중요) 병합 후 정렬 반환

---

## 8. 마이페이지

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MY-001 |
| 화면 경로 | `/mypage` |
| API 엔드포인트 | `GET /user/{user_id}/mypage-data` |
| 접근 권한 | USER, ADMIN |

### 8.1 통합 마이페이지 데이터

하나의 API 호출로 마이페이지에 필요한 모든 데이터를 반환한다.

#### 응답 데이터 구성

| 키 | 내용 |
|-----|------|
| profile | id, email, name, phone, role, roleText("관리자"/"일반 사용자"), deptIdx, deptName, createdAt, memberSince("N일째 회원") |
| stats | totalChats, totalDocuments, totalImages, totalMeetings, totalSchedules, todaySchedules |
| monthlyActivity | chats, documents, images, meetings (이번 달 기준) |

---

### 8.2 프로필 수정

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MY-002 |
| API 엔드포인트 | `PUT /user/{user_id}/profile` |

#### 수정 가능 항목

| 필드명 | 검증 규칙 | 설명 |
|--------|----------|------|
| name | Optional | 이름 변경 |
| phone | 중복 불가 | 연락처 변경 |

#### 수정 불가 항목

| 필드명 | 사유 |
|--------|------|
| email | 로그인 ID (변경 불가) |
| dept_idx | 관리자만 변경 가능 |
| role | 관리자만 변경 가능 |

---

### 8.3 비밀번호 변경

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-MY-003 |
| API 엔드포인트 | `PUT /user/{user_id}/password` |

#### 입력 항목

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| current_password | String | O | 현재 비밀번호 (본인 확인용) |
| new_password | String | O | 새 비밀번호 (4자 이상) |

#### 처리 로직

1. 현재 비밀번호 일치 여부 검증 (bcrypt)
2. 새 비밀번호 4자 이상 검증
3. bcrypt 해싱 후 업데이트
4. 성공 메시지 반환

---

## 9. 관리자 대시보드

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-ADM-001 |
| 화면 경로 | `/dashboard` |
| 접근 권한 | ADMIN |
| 자동 갱신 | 30초 간격 |

### 9.1 통계 카드

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/admin/stats` |

#### 응답 항목

| 키 | 설명 |
|-----|------|
| totalUsers | 전체 사용자 수 |
| totalDepts | 전체 부서 수 |
| todayVisitors | 오늘 로그인 사용자 수 (중복 제거) |
| totalLogs | 전체 로그 수 |
| totalChats | 전체 채팅 세션 수 |
| totalDocuments | 전체 문서 수 |
| totalMeetings | 전체 회의록 수 |
| totalImages | 전체 이미지 수 |
| todayChats | 오늘 채팅 수 |
| todayDocuments | 오늘 문서 수 |
| todayMeetings | 오늘 회의록 수 |
| todayImages | 오늘 이미지 수 |
| successLogs | SUCCESS 포함 로그 수 |
| failLogs | FAIL 포함 로그 수 |

---

### 9.2 일별 활동 추이 차트

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/admin/daily-activity?days=7` |
| 차트 라이브러리 | Recharts |

- 최근 N일간 (기본 7일) 일별 활동량
- 항목별: chats, documents, meetings, images, logins, total
- X축: 날짜 (MM/DD), Y축: 활동 수

---

### 9.3 부서별 활동 차트

| API | 설명 |
|-----|------|
| `GET /api/admin/dept-activity` | 부서별 활동량(로그 수) |
| `GET /api/admin/dept-distribution` | 부서별 직원 수 분포 |

---

### 9.4 AI 기능 사용 현황

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/admin/feature-usage` |

- 반환: AI 챗봇, 문서 관리, 회의록 분석, 이미지 생성 각 건수 + 색상 코드

---

### 9.5 시스템 건강 상태

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/admin/server-health` |

#### 모니터링 항목

| 항목 | 수집 방법 | 응답 키 |
|------|----------|---------|
| CPU 사용률 | psutil.cpu_percent() | cpu |
| CPU 코어 수 | psutil.cpu_count() | cpuCores |
| CPU 클럭 | psutil.cpu_freq() | cpuFreqCurrent, cpuFreqMax |
| 메모리 사용률 | psutil.virtual_memory() | memory, memoryTotal, memoryUsed, memoryAvailable |
| 디스크 사용률 | psutil.disk_usage() | disk, diskTotal, diskUsed, diskFree |
| 네트워크 | psutil.net_io_counters() | networkSent, networkRecv (MB) |
| 프로세스 수 | psutil.pids() | processCount |
| 시스템 정보 | platform | platform, hostname, pythonVersion |
| 가동 시간 | psutil.boot_time() | uptimeText, bootTime |
| 상태 판정 | CPU/메모리/디스크 기반 | status (Healthy/Warning/Critical), statusColor |

---

### 9.6 실행 프로세스 목록

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/admin/processes?limit=10&sort_by=cpu` |

- CPU 또는 메모리 기준 상위 N개 프로세스 반환
- 항목: pid, name, username, cpu_percent, memory_percent, memory_mb, status, create_time

---

### 9.7 시스템 로그 뷰어

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/admin/logs` |

#### 쿼리 파라미터

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| page | INT | 1 | 페이지 번호 |
| size | INT | 10 | 페이지당 항목 수 |
| q | String | None | 검색어 (이름, 이메일, 액션, 상세 검색) |

#### 로그 표시 항목

| 필드 | 설명 |
|------|------|
| id | 로그 ID |
| user_name | 사용자 이름 (없으면 "SYSTEM") |
| user_email | 사용자 이메일 |
| action | 작업 유형 |
| details | 상세 정보 |
| ip_addr | 클라이언트 IP |
| target_type | 대상 타입 |
| target_id | 대상 ID |
| created_at | 로그 시간 |

---

## 10. 관리자 부서 관리

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-ADM-002 |
| 화면 경로 | `/admin/depts` |
| 접근 권한 | ADMIN |

### 10.1 부서 목록 조회

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/depts` |

- 전체 부서 목록 반환 (id, dept_name)

### 10.2 부서별 사용자 조회

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/admin/depts/{dept_id}/users` |

- 특정 부서 소속 사용자 목록 (id, name, email, role)

### 10.3 부서 추가

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `POST /api/depts` |
| 요청 Body | `{ dept_name }` |

- 부서명 중복 시 `400 Bad Request`

### 10.4 부서 삭제

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `DELETE /api/depts/{dept_id}` |

- 소속 직원이 있는 부서는 삭제 불가 (`400 Bad Request`)

### 10.5 직원 부서 이동

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `PATCH /api/admin/users/move-dept` |

#### 입력 항목

| 필드명 | 타입 | 설명 |
|--------|------|------|
| user_id | INT | 이동 대상 사용자 ID |
| new_dept_idx | INT | 이동할 부서 ID |

- 시스템 로그: `USER_MOVE_SUCCESS`

---

## 11. 관리자 설정

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-ADM-003 |
| 화면 경로 | `/admin/settings` |
| 접근 권한 | ADMIN |

### 11.1 전체 사용자 목록 조회

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /api/admin/users` |

- 전체 사용자 목록 (id, email, name, role)

### 11.2 사용자 권한 변경

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `PATCH /api/admin/users/update` |

#### 입력 항목

| 필드명 | 타입 | 설명 |
|--------|------|------|
| user_id | INT | 대상 사용자 ID |
| new_role | String | 변경할 권한 (USER / ADMIN) |

- 시스템 로그: `USER_ROLE_UPDATED`

### 11.3 비밀번호 초기화

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `PATCH /api/admin/users/update` |

#### 입력 항목

| 필드명 | 타입 | 설명 |
|--------|------|------|
| user_id | INT | 대상 사용자 ID |
| new_password | String | 초기화할 비밀번호 |

- 관리자가 사용자의 비밀번호를 강제 초기화
- bcrypt 해싱 후 저장
- 시스템 로그: `USER_PWD_RESET`

---

## 12. AIDot Admin Portal

> AIDot 본체와 독립적으로 배포되는 관리 포털 (Spring Boot 4.0.1 / Java 17 / Thymeleaf)

### 12.1 인덱스 페이지

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-APR-001 |
| 화면 경로 | `/` (Admin Portal) |
| 접근 권한 | Public |

- AIDot 시스템 소개 및 주요 기능 안내
- 다운로드, 로그인, 라이선스 관리 페이지로의 네비게이션 제공
- Thymeleaf SSR 렌더링

---

### 12.2 설치 파일 다운로드

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-APR-002 |
| 화면 경로 | `/download` (Admin Portal) |
| 접근 권한 | Public |

- AIDot 시스템 설치에 필요한 파일 (Docker Compose, 환경설정 등) 다운로드
- 버전별 파일 관리
- 다운로드 횟수 및 이력 기록

---

### 12.3 Admin Portal 로그인

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-APR-003 |
| 화면 경로 | `/login` (Admin Portal) |
| 접근 권한 | Public |

#### 입력 항목

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| email | String | O | 관리자 이메일 |
| password | String | O | 비밀번호 |

#### 처리 로직

1. Spring Security 폼 기반 인증
2. 인증 성공 시 배포 현황 대시보드로 이동
3. 실패 시 오류 메시지 표시

---

### 12.4 배포 현황 대시보드

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-APR-004 |
| 화면 경로 | `/dashboard` (Admin Portal) |
| 접근 권한 | 인증 필요 (Spring Security) |

- 설치 현황 통계 카드 (총 설치 수, 활성 라이선스 수 등)
- 최근 배포/업데이트 이력 목록
- 시스템 상태 요약

---

### 12.5 라이선스 관리

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-APR-005 |
| 화면 경로 | `/license` (Admin Portal) |
| 접근 권한 | 인증 필요 (Spring Security) |

#### 기능 목록

| 기능 | 설명 |
|------|------|
| 라이선스 발급 | 새로운 라이선스 키 생성 |
| 유효기간 설정 | 라이선스 만료일 지정 |
| 활성/비활성 관리 | 라이선스 상태 변경 |
| 목록 조회 | 발급된 라이선스 전체 조회 |

---

### 12.6 Admin Portal 기술 기반

| 항목 | 내용 |
|------|------|
| 기능 ID | FN-APR-006 |

| 기술 | 버전/설명 |
|------|----------|
| Spring Boot | 4.0.1 |
| Java | 17 (LTS) |
| Thymeleaf | SSR 템플릿 엔진 |
| Spring Security | 인증·인가 |
| Maven Wrapper | 빌드 도구 |

---

## 부록 A: 시스템 로그 액션 코드

### 인증 관련

| 액션 코드 | 설명 | target_type |
|----------|------|-------------|
| LOGIN_SUCCESS | 로그인 성공 | USER |
| LOGIN_FAIL | 로그인 실패 | AUTH |
| REGISTER_SUCCESS | 회원가입 성공 | USER |

### 챗봇 관련

| 액션 코드 | 설명 | target_type |
|----------|------|-------------|
| CHAT_CREATE_SUCCESS | 채팅 세션 생성 | CHAT_SESSION |
| CHAT_DELETE_SUCCESS | 채팅 세션 삭제 | CHAT_SESSION |

### 문서 관련

| 액션 코드 | 설명 | target_type |
|----------|------|-------------|
| DOC_UPLOAD_SUCCESS | 문서 업로드 성공 | DOCUMENT |
| DOC_DELETE_SUCCESS | 문서 삭제 | DOCUMENT |

### 이미지 관련

| 액션 코드 | 설명 | target_type |
|----------|------|-------------|
| IMAGE_GENERATE_REQUEST | 이미지 생성 요청 | IMAGE |
| IMAGE_DELETE_SUCCESS | 이미지 삭제 | IMAGE |

### 회의록 관련

| 액션 코드 | 설명 | target_type |
|----------|------|-------------|
| MEETING_CREATE_SUCCESS | 회의록 직접 작성 | MEETING |
| MEETING_UPLOAD_SUCCESS | 회의록 파일 업로드 | MEETING |
| MEETING_DELETE_SUCCESS | 회의록 삭제 | MEETING |

### 일정 관련

| 액션 코드 | 설명 | target_type |
|----------|------|-------------|
| SCHEDULE_CREATE_SUCCESS | 일정 생성 | SCHEDULE |
| SCHEDULE_UPDATE_SUCCESS | 일정 수정 | SCHEDULE |
| SCHEDULE_DELETE_SUCCESS | 일정 삭제 | SCHEDULE |

### 관리자 관련

| 액션 코드 | 설명 | target_type |
|----------|------|-------------|
| USER_ROLE_UPDATED | 사용자 권한 변경 | USER |
| USER_PWD_RESET | 비밀번호 강제 초기화 | USER |
| USER_MOVE_SUCCESS | 사용자 부서 이동 | USER |

---

## 부록 B: 비동기 태스크 목록 (Celery)

| 태스크명 | 설명 | 진행률 추적 | Redis Key |
|---------|------|-----------|-----------|
| save_chat_task | 채팅 메시지 DB + Redis 저장 | X | - |
| ingest_pdf_task | PDF 문서 RAG 인덱싱 (벡터화) | O | `rag_task:{task_id}:progress` |
| generate_image_task | ComfyUI 이미지 생성 | O | `image_task:{task_id}:progress` |
| transcribe_audio_task | Whisper STT 음성 변환 + 요약 | O | `stt_task:{task_id}:progress` |
| update_summary_task | 대화 세션 요약 업데이트 | X | - |

### 진행률 조회 엔드포인트

| 태스크 | 조회 API |
|-------|---------|
| RAG 인덱싱 | `GET /document/status/{task_id}` |
| 이미지 생성 | `GET /image/status/{task_id}` |
| STT 변환 | `GET /meeting/status/{task_id}` |
| LLM 백그라운드 | `GET /ai/tasks/{task_id}` |

### 진행률 데이터 형식

```json
{
  "status": "processing",
  "progress": 45,
  "message": "음성 변환 중..."
}
```

---

## 부록 C: 화면 경로 매핑

| 화면 | 경로 | 접근 권한 | 컴포넌트 |
|------|------|----------|---------|
| 랜딩 페이지 | `/` | Public | IndexPage |
| 로그인 | `/login` | Public | LoginPage |
| 회원가입 | `/signup` | Public | SignUpPage |
| 홈 | `/home` | USER, ADMIN | HomePage |
| AI 챗봇 | `/chatbot` | USER, ADMIN | ChatbotPage |
| 일정 관리 | `/schedule` | USER, ADMIN | SchedulePage |
| 문서 보관함 | `/documents` | USER, ADMIN | DocumentPage |
| 회의록 분석 | `/meeting` | USER, ADMIN | MeetingPage |
| 이미지 생성 | `/images` | USER, ADMIN | ImagePage |
| 마이페이지 | `/mypage` | USER, ADMIN | MyPage |
| 관리자 대시보드 | `/dashboard` | ADMIN | DashboardPage |
| 부서 관리 | `/admin/depts` | ADMIN | DeptManagementPage |
| 관리자 설정 | `/admin/settings` | ADMIN | AdminSettingsPage |

---

## 부록 D: 에러 코드

| HTTP 코드 | 상황 | 설명 |
|----------|------|------|
| 200 | 성공 | 요청 처리 완료 |
| 400 | 잘못된 요청 | 입력값 검증 실패, 중복 데이터, 비즈니스 규칙 위반 |
| 401 | 인증 실패 | 토큰 만료, 잘못된 자격 증명 |
| 404 | 미존재 | 요청한 리소스를 찾을 수 없음 |
| 422 | 처리 불가 | 요청 형식 오류 (Pydantic 검증 실패) |
| 500 | 서버 오류 | 내부 서버 오류 |

---

## 문서 이력

| 버전 | 변경일 | 변경자 | 변경 내용 |
|------|--------|--------|----------|
| 1.0 | 2026-02-03 | 박제연 | 최초 작성 |
| 1.1 | 2026-02-03 | 박제연 | 실제 구현 코드 기반 전면 최신화 - API 경로, 요청/응답 구조, 시스템 로그 액션 코드, 화면 경로, 데이터 모델 정확도 수정 |
| 1.2 | 2026-02-04 | 박제연 | 임베딩 모델명 수정 (ko-sroberta-multitask → ko-sbert-nli) |
| 1.3 | 2026-02-07 | 박제연 | Section 12 "AIDot Admin Portal" 추가 (FN-APR-001~006) |
