"""
AI Router - AI 채팅, 스트리밍, PDF 업로드 처리
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app import models
from app.database import get_db
from app.config import redis_client
import shutil
import json
import os
import threading
import time
import uuid

from ai_core.llm_engine import LLMEngine, llm_lock
from ai_core.rag_engine import RAGEngine
from worker.tasks import ingest_pdf_task, save_chat_task, update_summary_task

router = APIRouter(prefix="/ai", tags=["AI Core"])

llm = LLMEngine()
rag = RAGEngine()


# Pydantic 요청 모델
class ChatRequest(BaseModel):
    message: str

class ChatStreamRequest(BaseModel):
    session_id: int
    message: str
    history: list = []

class SummaryUpdateRequest(BaseModel):
    oldest_message_ids: list[int]

class ChatStopRequest(BaseModel):
    session_id: int


def load_ai_models():
    """서버 시작 시 LLM 모델 로딩"""
    print("🚀 [AI Router] LLM 모델 로딩 시작...")
    try:
        llm.load_model()
        print("✅ [AI Router] 모델 로딩 완료!")
    except Exception as e:
        print(f"🔥 [AI Router] 모델 로딩 실패: {e}")


@router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    """RAG 기반 일반 채팅 (비스트리밍, 완성된 응답 한 번에 반환)"""
    user_msg = req.message
    print(f"📩 [User] {user_msg}")

    search_results = rag.search(user_msg, k=3)

    if search_results:
        print(f"🔎 [RAG] 관련 문서 {len(search_results)}개 발견")
        context_text = "\n".join([res['content'] for res in search_results])
        final_prompt = f"""
        [지시사항]
        당신은 유능한 AI 어시스턴트입니다.
        사용자 질문에 답변하되, 아래 [참고 자료]를 활용하세요.

        ★중요★: 만약 [참고 자료]가 질문과 전혀 관련이 없다면, 자료를 무시하고 당신의 배경지식으로 답변하세요.
        자료를 억지로 연결짓지 마세요. 반대로 [참고 자료]가 관련성이 있다면 이 자료 내에서 답변하고, 지어내지 마세요.

        [참고 자료]
        {context_text}

        [질문]
        {user_msg}
        """
    else:
        print("🤷‍♂️ [RAG] 관련 문서 없음")
        final_prompt = f"""
        [지시사항]
        당신은 유능한 AI 어시스턴트입니다. 질문에 친절하게 한국어로 답변하세요.

        [질문]
        {user_msg}
        """

    llm.ensure_loaded()
    response = llm.chat(final_prompt)
    return {"reply": response, "context_used": search_results}


@router.get("/chat/sessions/{session_id}/messages")
def get_chat_history(session_id: int, db: Session = Depends(get_db)):
    """세션 채팅 히스토리 조회 (Redis 캐시 → MySQL 폴백)"""
    redis_key = f"session:{session_id}:context"

    cached_context = redis_client.get(redis_key)
    if cached_context:
        print(f"⚡ [Cache Hit] 세션 {session_id} - Redis에서 로드")
        return json.loads(cached_context)

    print(f"🐢 [Cache Miss] 세션 {session_id} - DB에서 조회")

    session = db.query(models.ChatSession)\
        .filter(models.ChatSession.id == session_id)\
        .first()

    if not session:
        return {"summary": None, "messages": []}

    db_messages = db.query(models.ChatMessage)\
        .filter(models.ChatMessage.session_id == session_id)\
        .order_by(models.ChatMessage.created_at.desc())\
        .limit(10)\
        .all()

    db_messages = list(reversed(db_messages))

    messages_list = [
        {"sender": "user" if msg.sender == "user" else "assistant", "content": msg.content}
        for msg in db_messages
    ]

    result = {"summary": session.current_summary, "messages": messages_list}

    redis_client.setex(redis_key, 3600, json.dumps(result, ensure_ascii=False))
    print(f"✅ [Cache Refill] 세션 {session_id} - 요약 + 최근 {len(messages_list)}개 메시지 저장")

    return result


def background_producer(session_id: int, user_msg: str, final_input: str, history: list, search_results: list):
    """백그라운드 스레드에서 LLM 응답 생성 → Redis 큐 푸시 (Producer)"""
    stream_key = f"session:{session_id}:stream_queue"
    stop_key = f"session:{session_id}:stop"

    redis_client.delete(stream_key)
    full_ai_response = ""
    is_stopped = False

    print(f"👻 [Thread] 세션 {session_id} 생성 시작")

    try:
        if search_results:
            docs_json = json.dumps(search_results, ensure_ascii=False)
            redis_client.rpush(stream_key, f"DOCS:{docs_json}")

        llm.ensure_loaded()

        for token in llm.chat_stream(final_input, history):
            if redis_client.exists(stop_key):
                print(f"🛑 [Thread] 중단 신호 감지!")
                is_stopped = True
                break
            full_ai_response += token
            redis_client.rpush(stream_key, f"TEXT:{token}")

    except Exception as e:
        print(f"🔥 [Thread] 생성 중 에러: {e}")
        redis_client.rpush(stream_key, f"ERROR:{str(e)}")
        return

    if is_stopped:
        redis_client.rpush(stream_key, "STOPPED")
        redis_client.delete(stop_key)
        print("🗑️ [Thread] 작업 폐기 (DB 저장 안함)")
        return

    redis_client.rpush(stream_key, "DONE")

    print(f"💾 [Thread] 생성 완료. Celery에게 저장 요청 (길이: {len(full_ai_response)})")
    ref_json = json.dumps(search_results, ensure_ascii=False) if search_results else None
    save_chat_task.delay(
        session_id=session_id,
        user_msg=user_msg,
        ai_msg=full_ai_response,
        ref_docs_json=ref_json
    )

    redis_client.expire(stream_key, 60)


@router.post("/chat/stream")
async def chat_stream_endpoint(req: ChatStreamRequest):
    """실시간 스트리밍 채팅 (SSE, Producer-Consumer 패턴)"""
    session_id = req.session_id
    user_msg = req.message

    search_results = rag.search(user_msg, k=3)

    if search_results:
        context_text = "\n".join([res['content'] for res in search_results])
        final_input = f"""[참고 자료]\n{context_text}\n\n[질문]\n{user_msg}\n\n자료를 바탕으로 답변하세요."""
    else:
        final_input = user_msg

    t = threading.Thread(
        target=background_producer,
        args=(session_id, user_msg, final_input, req.history, search_results),
        daemon=True
    )
    t.start()

    def event_consumer():
        """Redis 큐에서 토큰을 읽어 SSE로 스트리밍"""
        stream_key = f"session:{session_id}:stream_queue"
        last_activity = time.time()

        while True:
            if time.time() - last_activity > 30:
                print("⏱️ [Consumer] 타임아웃")
                break

            item = redis_client.blpop(stream_key, timeout=1)

            if item:
                last_activity = time.time()
                _, value = item

                if value == "DONE":
                    break
                if value == "STOPPED":
                    yield f"STOPPED_DATA:\n\n"
                    break
                if value.startswith("DOCS:"):
                    yield f"DOCS_DATA:{value[5:]}\n\n"
                elif value.startswith("TEXT:"):
                    yield f"TEXT_DATA:{value[5:]}\n\n"
                elif value.startswith("ERROR:"):
                    yield f"ERROR_DATA:{value[6:]}\n\n"
                    break

    return StreamingResponse(event_consumer(), media_type="text/event-stream")


@router.post("/chat/stop")
async def stop_chat_generation(req: ChatStopRequest):
    """실행 중인 채팅 생성 중단 (중단 플래그 → 생산자 스레드 종료)"""
    stop_key = f"session:{req.session_id}:stop"
    redis_client.set(stop_key, "1", ex=60)

    stream_key = f"session:{req.session_id}:stream_queue"
    redis_client.delete(stream_key)
    redis_client.rpush(stream_key, "STOPPED")

    print(f"🛑 [Stop] 세션 {req.session_id} 중단 요청 접수")
    return {"status": "stopped"}


@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """PDF 업로드 후 Celery Worker에서 벡터DB 임베딩 처리"""
    save_dir = "/ai_models/uploads"
    os.makedirs(save_dir, exist_ok=True)

    file_path = os.path.join(save_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    task = ingest_pdf_task.delay(file_path)
    print(f"👋 [Backend] Worker에게 작업 전달 완료 (Task ID: {task.id})")

    return {
        "filename": file.filename,
        "status": "Processing started in background (Worker)",
        "task_id": task.id
    }


@router.post("/sessions/{session_id}/update-summary")
async def update_session_summary(session_id: int, req: SummaryUpdateRequest, db: Session = Depends(get_db)):
    """세션 요약 재생성 (가장 오래된 2개 메시지 + 기존 요약 → Celery Worker)"""
    session = db.query(models.ChatSession)\
        .filter(models.ChatSession.id == session_id)\
        .first()

    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    oldest_messages = db.query(models.ChatMessage)\
        .filter(models.ChatMessage.id.in_(req.oldest_message_ids))\
        .order_by(models.ChatMessage.created_at.asc())\
        .all()

    if len(oldest_messages) < 2:
        raise HTTPException(status_code=400, detail=f"Need at least 2 messages (found {len(oldest_messages)})")

    messages_list = [{"sender": msg.sender, "content": msg.content} for msg in oldest_messages]

    task = update_summary_task.delay(
        session_id=session_id,
        current_summary=session.current_summary,
        oldest_messages=messages_list
    )

    print(f"🔄 [API] 세션 {session_id} 요약 업데이트 요청 (Task: {task.id})")
    return {"status": "processing", "task_id": task.id, "message": f"Summary update started for session {session_id}"}


@router.post("/chat/generate")
async def generate_chat_background(req: ChatRequest):
    """백그라운드 LLM 생성 (Worker PC가 호출, 결과는 Redis에 저장)"""
    task_id = str(uuid.uuid4())

    def run_llm_background():
        try:
            print(f"🚀 [Background] LLM 생성 시작 (Task: {task_id})")
            result = llm.chat(req.message)
            redis_client.setex(
                f"llm_result:{task_id}", 300,
                json.dumps({"result": result, "status": "completed"}, ensure_ascii=False)
            )
            print(f"✅ [Background] LLM 생성 완료 (Task: {task_id})")
        except Exception as e:
            error_msg = str(e)
            print(f"🔥 [Background] LLM 생성 실패 (Task: {task_id}): {error_msg}")
            redis_client.setex(
                f"llm_result:{task_id}", 300,
                json.dumps({"error": error_msg, "status": "failed"}, ensure_ascii=False)
            )

    thread = threading.Thread(target=run_llm_background, daemon=True)
    thread.start()

    print(f"📤 [API] LLM 작업 시작 (Task: {task_id})")
    return {"task_id": task_id, "status": "processing"}


@router.get("/tasks/{task_id}")
async def get_task_result(task_id: str):
    """백그라운드 LLM 작업 결과 조회 (Worker polling용)"""
    redis_key = f"llm_result:{task_id}"
    result_json = redis_client.get(redis_key)

    if not result_json:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found (may be expired)")

    return json.loads(result_json)
