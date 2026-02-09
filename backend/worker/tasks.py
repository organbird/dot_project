"""
Celery 비동기 작업 정의 모듈

주요 작업:
    - save_chat_task: 채팅 메시지를 MySQL과 Redis에 저장
    - ingest_pdf_task: PDF 파일을 벡터 DB에 학습
    - generate_image_task: ComfyUI로 이미지 생성
    - transcribe_audio_task: Faster Whisper STT 변환
"""

from worker.celery_app import celery_app
from app.database import SessionLocal
from app import models
import json
import redis
import os
import time
import tempfile
import requests as http_requests
from dotenv import load_dotenv
from worker.gpu_manager import try_acquire, after_task, release_if_idle, GPU_RETRY_COUNTDOWN

load_dotenv()

# 워커 전용 Redis 클라이언트
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# PC1 백엔드 API URL
MASTER_API_URL = os.getenv("MASTER_API_URL", "http://backend:8000")

# 임베딩 모델 (지연 초기화)
_embedding_model = None

def get_embedding_model():
    """임베딩 모델 싱글톤 반환"""
    global _embedding_model
    if _embedding_model is None:
        from langchain_huggingface import HuggingFaceEmbeddings
        print("📥 [Worker] 임베딩 모델 로딩 중... (GPU 모드)")
        _embedding_model = HuggingFaceEmbeddings(
            model_name="jhgan/ko-sbert-nli",
            model_kwargs={'device': 'cuda'},
            encode_kwargs={'normalize_embeddings': True}
        )
        print("✅ [Worker] 임베딩 모델 로딩 완료")
    return _embedding_model

# 이미지 생성 엔진 (지연 초기화)
_image_engine = None

def _get_image_engine():
    """이미지 엔진 싱글톤 반환 (ComfyUI API Client)"""
    global _image_engine
    if _image_engine is None:
        from ai_core.image_engine import ImageEngine
        _image_engine = ImageEngine()
        print("🎨 [Worker] ImageEngine 인스턴스 생성 (ComfyUI API Client)")
    return _image_engine


# =====================================================================
# 공통 헬퍼 함수
# =====================================================================

def _update_task_progress(task_type: str, task_id: str, progress: int, message: str, status: str = "processing"):
    """작업 진행률을 Redis에 저장 (RAG/이미지/STT 공용)"""
    try:
        redis_key = f"{task_type}_task:{task_id}:progress"
        progress_data = {"status": status, "progress": progress, "message": message}
        redis_client.setex(redis_key, 600, json.dumps(progress_data, ensure_ascii=False))
        print(f"📊 [{task_type.upper()} Progress] {progress}% - {message}")
    except Exception as e:
        print(f"⚠️ [{task_type.upper()} Progress] Redis 저장 실패: {e}")


def _call_llm_summary(prompt: str, label: str = "요약") -> str:
    """PC1 LLM API를 호출하여 요약 생성 (문서/회의 공용)"""
    try:
        backend_url = MASTER_API_URL
        print(f"📡 [Worker] {label}을 위해 LLM API 호출 중... ({backend_url})")

        response = http_requests.post(
            f"{backend_url}/ai/chat/generate",
            json={"message": prompt},
            timeout=10
        )

        if response.status_code != 200:
            print(f"⚠️ [Worker] LLM API 호출 실패: {response.status_code}")
            return None

        llm_task_id = response.json().get("task_id")
        print(f"📥 [Worker] LLM {label} 작업 시작됨 (Task ID: {llm_task_id})")

        # Polling으로 결과 대기 (최대 120초)
        for attempt in range(120):
            time.sleep(1)
            result_response = http_requests.get(
                f"{backend_url}/ai/tasks/{llm_task_id}",
                timeout=5
            )
            if result_response.status_code == 200:
                result_data = result_response.json()
                if result_data.get("status") == "completed":
                    summary = result_data.get("result", "").strip()
                    print(f"✅ [Worker] LLM {label} 응답 받음 (시도: {attempt + 1}회)")
                    return summary
                elif result_data.get("status") == "failed":
                    print(f"⚠️ [Worker] LLM {label} 생성 실패: {result_data.get('error')}")
                    return None

        print(f"⏱️ [Worker] LLM {label} 응답 타임아웃 (120초 초과)")
        return None

    except http_requests.exceptions.Timeout:
        print(f"⏱️ [Worker] LLM API 요청 타임아웃")
        return None
    except http_requests.exceptions.ConnectionError:
        print(f"🔌 [Worker] LLM API 연결 실패")
        return None
    except Exception as e:
        print(f"⚠️ [Worker] {label} 생성 중 에러: {e}")
        return None


