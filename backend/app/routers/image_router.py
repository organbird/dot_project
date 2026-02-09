"""
image_router.py - 이미지 생성 API

AI 이미지 생성 및 관리 기능 제공:
1. 이미지 생성 (프롬프트 기반) - PC2 Worker → ComfyUI (SD 3.5 Medium GGUF)
2. 이미지 목록 조회 (갤러리)
3. 이미지 상세 조회
4. 이미지 삭제

Note:
    - 한글 프롬프트: PC1 LLM으로 영어 번역 후 Worker에 전달
    - 이미지 생성: PC2 Worker에서 ComfyUI 사이드카 컨테이너를 통해 비동기 실행
    - 스타일 지원: corporate, product, typography, realistic, anime, cartoon
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta, timezone
from typing import Optional
from pydantic import BaseModel
import uuid
import os
import re
import json

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))

from app.database import get_db
from app.config import redis_client
from app.utils import format_file_size
from app import models
from app.crud import create_system_log

# Worker Task import
from worker.tasks import generate_image_task


router = APIRouter(
    prefix="/image",
    tags=["Image"]
)

# 이미지 저장 경로 (PC1 로컬 디스크 - HTTP 업로드로 수신)
IMAGE_DIR = "/app/uploads/images"
os.makedirs(IMAGE_DIR, exist_ok=True)


# ============================================================================
# Pydantic 스키마
# ============================================================================

class ImageGenerateRequest(BaseModel):
    """이미지 생성 요청 스키마"""
    user_id: int
    prompt: str
    style: Optional[str] = "realistic"  # realistic, anime, cartoon, sketch, etc.
    size: Optional[str] = "1024x1024"   # 512x512, 1024x1024, etc.


# ============================================================================
# 유틸리티 함수
# ============================================================================

def _contains_korean(text: str) -> bool:
    """텍스트에 한글이 포함되어 있는지 확인"""
    korean_pattern = re.compile('[가-힣]')
    return bool(korean_pattern.search(text))


def _translate_with_llm(text: str) -> str:
    """
    PC1의 LLM을 사용하여 한글을 SD 3.5용 영문 프롬프트로 변환
    
    Args:
        text: 번역할 텍스트 (한글)
        
    Returns:
        str: 이미지 생성에 최적화된 영문 텍스트
    """
    if not _contains_korean(text):
        return text

    try:
        from app.routers.ai_router import llm

        # LLM이 로드되어 있지 않으면 로드
        if llm.model is None:
            print("🔄 [번역] LLM 모델 로드 중...")
            llm.load_model()

        # [수정] LLM의 지식(Knowledge)이 아닌 지침(Instruction)에 기반한 프롬프트
        # SD 3.5라는 용어 대신, 그 모델이 필요로 하는 '결과물 형태'를 구체적으로 묘사합니다.
        
        system_instruction = """You are a professional Prompt Engineer for high-end AI image generators.
Your goal is to translate the user's Korean request into a **Descriptive English Sentence**.

Do NOT use comma-separated tags (e.g., "sky, blue, cloud").
Instead, write a flowing natural language description (e.g., "A clear blue sky with fluffy white clouds").

**Translation Rules:**
1. **Natural Language:** Write like you are describing a scene to a blind person. Focus on Subject, Action, and Context.
2. **Add Detail:** If the user input is simple (e.g., "cat"), expand it with high-quality details (e.g., lighting, fur texture, background atmosphere).
3. **Preserve Quotes:** STRICTLY KEEP any text inside double quotes (" ") exactly as is.
4. **No Explanations:** Output ONLY the final English prompt string.

