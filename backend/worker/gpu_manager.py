"""
GPU VRAM 동적 자원 관리자 (배치 인식 스케줄링)

PC2 Worker에서 GPU VRAM을 공유하는 모델들의 로드/언로드를 관리합니다.
불필요한 모델 전환을 최소화하기 위해 배치 단위로 처리합니다.

모델 분류:
    - 상시 로드: 임베딩 모델 (~0.2~1.2GB) - 이 관리자 대상 아님
    - 동적 로드: ComfyUI 이미지 (SD 3.5) ~4.5GB
    - 동적 로드: Faster Whisper STT ~3.5GB

스케줄링 정책:
    - 같은 타입 작업: 모델 전환 없이 즉시 실행
    - 다른 타입 작업: 현재 배치(최대 5개)가 끝날 때까지 대기
    - 배치 한도 도달 OR 현재 타입 대기 없음: 모델 전환 실행
    - 대기 작업 없으면 모델 언로드하지 않음

Celery 큐 구조:
    - celery (기본): 일반 작업 (채팅 저장, RAG 등)
    - gpu_image: 이미지 생성 작업
    - gpu_stt: STT 음성 인식 작업

작성일: 2025
작성자: DOT-Project Team
"""

import os
import gc
import time
import redis
import requests as http_requests

# Redis 설정
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# ComfyUI 설정
COMFYUI_HOST = os.environ.get("COMFYUI_HOST", "comfyui")
COMFYUI_PORT = os.environ.get("COMFYUI_PORT", "8188")
COMFYUI_BASE_URL = f"http://{COMFYUI_HOST}:{COMFYUI_PORT}"

# =====================================================================
# 설정값
# =====================================================================
GPU_MAX_BATCH = 5                           # 모델 전환 전 최대 연속 처리 수
GPU_RETRY_COUNTDOWN = 5                     # 대기 시 재시도 간격 (초)

# Redis 키
_KEY_ACTIVE_MODEL = "gpu:active_model"      # 현재 활성 모델: "image" | "stt" | "none"
_KEY_BATCH_COUNT = "gpu:batch_count"        # 현재 모델의 연속 처리 수
_KEY_LAST_ACTIVITY = "gpu:last_activity"    # 마지막 GPU 사용 타임스탬프

# Celery 큐 이름 (Redis 키와 동일)
QUEUE_IMAGE = "gpu_image"
QUEUE_STT = "gpu_stt"

# 모델 타입 → 큐 이름 매핑
_QUEUE_MAP = {
    "image": QUEUE_IMAGE,
    "stt": QUEUE_STT,
}

# STT 모델 싱글톤 (Worker 프로세스 내)
_stt_model = None


# =====================================================================
# 내부 상태 관리
# =====================================================================

def _get_active_model() -> str:
    try:
        return redis_client.get(_KEY_ACTIVE_MODEL) or "none"
    except Exception:
        return "none"


def _set_active_model(model_type: str):
    try:
        redis_client.set(_KEY_ACTIVE_MODEL, model_type)
    except Exception as e:
        print(f"⚠️ [GPU] Redis 상태 업데이트 실패: {e}")


def _get_batch_count() -> int:
    try:
        val = redis_client.get(_KEY_BATCH_COUNT)
        return int(val) if val else 0
    except Exception:
        return 0


def _increment_batch():
    try:
        return redis_client.incr(_KEY_BATCH_COUNT)
    except Exception:
        return 0


def _reset_batch():
    try:
        redis_client.set(_KEY_BATCH_COUNT, 0)
    except Exception:
        pass


def _update_activity():
    try:
        redis_client.setex(_KEY_LAST_ACTIVITY, 120, str(time.time()))
    except Exception:
        pass


def _get_queue_length(queue_name: str) -> int:
    """Celery Redis 큐의 대기 작업 수 조회"""
    try:
        return redis_client.llen(queue_name)
    except Exception:
        return 0


# =====================================================================
# 모델 로드/언로드 (ComfyUI + STT)
# =====================================================================