def _generate_document_summary(texts: list) -> str:
    """문서 텍스트 청크로부터 LLM 요약 생성"""
    combined_text = ""
    for chunk in texts:
        if len(combined_text) + len(chunk) > 3000:
            remaining = 3000 - len(combined_text)
            if remaining > 0:
                combined_text += chunk[:remaining]
            break
        combined_text += chunk + "\n"

    if not combined_text.strip():
        return None

    prompt = f"""다음은 PDF 문서의 내용입니다. 이 문서의 핵심 내용을 간결하게 요약해주세요.
요약은 3~5문장, 300자 이내로 작성하세요.
문서의 주제, 핵심 내용, 주요 결론을 포함해주세요.

[문서 내용]
{combined_text}

[요약]"""
    return _call_llm_summary(prompt, "문서 요약")


def _generate_meeting_summary(transcript: str) -> str:
    """회의 전문 텍스트로부터 LLM 요약 생성"""
    text = transcript[:3000] if len(transcript) > 3000 else transcript
    if not text.strip():
        return None

    prompt = f"""다음은 회의 녹음을 텍스트로 변환한 내용입니다. 이 회의의 핵심 내용을 간결하게 요약해주세요.
요약은 3~5문장, 300자 이내로 작성하세요.
회의의 주제, 논의 내용, 주요 결론이나 결정사항을 포함해주세요.

[회의 내용]
{text}

[요약]"""
    return _call_llm_summary(prompt, "회의 요약")


# =====================================================================
# 채팅 저장 Task
# =====================================================================

@celery_app.task(name="save_chat_task")
def save_chat_task(session_id: int, user_msg: str, ai_msg: str, ref_docs_json: str):
    """채팅 메시지를 MySQL과 Redis에 비동기로 저장"""
    print(f"💾 [Worker] 대화 저장 시작 (Session: {session_id})")

    db = SessionLocal()
    try:
        # 1. MySQL 저장
        user_chat = models.ChatMessage(
            session_id=session_id, sender="user",
            content=user_msg, reference_docs=None
        )
        db.add(user_chat)

        parsed_ref_docs = None
        if ref_docs_json:
            try:
                parsed_ref_docs = json.loads(ref_docs_json) if isinstance(ref_docs_json, str) else ref_docs_json
            except json.JSONDecodeError:
                parsed_ref_docs = None

        ai_chat = models.ChatMessage(
            session_id=session_id, sender="assistant",
            content=ai_msg, reference_docs=parsed_ref_docs
        )
        db.add(ai_chat)
        db.commit()
        print("✅ [Worker] MySQL 저장 완료")

        # 2. Redis 캐시 갱신
        redis_key = f"session:{session_id}:context"
        try:
            cached_context = redis_client.get(redis_key)
            context_data = json.loads(cached_context) if cached_context else {"summary": None, "messages": []}

            context_data["messages"].append({"sender": "user", "content": user_msg})
            context_data["messages"].append({"sender": "assistant", "content": ai_msg})

            current_count = len(context_data["messages"])
            print(f"✅ [Worker] Redis 캐시 업데이트 완료 (현재 메시지 수: {current_count}개)")

            # 메시지가 10개 이상이면 재요약 트리거
            if current_count >= 10:
                print(f"🔄 [Worker] Redis 메시지 {current_count}개 - 자동 재요약 트리거")
                oldest_two = context_data["messages"][:2]

                from worker.tasks import update_summary_task
                update_summary_task.delay(
                    session_id=session_id,
                    current_summary=context_data.get("summary"),
                    oldest_messages=oldest_two
                )

                context_data["messages"] = context_data["messages"][2:]
                print(f"✅ [Worker] 재요약 트리거 + 오래된 2개 제거 (남은: {len(context_data['messages'])}개)")

            redis_client.setex(redis_key, 3600, json.dumps(context_data, ensure_ascii=False))
        except Exception as redis_err:
            print(f"⚠️ [Worker] Redis 업데이트 실패 (무시): {redis_err}")

    except Exception as e:
        print(f"🔥 [Worker] 저장 실패: {e}")
        db.rollback()
    finally:
        db.close()


