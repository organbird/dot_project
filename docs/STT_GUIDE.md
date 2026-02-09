# Project Specification: On-Premise Meeting STT Service

## 1. Project Overview
본 프로젝트는 **폐쇄망(On-Premise)** 기업 환경에서 작동하는 AI 솔루션의 일부로, 회의 녹음 파일을 텍스트(STT)로 변환하는 백엔드 모듈을 개발한다.

## 2. Technical Constraints (Critical)
* **Hardware:** **NVIDIA GPU 8GB VRAM** (Single GPU).
* **Network:** **Closed Network (폐쇄망).** 외부 인터넷 접속 불가. (모델 파일은 로컬 경로에서 로드).
* **Performance:** 8GB VRAM 내에서 `Large` 모델을 구동해야 하므로 메모리 효율성이 최우선.
* **Timeline:** 1개월 단기 프로젝트 (복잡한 화자 분리 파이프라인 제외).

## 3. Key Tech Stack & Decisions
| Category | Selection | Reason |
| :--- | :--- | :--- |
| **Engine** | **Faster Whisper** | CTranslate2 기반으로 OpenAI Whisper 대비 4배 빠르고 메모리 효율적. |
| **Model** | `large-v3` | 한국어 인식률 확보를 위해 Large 모델 필수. |
| **Quantization** | **INT8** | 8GB VRAM에서 Large 모델 구동을 위해 필수 (약 4GB VRAM 점유 예상). |
| **Diarization** | **Not Used** | 화자 분리(Pyannote)는 리소스 부족 및 개발 복잡도로 인해 **제외**. |
| **Task Queue** | **Celery** | 비동기 작업 처리. GPU OOM 방지를 위해 **Worker Concurrency = 1** 필수. |

## 4. Implementation Requirements

### A. Model Inference (Faster Whisper)
1.  **Load Strategy:**
    * `FasterWhisper` 라이브러리 사용.
    * `device="cuda"`, `compute_type="int8"` 설정 필수.
    * 모델 경로는 로컬 디렉토리(예: `/models/faster-whisper-large-v3`)를 참조할 것.
2.  **Transcribe Options:**
    * `vad_filter=True` (무음 구간 필터링 필수).
    * `beam_size=5` (정확도 우선).

### B. Output Formatting (Text Post-processing)
화자 분리(Diarization)가 없으므로, 가독성을 위해 **타임스탬프**를 포함하여 텍스트를 구조화한다.
* **Raw Output:** Faster Whisper는 `Segment` 단위(start, end, text)를 반환함.
* **Formatted Output:** 각 세그먼트를 아래 포맷으로 변환하여 하나의 문자열로 결합.
    * **Format:** `[MM:SS ~ MM:SS] 텍스트 내용\n`
    * **Example:**
        ```text
        [00:00 ~ 00:05] 이번 주 주간 회의를 시작하겠습니다.
        [00:05 ~ 00:12] 지난주 이슈 사항에 대해 팀장님이 먼저 말씀해 주세요.
        ```

### C. Database Integration
* **Target Table:** `meeting_notes` (See Schema below).
* **Update Logic:**
    1.  Task 시작 시: `status` = `'PROCESSING'`
    2.  완료 시: `transcript` 컬럼 업데이트 (Formatted Text 저장), `status` = `'COMPLETED'`
    3.  에러 시: `status` = `'ERROR'`
* **Warning:** `transcript` 컬럼은 스키마상 `text`지만, 내용이 길어질 수 있으므로 코드 레벨에서는 `LONGTEXT`를 다루듯이 처리해야 함.

## 5. Database Schema (`meeting_notes`)
(참고: `aidot_db_테이블명세서_260115.csv` 기반)

```sql
CREATE TABLE meeting_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL, -- FK
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL, -- 저장된 오디오 파일명
    file_path VARCHAR(255), -- (추가 필요 시) 실제 파일 경로
    transcript LONGTEXT, -- 변환된 텍스트 (Formatted)
    summary TEXT,
    duration INT, -- 오디오 길이(초)
    task_id VARCHAR(255), -- Celery Task ID
    status ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'ERROR') NOT NULL DEFAULT 'QUEUED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);