def _free_comfyui_vram():
    """ComfyUI 컨테이너의 VRAM 해제 요청 (해제 완료 확인)"""
    try:
        print("🔄 [GPU] ComfyUI VRAM 해제 요청 중...")
        resp = http_requests.post(
            f"{COMFYUI_BASE_URL}/free",
            json={"free_memory": True},
            timeout=10
        )
        if resp.status_code == 200:
            print("✅ [GPU] ComfyUI VRAM 해제 요청 전송 완료")
        else:
            print(f"⚠️ [GPU] ComfyUI /free 응답: {resp.status_code}")
            time.sleep(2)
            return

        # VRAM 해제 완료 확인 (최대 30초, 2초 간격 폴링)
        for attempt in range(15):
            time.sleep(2)
            try:
                stats_resp = http_requests.get(
                    f"{COMFYUI_BASE_URL}/system_stats",
                    timeout=5
                )
                if stats_resp.status_code != 200:
                    continue

                devices = stats_resp.json().get("system", {}).get("devices", [])
                if not devices:
                    continue

                gpu = devices[0]
                vram_total = gpu.get("vram_total", 0)
                vram_free = gpu.get("vram_free", 0)

                if vram_total > 0:
                    vram_used_mb = (vram_total - vram_free) / (1024 * 1024)
                    free_pct = (vram_free / vram_total) * 100
                    print(f"📊 [GPU] ComfyUI VRAM: {vram_used_mb:.0f}MB 사용 중 "
                          f"({free_pct:.0f}% 여유, 시도 {attempt + 1}/15)")

                    # VRAM 사용량이 1GB 미만이면 해제 완료로 판단
                    if vram_used_mb < 1024:
                        print("✅ [GPU] ComfyUI VRAM 해제 확인 완료")
                        return
            except Exception:
                continue

        print("⚠️ [GPU] ComfyUI VRAM 해제 확인 타임아웃 (30초) - 계속 진행")

    except http_requests.exceptions.ConnectionError:
        print("⚠️ [GPU] ComfyUI 연결 불가 (컨테이너 미실행?)")
    except Exception as e:
        print(f"⚠️ [GPU] ComfyUI VRAM 해제 실패: {e}")


def _load_stt_model():
    """Faster Whisper STT 모델을 GPU에 로드"""
    global _stt_model
    if _stt_model is not None:
        return _stt_model

    try:
        from faster_whisper import WhisperModel
        print("📥 [GPU] Faster Whisper 모델 로딩 중... (GPU)")
        _clear_cuda_cache()

        # 로컬 모델 경로 (폐쇄망 - 외부 다운로드 불가)
        model_path = os.getenv("STT_MODEL_PATH", "/models/faster-whisper-large-v3")
        _stt_model = WhisperModel(
            model_path,
            device="cuda",
            compute_type="int8"
        )
        print("✅ [GPU] Faster Whisper 모델 로딩 완료")
        return _stt_model

    except ImportError:
        print("⚠️ [GPU] faster-whisper 패키지 미설치")
        return None
    except Exception as e:
        print(f"🔥 [GPU] STT 모델 로딩 실패: {e}")
        return None


def _unload_stt_model():
    """Faster Whisper STT 모델을 VRAM에서 언로드"""
    global _stt_model
    if _stt_model is None:
        return
    try:
        print("🔄 [GPU] Faster Whisper 모델 언로드 중...")
        del _stt_model
        _stt_model = None
        _clear_cuda_cache()
        print("✅ [GPU] Faster Whisper 모델 언로드 완료")
    except Exception as e:
        _stt_model = None
        print(f"⚠️ [GPU] STT 모델 언로드 중 오류: {e}")


def _clear_cuda_cache():
    """PyTorch CUDA 캐시 정리"""
    try:
        gc.collect()
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
    except Exception:
        pass


def _switch_to(model_type: str):
    """
    GPU 모델 전환

    현재 모델을 언로드하고 새 모델 타입으로 전환합니다.
    ComfyUI는 /prompt 요청 시 자동 로드되므로 여기서 직접 로드하지 않습니다.
    STT는 명시적으로 로드합니다.
    """
    current = _get_active_model()
    print(f"🔄 [GPU] 모델 전환: {current} → {model_type}")

    # 현재 모델 언로드
    if current == "image":
        _free_comfyui_vram()
    elif current == "stt":
        _unload_stt_model()

    # 새 모델 설정
    _set_active_model(model_type)
    _reset_batch()
    _update_activity()

    # STT는 명시적 로드 필요 (ComfyUI는 요청 시 자동 로드)
    if model_type == "stt":
        _load_stt_model()


# =====================================================================
# 공개 API: 배치 인식 GPU 획득
# =====================================================================

def try_acquire(task_type: str) -> bool:
    """
    GPU 자원 획득 시도 (배치 인식 스케줄링)

    Args:
        task_type: "image" 또는 "stt"

    Returns:
        True: 획득 성공, 작업 진행 가능
        False: 획득 실패, 다른 모델의 배치가 진행 중이므로 나중에 재시도

    스케줄링 정책:
        1. 같은 모델 → 즉시 진행 (배치 카운터 증가)
        2. 모델 없음 → 로드 후 진행
        3. 다른 모델 + 배치 한도 미달 + 대기 작업 있음 → 거부 (재시도)
        4. 다른 모델 + 배치 한도 도달 OR 대기 없음 → 전환 후 진행
    """
    current = _get_active_model()

    # Case 1: 같은 모델이 이미 활성 → 즉시 진행
    if current == task_type:
        count = _increment_batch()
        _update_activity()
        print(f"✅ [GPU] {task_type} 작업 진행 (배치 {count}/{GPU_MAX_BATCH})")
        return True

    # Case 2: GPU 비어있음 → 새 모델 로드
    if current == "none":
        _switch_to(task_type)
        _increment_batch()
        print(f"✅ [GPU] {task_type} 모델 새로 로드 (배치 1/{GPU_MAX_BATCH})")
        return True

    # Case 3 & 4: 다른 모델이 활성 중
    current_queue = _QUEUE_MAP.get(current, "")
    current_pending = _get_queue_length(current_queue)
    current_batch = _get_batch_count()

    if current_batch < GPU_MAX_BATCH and current_pending > 0:
        # Case 3: 현재 모델 배치 한도 미달 + 대기 작업 있음 → 대기
        print(f"⏳ [GPU] {task_type} 대기 - {current} 배치 처리 중 "
              f"({current_batch}/{GPU_MAX_BATCH}, 대기 {current_pending}개)")
        return False

    # Case 4: 배치 한도 도달 OR 대기 작업 없음 → 전환
    reason = "배치 한도 도달" if current_batch >= GPU_MAX_BATCH else "대기 작업 없음"
    print(f"🔄 [GPU] 모델 전환 결정 ({reason}): {current} → {task_type}")
    _switch_to(task_type)
    _increment_batch()
    return True