@celery_app.task(name="update_summary_task")
def update_summary_task(session_id: int, current_summary: str, oldest_messages: list):
    """세션 요약을 재생성하는 비동기 작업 (PC1 LLM API 호출)"""
    print(f"🔄 [Worker] 세션 {session_id} 요약 재생성 시작")

    # 프롬프트 구성
    context = f"[기존 요약]\n{current_summary}\n\n" if current_summary else ""
    context += "[새로 추가된 대화]\n"
    for msg in oldest_messages:
        role_name = "사용자" if msg["sender"] == "user" else "AI"
        context += f"{role_name}: {msg['content']}\n"

    prompt = f"""다음은 채팅 세션의 대화 내용입니다.

{context}

위 내용을 간결하게 요약해주세요. 핵심 주제와 중요한 정보만 포함하세요.
요약은 200자 이내로 작성하세요.
"""

    new_summary = _call_llm_summary(prompt, "세션 요약")
    if not new_summary:
        return "🔥 요약 생성 실패"

    # DB 업데이트
    db = SessionLocal()
    try:
        session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
        if session:
            session.current_summary = new_summary
            db.commit()
            print(f"✅ [Worker] 세션 {session_id} MySQL 요약 업데이트 완료")

            # Redis 동기화
            try:
                redis_key = f"session:{session_id}:context"
                cached_context = redis_client.get(redis_key)
                if cached_context:
                    context_data = json.loads(cached_context)
                    context_data["summary"] = new_summary
                    redis_client.setex(redis_key, 3600, json.dumps(context_data, ensure_ascii=False))
                    print(f"✅ [Worker] Redis 요약도 동기화 완료")
            except Exception as redis_err:
                print(f"⚠️ [Worker] Redis 요약 동기화 실패 (무시): {redis_err}")

            return "✅ 요약 업데이트 완료"
        else:
            return f"⚠️ 세션 {session_id} 없음"
    except Exception as e:
        print(f"🔥 [Worker] DB 업데이트 실패: {e}")
        db.rollback()
        return f"🔥 DB 업데이트 실패: {str(e)}"
    finally:
        db.close()


# =====================================================================
# PDF 벡터화 Task
# =====================================================================