**Style Guide:**
- Lighting: Mention "cinematic lighting", "natural sunlight", or "studio lighting".
- Atmosphere: Describe the mood (e.g., "cozy", "futuristic", "professional")."""

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Convert this to an image prompt: {text}"}
        ]

        response = llm.model.create_chat_completion(
            messages=messages,
            max_tokens=300,  # 묘사가 길어질 수 있으므로 토큰 수 약간 증가
            temperature=0.3, # 약간의 창의성 허용 (살을 붙이기 위함)
        )

        translated = response['choices'][0]['message']['content'].strip()

        # 혹시 모를 잡다한 접두사 제거
        for prefix in ["English:", "Prompt:", "Translation:"]:
            if translated.lower().startswith(prefix.lower()):
                translated = translated[len(prefix):].strip()

        print(f"🌐 [프롬프트 변환] 한글 → SD3.5 영어")
        print(f"   원본: {text}")
        print(f"   변환: {translated}")

        return translated

    except Exception as e:
        print(f"⚠️ [번역] LLM 번역 실패: {e}")
        return text




def format_datetime_kst(dt: datetime) -> str:
    """UTC datetime을 한국 시간(KST)으로 변환하여 포맷팅"""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    kst_time = dt.astimezone(KST)
    return kst_time.strftime("%Y-%m-%d %H:%M")


# ============================================================================
# 1. 이미지 생성 (비동기 - Worker에서 실행)
# ============================================================================

@router.post("/generate")
def generate_image(data: ImageGenerateRequest, request: Request, db: Session = Depends(get_db)):
    """
    프롬프트를 기반으로 AI 이미지를 생성합니다. (비동기)

    프로세스:
    1. 한글 프롬프트인 경우 PC1 LLM으로 영어 번역
    2. DB에 초기 레코드 생성 (status="PROCESSING")
    3. PC2 Worker에 이미지 생성 작업 전달
    4. 즉시 응답 반환 (task_id 포함)

    Args:
        data: 이미지 생성 요청 데이터 (user_id, prompt, style, size)

    Returns:
        생성 요청 정보 (이미지는 Worker에서 비동기 생성)

    Note:
        - 스타일: realistic, anime, cartoon, sketch, watercolor
        - 크기: 512x512, 768x768, 1024x1024
        - 한글 프롬프트 자동 번역 지원
    """
    # 사용자 존재 확인
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 프롬프트 검증
    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="프롬프트를 입력해주세요.")

    # 1. 한글 프롬프트 번역 (PC1 LLM 사용)
    original_prompt = data.prompt.strip()
    english_prompt = _translate_with_llm(original_prompt)

    # 2. 이미지 ID 생성
    image_id = str(uuid.uuid4())
    file_ext = "png"
    file_name = f"{image_id}.{file_ext}"

    # 3. DB에 초기 레코드 생성 (status는 없으므로 img_size=0으로 처리 중 표시)
    new_image = models.GeneratedImage(
        user_id=data.user_id,
        prompt=original_prompt,  # 원본 한글 프롬프트 저장
        img_file=file_name,
        img_ext=file_ext,
        img_size=0  # Worker 완료 후 업데이트
    )

    db.add(new_image)
    db.commit()
    db.refresh(new_image)

    # 4. Worker에 이미지 생성 작업 전달
    task = generate_image_task.delay(
        image_id=image_id,
        prompt=english_prompt,  # 번역된 영어 프롬프트 전달
        style=data.style,
        size=data.size,
        user_id=data.user_id
    )

    print(f"🎨 [API] 이미지 생성 요청 → Worker")
    print(f"   - Image ID: {image_id}")
    print(f"   - Task ID: {task.id}")
    print(f"   - Prompt: {english_prompt[:50]}...")

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=data.user_id,
        action="IMAGE_GENERATE_REQUEST",
        target_id=new_image.id,
        target_type="IMAGE",
        ip_addr=request.client.host,
        details=f"이미지 생성 요청: {original_prompt[:50]}..."
    )

    return {
        "message": "이미지 생성 요청이 접수되었습니다. 백그라운드에서 생성 중입니다.",
        "image": {
            "id": new_image.id,
            "prompt": new_image.prompt,
            "fileName": new_image.img_file,
            "imageUrl": f"/image/file/{new_image.img_file}",
            "status": "processing",
            "createdAt": format_datetime_kst(new_image.created_at)
        },
        "taskId": task.id
    }


# ============================================================================
# 2. 이미지 목록 조회 (갤러리)
# ============================================================================

@router.get("/list/{user_id}")
def get_image_list(
    user_id: int,
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(12, ge=1, le=50, description="페이지당 항목 수"),
    search: Optional[str] = Query(None, description="검색어 (프롬프트)"),
    db: Session = Depends(get_db)
):
    """
    생성된 이미지 목록을 갤러리 형태로 반환합니다.

    Args:
        user_id: 사용자 ID
        page: 페이지 번호 (1부터 시작)
        size: 페이지당 항목 수 (갤러리용으로 12개 기본)
        search: 검색어 (프롬프트에서 검색)

    Returns:
        페이징된 이미지 목록
    """
    # 사용자 확인
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    # 기본 쿼리
    query = db.query(models.GeneratedImage).filter(models.GeneratedImage.user_id == user_id)

    # 검색어 필터
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(models.GeneratedImage.prompt.ilike(search_pattern))

    # 전체 개수
    total_count = query.count()

    # 페이징 적용 (최신순 정렬)
    offset = (page - 1) * size
    images = query.order_by(desc(models.GeneratedImage.created_at)).offset(offset).limit(size).all()

    # 총 페이지 수 계산
    total_pages = (total_count + size - 1) // size

    # 이미지 목록 변환
    image_list = [{
        "id": img.id,
        "prompt": img.prompt,
        "promptPreview": img.prompt[:50] + "..." if len(img.prompt) > 50 else img.prompt,
        "fileName": img.img_file,
        "imageUrl": f"/image/file/{img.img_file}",
        "fileSize": img.img_size,
        "fileSizeText": format_file_size(img.img_size) if img.img_size > 0 else "생성 중...",
        "status": "completed" if img.img_size > 0 else "processing",
        "createdAt": format_datetime_kst(img.created_at)
    } for img in images]

    return {
        "images": image_list,
        "pagination": {
            "currentPage": page,
            "totalPages": total_pages,
            "totalCount": total_count,
            "pageSize": size,
            "hasNext": page < total_pages,
            "hasPrev": page > 1
        }
    }


# ============================================================================
# 3. 이미지 생성 진행률 조회
# ============================================================================

@router.get("/status/{task_id}")
def get_image_generation_status(task_id: str):
    """
    이미지 생성 작업의 진행률을 조회합니다.

    Args:
        task_id: Celery Task ID

    Returns:
        진행률 정보 (status, progress, message)

    Note:
        - Worker에서 Redis에 저장한 진행률 정보를 조회
        - 프론트엔드에서 폴링으로 호출
    """
    redis_key = f"image_task:{task_id}:progress"

    try:
        cached_data = redis_client.get(redis_key)

        if cached_data:
            progress_data = json.loads(cached_data)
            return progress_data
        else:
            # 캐시에 데이터가 없으면 대기 중 상태
            return {
                "status": "pending",
                "progress": 0,
                "message": "작업 대기 중..."
            }

    except Exception as e:
        print(f"⚠️ [Status] Redis 조회 실패: {e}")
        return {
            "status": "unknown",
            "progress": 0,
            "message": "상태 조회 실패"
        }


# ============================================================================
# 3-1. 내부 이미지 업로드 (Worker → PC1 HTTP 전송용)
# ============================================================================

@router.post("/internal/upload")
async def internal_upload_image(
    file: UploadFile = File(...),
    image_id: str = Form(...)
):
    """
    PC2 Worker에서 생성된 이미지를 HTTP로 수신하여 PC1 로컬 디스크에 저장합니다.

    이 API는 Worker(PC2)에서만 호출됩니다.
    SMB 공유 폴더 대신 HTTP 전송으로 파일을 전달받아
    PC1 로컬 디스크(/app/uploads/images/)에 저장합니다.

    Args:
        file: 이미지 파일 (PNG)
        image_id: 이미지 UUID (파일명으로 사용)

    Returns:
        저장된 파일 정보 (경로, 이름, 크기)
    """
    file_name = f"{image_id}.png"
    file_path = os.path.join(IMAGE_DIR, file_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_size = len(content)
    print(f"📥 [API] 워커 이미지 수신 완료: {file_name} ({file_size} bytes)")

    return {
        "status": "success",
        "file_path": file_path,
        "file_name": file_name,
        "file_size": file_size
    }


# ============================================================================
# 4. 이미지 상세 조회
# ============================================================================

@router.get("/{image_id}")
def get_image_detail(image_id: int, db: Session = Depends(get_db)):
    """
    특정 이미지의 상세 정보를 반환합니다.

    Args:
        image_id: 이미지 ID

    Returns:
        이미지 상세 정보
    """
    image = db.query(models.GeneratedImage).filter(models.GeneratedImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")

    author = db.query(models.User).filter(models.User.id == image.user_id).first()

    return {
        "id": image.id,
        "prompt": image.prompt,
        "fileName": image.img_file,
        "fileExt": image.img_ext,
        "fileSize": image.img_size,
        "fileSizeText": format_file_size(image.img_size) if image.img_size > 0 else "생성 중...",
        "imageUrl": f"/image/file/{image.img_file}",
        "status": "completed" if image.img_size > 0 else "processing",
        "authorId": image.user_id,
        "authorName": author.name if author else "알 수 없음",
        "createdAt": format_datetime_kst(image.created_at)
    }


# ============================================================================
# 4. 이미지 파일 제공
# ============================================================================

@router.get("/file/{file_name}")
def get_image_file(file_name: str):
    """
    이미지 파일을 반환합니다.

    Args:
        file_name: 이미지 파일명

    Returns:
        이미지 파일
    """
    file_path = os.path.join(IMAGE_DIR, file_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="이미지 파일을 찾을 수 없습니다.")

    return FileResponse(file_path, media_type="image/png")


# ============================================================================
# 5. 이미지 삭제
# ============================================================================

@router.delete("/{image_id}")
def delete_image(image_id: int, request: Request, user_id: int = None, db: Session = Depends(get_db)):
    """
    이미지를 삭제합니다.

    Args:
        image_id: 삭제할 이미지 ID

    Returns:
        삭제 완료 메시지
    """
    image = db.query(models.GeneratedImage).filter(models.GeneratedImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")

    image_prompt = image.prompt[:30] if image.prompt else "이미지"
    image_user_id = user_id or image.user_id

    # 파일 삭제
    file_path = os.path.join(IMAGE_DIR, image.img_file)
    if os.path.exists(file_path):
        os.remove(file_path)

    # DB에서 삭제
    db.delete(image)
    db.commit()

    # 시스템 로그 기록
    create_system_log(
        db,
        user_id=image_user_id,
        action="IMAGE_DELETE_SUCCESS",
        target_id=image_id,
        target_type="IMAGE",
        ip_addr=request.client.host,
        details=f"이미지 삭제: {image_prompt}..."
    )

    return {"message": "이미지가 삭제되었습니다."}


# ============================================================================
# 6. 최근 생성 이미지 조회
# ============================================================================

@router.get("/recent/{user_id}")
def get_recent_images(user_id: int, limit: int = 6, db: Session = Depends(get_db)):
    """
    최근 생성한 이미지를 반환합니다.

    Args:
        user_id: 사용자 ID
        limit: 조회할 개수 (기본: 6)

    Returns:
        최근 이미지 목록
    """
    images = db.query(models.GeneratedImage).filter(
        models.GeneratedImage.user_id == user_id
    ).order_by(desc(models.GeneratedImage.created_at)).limit(limit).all()

    return {
        "images": [{
            "id": img.id,
            "prompt": img.prompt,
            "promptPreview": img.prompt[:30] + "..." if len(img.prompt) > 30 else img.prompt,
            "imageUrl": f"/image/file/{img.img_file}",
            "status": "completed" if img.img_size > 0 else "processing",
            "createdAt": format_datetime_kst(img.created_at)
        } for img in images]
    }