def _cleanup_comfyui_cache():
    """ComfyUI 내부 캐시 경량 정리 (모델은 유지, 중간 텐서만 해제)"""
    try:
        resp = http_requests.post(
            f"{COMFYUI_BASE_URL}/free",
            json={"free_memory": True},
            timeout=10
        )
        if resp.status_code == 200:
            print("🧹 [GPU] ComfyUI 내부 캐시 정리 완료")
    except Exception:
        pass


def after_task(task_type: str):
    """
    GPU 작업 완료 후 호출

    배치 한도에 도달했고 다른 타입의 대기 작업이 있으면
    현재 모델을 언로드하여 다음 작업이 빠르게 전환할 수 있도록 합니다.
    대기 작업이 없으면 현재 모델을 유지합니다.

    Args:
        task_type: 완료된 작업 타입 ("image" 또는 "stt")
    """
    _update_activity()
    current_batch = _get_batch_count()

    # 이미지 작업 후 ComfyUI 내부 캐시 정리 (연속 실행 시 메모리 단편화 방지)
    if task_type == "image":
        _cleanup_comfyui_cache()

    if current_batch >= GPU_MAX_BATCH:
        # 배치 한도 도달 → 다른 타입 대기 작업 확인
        other_type = "stt" if task_type == "image" else "image"
        other_queue = _QUEUE_MAP.get(other_type, "")
        other_pending = _get_queue_length(other_queue)

        if other_pending > 0:
            # 다른 타입 대기 중 → 미리 언로드하여 전환 준비
            print(f"📋 [GPU] 배치 {current_batch}개 완료, "
                  f"{other_type} 대기 {other_pending}개 → 사전 언로드")
            if task_type == "image":
                _free_comfyui_vram()
            elif task_type == "stt":
                _unload_stt_model()
            _set_active_model("none")
            _reset_batch()
        else:
            # 대기 작업 없음 → 현재 모델 유지 (불필요한 전환 방지)
            print(f"📋 [GPU] 배치 {current_batch}개 완료, "
                  f"대기 작업 없음 → {task_type} 모델 유지")
            _reset_batch()  # 카운터만 리셋


def release_if_idle():
    """
    유휴 GPU 자원 자동 해제 (Celery Beat에서 주기적 호출)

    양쪽 큐 모두 대기 작업이 없고 타임아웃이 경과하면 VRAM을 해제합니다.
    대기 작업이 있으면 해제하지 않습니다.

    Returns:
        dict: 해제 결과
    """
    current = _get_active_model()
    if current == "none":
        return {"status": "idle"}

    # 어느 쪽이든 대기 작업이 있으면 해제하지 않음
    image_pending = _get_queue_length(QUEUE_IMAGE)
    stt_pending = _get_queue_length(QUEUE_STT)

    if current == "image" and image_pending > 0:
        return {"status": "active", "model": "image", "pending": image_pending}
    if current == "stt" and stt_pending > 0:
        return {"status": "active", "model": "stt", "pending": stt_pending}

    # 대기 작업 없음 → 타임아웃 확인
    try:
        last_activity = redis_client.get(_KEY_LAST_ACTIVITY)
        if last_activity:
            elapsed = time.time() - float(last_activity)
            if elapsed < 30:
                return {"status": "waiting", "model": current, "idle": round(elapsed)}
    except Exception:
        pass

    # 타임아웃 경과 + 대기 없음 → 해제
    print(f"⏰ [GPU] 유휴 타임아웃 → {current} 모델 해제")
    if current == "image":
        _free_comfyui_vram()
    elif current == "stt":
        _unload_stt_model()
    _set_active_model("none")
    _reset_batch()
    return {"status": "released", "model": current}


def get_stt_model():
    """현재 로드된 STT 모델 반환 (미로드 시 로드 시도)"""
    if _stt_model is None:
        return _load_stt_model()
    return _stt_model


def get_status() -> dict:
    """GPU 관리자 현재 상태 조회 (디버깅용)"""
    return {
        "active_model": _get_active_model(),
        "batch_count": _get_batch_count(),
        "max_batch": GPU_MAX_BATCH,
        "queue_image_pending": _get_queue_length(QUEUE_IMAGE),
        "queue_stt_pending": _get_queue_length(QUEUE_STT),
    }