@celery_app.task(name="ingest_pdf_task", bind=True)
def ingest_pdf_task(self, file_path: str):
    """PDF를 벡터화하여 PC1 ChromaDB에 저장"""
    from langchain_community.document_loaders import PyPDFLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    task_id = self.request.id
    print(f"📥 [Worker] PDF 학습 시작: {file_path} (Task ID: {task_id})")

    file_name = os.path.basename(file_path)
    chroma_id = file_name.split('.')[0]

    _update_task_progress("rag", task_id, 5, "문서 처리를 시작합니다...")

    db = SessionLocal()
    tmp_path = None
    try:
        # 1. PC1에서 PDF 다운로드
        _update_task_progress("rag", task_id, 10, "PDF 파일을 다운로드하고 있습니다...")
        download_url = f"{MASTER_API_URL}/document/internal/file/{file_name}"
        resp = http_requests.get(download_url, timeout=60)
        if resp.status_code != 200:
            raise RuntimeError(f"PDF 다운로드 실패: {resp.status_code} - {resp.text}")

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        _update_task_progress("rag", task_id, 20, "PDF 다운로드가 완료되었습니다.")

        # 2. PDF 파싱 + 청크 분할
        _update_task_progress("rag", task_id, 25, "PDF 내용을 분석하고 있습니다...")
        loader = PyPDFLoader(tmp_path)
        docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
        splits = text_splitter.split_documents(docs)
        _update_task_progress("rag", task_id, 35, f"텍스트 분할 완료 ({len(splits)}개 청크)")

        # 3. 임베딩 생성
        _update_task_progress("rag", task_id, 40, "임베딩 모델을 준비하고 있습니다...")
        model = get_embedding_model()
        _update_task_progress("rag", task_id, 50, "문서 임베딩을 생성하고 있습니다...")
        texts = [s.page_content for s in splits]
        metadatas = [{"source": file_path, "page": s.metadata.get("page", 0)} for s in splits]
        embeddings = model.embed_documents(texts)

        # 4. PC1으로 벡터 전송
        _update_task_progress("rag", task_id, 60, "벡터 데이터를 서버로 전송하고 있습니다...")
        store_url = f"{MASTER_API_URL}/document/internal/store-vectors"
        store_resp = http_requests.post(
            store_url,
            json={"embeddings": embeddings, "texts": texts, "metadatas": metadatas},
            timeout=120
        )
        if store_resp.status_code != 200:
            raise RuntimeError(f"벡터 저장 실패: {store_resp.status_code} - {store_resp.text}")

        # 5. LLM 문서 요약
        _update_task_progress("rag", task_id, 70, "AI가 문서를 요약하고 있습니다...")
        doc_summary = _generate_document_summary(texts)

        # 6. DB 업데이트
        _update_task_progress("rag", task_id, 90, "데이터베이스를 업데이트하고 있습니다...")
        doc = db.query(models.Document).filter(models.Document.chroma_id == chroma_id).first()
        if doc:
            doc.status = "INDEXED"
            if doc_summary:
                doc.summary = doc_summary
            db.commit()

        result = f"저장 완료! (총 {len(splits)}개의 조각으로 분할됨)"
        _update_task_progress("rag", task_id, 100, "문서 벡터화가 완료되었습니다!", "completed")
        return result

    except Exception as e:
        error_msg = f"학습 중 에러 발생: {str(e)}"
        print(f"🔥 {error_msg}")
        _update_task_progress("rag", task_id, 0, f"문서 처리 실패: {str(e)}", "failed")

        try:
            doc = db.query(models.Document).filter(models.Document.chroma_id == chroma_id).first()
            if doc:
                doc.status = "ERROR"
                db.commit()
        except Exception as db_err:
            print(f"🔥 [Worker] DB 상태 업데이트 실패: {db_err}")

        return error_msg
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        db.close()


# =====================================================================
# 이미지 생성 Task (ComfyUI)
# =====================================================================

@celery_app.task(name="generate_image_task", bind=True, max_retries=20)
def generate_image_task(self, image_id: str, prompt: str, style: str = "realistic",
                        size: str = "1024x1024", user_id: int = None):
    """ComfyUI로 이미지를 비동기 생성 후 PC1에 전송"""
    task_id = self.request.id
    print(f"🎨 [Worker] 이미지 생성 시작 (Task ID: {task_id})")
    print(f"   - Image ID: {image_id}, Style: {style}, Size: {size}")
    print(f"   - Prompt: {prompt[:50]}...")

    # GPU 자원 획득
    if not try_acquire("image"):
        print(f"⏳ [Worker] GPU 사용 중 - {GPU_RETRY_COUNTDOWN}초 후 재시도")
        raise self.retry(countdown=GPU_RETRY_COUNTDOWN)

    _update_task_progress("image", task_id, 5, "이미지 생성 준비 중...")
    file_name = f"{image_id}.png"

    try:
        # 1. 이미지 엔진 초기화
        _update_task_progress("image", task_id, 10, "이미지 엔진 초기화 중...")
        engine = _get_image_engine()

        # 2. ComfyUI 연결 확인
        if not engine.is_loaded():
            _update_task_progress("image", task_id, 15, "ComfyUI 서버 연결 중...")
            engine.load_model()
            _update_task_progress("image", task_id, 30, "ComfyUI 연결 완료")
        else:
            _update_task_progress("image", task_id, 30, "ComfyUI 준비 완료 (연결됨)")

        # 3. 이미지 생성
        _update_task_progress("image", task_id, 35, "ComfyUI에서 이미지 생성 중...")
        image_bytes = engine.generate(
            prompt=prompt, style=style, size=size,
            num_inference_steps=28, guidance_scale=4.5,
            progress_callback=None
        )

        _update_task_progress("image", task_id, 87, "이미지 생성 완료, PC1으로 전송 중...")

        # 4. PC1으로 이미지 HTTP 전송
        file_size = len(image_bytes)
        upload_url = f"{MASTER_API_URL}/image/internal/upload"
        upload_response = http_requests.post(
            upload_url,
            files={"file": (file_name, image_bytes, "image/png")},
            data={"image_id": image_id},
            timeout=30
        )
        if upload_response.status_code != 200:
            raise RuntimeError(f"PC1 이미지 업로드 실패: {upload_response.status_code} - {upload_response.text}")

        upload_result = upload_response.json()
        file_path = upload_result.get("file_path", f"/app/uploads/images/{file_name}")
        print(f"✅ [Worker] PC1 이미지 전송 완료: {file_name} ({file_size} bytes)")

        _update_task_progress("image", task_id, 90, "PC1 저장 완료")

        # 5. DB 업데이트
        _update_task_progress("image", task_id, 95, "데이터베이스 업데이트 중...")
        if user_id:
            db = SessionLocal()
            try:
                image_record = db.query(models.GeneratedImage).filter(
                    models.GeneratedImage.img_file == file_name
                ).first()
                if image_record:
                    image_record.img_size = file_size
                    db.commit()
            except Exception as db_err:
                print(f"⚠️ [Worker] DB 업데이트 실패: {db_err}")
                db.rollback()
            finally:
                db.close()

        _update_task_progress("image", task_id, 100, "이미지 생성이 완료되었습니다!", "completed")
        return {"status": "completed", "file_path": file_path, "file_name": file_name, "file_size": file_size}

    except Exception as e:
        error_str = str(e)

        # ComfyUI 크래시 → 자동 재시도
        comfyui_crash_keywords = ['resolve', 'Connection', 'refused', 'lost', 'RemoteDisconnected']
        is_comfyui_crash = any(kw.lower() in error_str.lower() for kw in comfyui_crash_keywords)

        if is_comfyui_crash:
            print(f"⚠️ [Worker] ComfyUI 연결 실패 - 30초 후 재시도")
            _update_task_progress("image", task_id, 5, "ComfyUI 재연결 대기 중... (자동 재시도)")
            try:
                raise self.retry(countdown=30)
            except self.MaxRetriesExceededError:
                pass

        error_msg = f"이미지 생성 실패: {error_str}"
        print(f"🔥 [Worker] {error_msg}")
        _update_task_progress("image", task_id, 0, error_msg, "failed")
        return {"status": "failed", "error": error_msg}

    finally:
        after_task("image")


# =====================================================================
# GPU 유휴 자원 해제 Task
# =====================================================================

@celery_app.task(name="release_gpu_if_idle_task")
def release_gpu_if_idle_task():
    """유휴 GPU 자원 자동 해제 (Celery Beat 주기적 호출)"""
    return release_if_idle()


# =====================================================================
# STT (Speech-to-Text) Task - Faster Whisper
# =====================================================================

@celery_app.task(name="transcribe_audio_task", bind=True, max_retries=20)
def transcribe_audio_task(self, meeting_id: int, audio_filename: str, language: str = "ko"):
    """회의 음성을 텍스트로 변환 (Faster Whisper + LLM 요약)"""
    from worker.gpu_manager import get_stt_model

    task_id = self.request.id
    print(f"🎤 [Worker] STT 작업 시작 (Task ID: {task_id}, Meeting: {meeting_id})")

    # GPU 자원 획득
    if not try_acquire("stt"):
        print(f"⏳ [Worker] GPU 사용 중 - {GPU_RETRY_COUNTDOWN}초 후 재시도")
        raise self.retry(countdown=GPU_RETRY_COUNTDOWN)

    _update_task_progress("stt", task_id, 5, "음성 변환 준비 중...")

    db = SessionLocal()
    tmp_path = None
    try:
        # DB 상태를 PROCESSING으로 업데이트
        meeting = db.query(models.MeetingNote).filter(models.MeetingNote.id == meeting_id).first()
        if meeting:
            meeting.status = "PROCESSING"
            db.commit()

        # 1. PC1에서 오디오 다운로드
        _update_task_progress("stt", task_id, 10, "오디오 파일 다운로드 중...")
        download_url = f"{MASTER_API_URL}/meeting/internal/file/{audio_filename}"
        resp = http_requests.get(download_url, timeout=120)
        if resp.status_code != 200:
            raise RuntimeError(f"오디오 다운로드 실패: {resp.status_code} - {resp.text}")

        ext = audio_filename.rsplit('.', 1)[-1] if '.' in audio_filename else 'wav'
        with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        _update_task_progress("stt", task_id, 20, "오디오 다운로드 완료")

        # 2. STT 모델 로드
        _update_task_progress("stt", task_id, 25, "STT 모델 로딩 중...")
        model = get_stt_model()
        if model is None:
            raise RuntimeError("STT 모델 로드 실패")

        # 3. 음성 인식
        _update_task_progress("stt", task_id, 35, "음성 인식 시작...")
        segments, info = model.transcribe(tmp_path, language=language, beam_size=5, vad_filter=True)

        # 4. 타임스탬프 포맷 변환
        _update_task_progress("stt", task_id, 50, "음성 인식 처리 중...")
        transcript_lines = []
        total_duration = 0
        segment_count = 0

        for segment in segments:
            start_mm, start_ss = int(segment.start) // 60, int(segment.start) % 60
            end_mm, end_ss = int(segment.end) // 60, int(segment.end) % 60
            text = segment.text.strip()

            if text:
                transcript_lines.append(f"[{start_mm:02d}:{start_ss:02d} ~ {end_mm:02d}:{end_ss:02d}] {text}")

            total_duration = max(total_duration, int(segment.end))
            segment_count += 1

            if segment_count % 10 == 0:
                progress = min(50 + segment_count // 2, 75)
                _update_task_progress("stt", task_id, progress, f"음성 인식 중... ({segment_count}개 세그먼트)")

        transcript = "\n".join(transcript_lines)
        print(f"✅ [Worker] STT 완료: {segment_count}개 세그먼트, {total_duration}초")

        # 5. LLM 요약 생성
        _update_task_progress("stt", task_id, 80, "AI가 회의 내용을 요약하고 있습니다...")
        meeting_summary = _generate_meeting_summary(transcript)

        # 6. DB 업데이트
        _update_task_progress("stt", task_id, 90, "데이터베이스 업데이트 중...")
        meeting = db.query(models.MeetingNote).filter(models.MeetingNote.id == meeting_id).first()
        if meeting:
            meeting.transcript = transcript
            meeting.duration = total_duration
            meeting.status = "COMPLETED"
            if meeting_summary:
                meeting.summary = meeting_summary
            db.commit()

        _update_task_progress("stt", task_id, 100, "음성 변환이 완료되었습니다!", "completed")
        return {"status": "completed", "meeting_id": meeting_id, "segments": segment_count, "duration": total_duration}

    except Exception as e:
        error_msg = f"STT 변환 실패: {str(e)}"
        print(f"🔥 [Worker] {error_msg}")
        _update_task_progress("stt", task_id, 0, f"음성 변환 실패: {str(e)}", "failed")

        try:
            meeting = db.query(models.MeetingNote).filter(models.MeetingNote.id == meeting_id).first()
            if meeting:
                meeting.status = "ERROR"
                db.commit()
        except Exception as db_err:
            print(f"⚠️ [Worker] DB 상태 업데이트 실패: {db_err}")

        return {"status": "failed", "error": error_msg}

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        db.close()
        after_task("stt")
