# =====================================================================
# Image Engine - ComfyUI API 기반 이미지 생성 엔진 (Worker 전용)
# =====================================================================
# PC2 Worker에서 실행되는 이미지 생성 엔진
# - ComfyUI 사이드카 컨테이너와 HTTP/WebSocket 통신
# - SD 3.5 Medium GGUF 모델 사용 (8GB VRAM 최적화)
# - 번역은 PC1(Backend)에서 처리 후 영어 프롬프트 전달받음
# =====================================================================

import os
import json
import uuid
import time
import requests
from pathlib import Path
from typing import Optional, Callable

# WebSocket은 선택적 의존성 (설치 안 되어 있으면 폴링 방식 사용)
try:
    import websocket
    WEBSOCKET_AVAILABLE = True
except ImportError:
    WEBSOCKET_AVAILABLE = False
    print("⚠️ [ImageEngine] websocket-client 미설치, 폴링 방식 사용")


# =====================================================================
# 설정
# =====================================================================
COMFYUI_HOST = os.environ.get("COMFYUI_HOST", "comfyui")
COMFYUI_PORT = os.environ.get("COMFYUI_PORT", "8188")
COMFYUI_BASE_URL = f"http://{COMFYUI_HOST}:{COMFYUI_PORT}"

# 워크플로우 템플릿 경로
WORKFLOW_DIR = Path(__file__).parent / "workflows"
DEFAULT_WORKFLOW = "sd35_medium_gguf.json"

# 출력 폴더 (ComfyUI와 공유)
OUTPUT_DIR = Path("/ai_models/image/output")

# 연결 재시도 설정
MAX_RETRIES = 30
RETRY_DELAY = 2  # 초


class ImageEngine:
    """
    ComfyUI API 기반 이미지 생성 엔진 클래스

    ComfyUI 컨테이너와 HTTP/WebSocket으로 통신하여 이미지를 생성합니다.
    GPU 메모리 관리는 ComfyUI가 담당합니다.

    Attributes:
        workflow_template (dict): ComfyUI 워크플로우 JSON 템플릿
        client_id (str): WebSocket 클라이언트 식별자
    """

    def __init__(self):
        self.workflow_template = None
        self.client_id = str(uuid.uuid4())
        self._comfyui_ready = False

    def _load_workflow_template(self, workflow_name: str = DEFAULT_WORKFLOW) -> dict:
        """워크플로우 JSON 템플릿 로드"""
        workflow_path = WORKFLOW_DIR / workflow_name
        if not workflow_path.exists():
            raise FileNotFoundError(f"워크플로우 템플릿을 찾을 수 없습니다: {workflow_path}")

        with open(workflow_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _get_vram_stats(self) -> dict:
        """ComfyUI에서 GPU/VRAM 사용량 조회"""
        try:
            response = requests.get(f"{COMFYUI_BASE_URL}/system_stats", timeout=5)
            if response.status_code == 200:
                stats = response.json()
                devices = stats.get("devices", [])
                if devices:
                    gpu = devices[0]
                    vram_total = gpu.get("vram_total", 0)
                    vram_free = gpu.get("vram_free", 0)
                    vram_used = vram_total - vram_free
                    return {
                        "name": gpu.get("name", "Unknown"),
                        "vram_total_gb": round(vram_total / (1024**3), 2),
                        "vram_used_gb": round(vram_used / (1024**3), 2),
                        "vram_free_gb": round(vram_free / (1024**3), 2),
                        "vram_percent": round((vram_used / vram_total) * 100, 1) if vram_total > 0 else 0
                    }
        except Exception as e:
            print(f"⚠️ [ImageEngine] VRAM 정보 조회 실패: {e}")
        return None

    def _log_vram_usage(self, phase: str):
        """VRAM 사용량 로깅"""
        stats = self._get_vram_stats()
        if stats:
            print(f"📊 [VRAM] {phase}")
            print(f"   - GPU: {stats['name']}")
            print(f"   - 사용량: {stats['vram_used_gb']}GB / {stats['vram_total_gb']}GB ({stats['vram_percent']}%)")
            print(f"   - 여유: {stats['vram_free_gb']}GB")

    def _wait_for_comfyui(self) -> bool:
        """ComfyUI 서버가 준비될 때까지 대기"""
        if self._comfyui_ready:
            return True

        print(f"🔄 [ImageEngine] ComfyUI 서버 대기 중... ({COMFYUI_BASE_URL})")

        for attempt in range(MAX_RETRIES):
            try:
                response = requests.get(f"{COMFYUI_BASE_URL}/system_stats", timeout=5)
                if response.status_code == 200:
                    print(f"✅ [ImageEngine] ComfyUI 서버 연결 성공!")
                    self._comfyui_ready = True
                    return True
            except requests.exceptions.RequestException:
                pass

            print(f"   - 재시도 {attempt + 1}/{MAX_RETRIES}...")
            time.sleep(RETRY_DELAY)

        print(f"❌ [ImageEngine] ComfyUI 서버 연결 실패")
        return False

    def load_model(self):
        """
        모델 로딩 (ComfyUI에서는 자동 관리됨)

        이 메서드는 호환성을 위해 유지되지만,
        실제 모델 로딩은 ComfyUI가 첫 요청 시 자동으로 수행합니다.
        """
        print("🚀 [ImageEngine] ComfyUI 모드 - 모델은 첫 요청 시 자동 로딩됩니다.")

        # ComfyUI 서버 연결 확인
        if not self._wait_for_comfyui():
            raise ConnectionError("ComfyUI 서버에 연결할 수 없습니다.")

        # 워크플로우 템플릿 로드
        if self.workflow_template is None:
            self.workflow_template = self._load_workflow_template()
            print(f"✅ [ImageEngine] 워크플로우 템플릿 로드 완료")

    def is_loaded(self) -> bool:
        """모델 로드 상태 확인 (ComfyUI 연결 상태)"""
        return self._comfyui_ready

    def unload_model(self):
        """
        모델 언로드 (ComfyUI에서는 별도 작업 불필요)

        ComfyUI가 자체적으로 메모리를 관리합니다.
        필요시 ComfyUI의 /free 엔드포인트를 호출할 수 있습니다.
        """
        print("🔄 [ImageEngine] ComfyUI 모드 - 메모리는 ComfyUI가 자동 관리합니다.")

        # 선택적: ComfyUI 메모리 해제 요청
        try:
            requests.post(f"{COMFYUI_BASE_URL}/free", json={"free_memory": True}, timeout=10)
            print("✅ [ImageEngine] ComfyUI 메모리 해제 요청 완료")
        except Exception as e:
            print(f"⚠️ [ImageEngine] 메모리 해제 요청 실패 (무시): {e}")

    def _apply_style_prompt(self, prompt: str, style: str) -> tuple:
        """스타일에 따른 프롬프트 수식어 추가 및 네거티브 프롬프트 반환

        SD 3.5 Medium은 자연어 기반 T5 인코더를 사용하므로,
        태그 나열보다 자연스러운 문장형 프롬프트가 더 효과적입니다.
        """
        style_config = {
            # === SD 3.5 비즈니스 특화 프리셋 ===
            "corporate": {
                "positive": "professional commercial photography, authentic business atmosphere, shot on 35mm lens, soft studio lighting, depth of field, modern office environment, high quality, 4k",
                "negative": "anime, cartoon, illustration, low quality, blurry, deformed, watermark, text overlay"
            },
            "product": {
                "positive": "professional product photography, studio lighting, clean white background, 8k uhd, commercial advertisement style, sharp details, centered composition",
                "negative": "noisy, grainy, low resolution, messy background, dark, shadows, cluttered"
            },
            "typography": {
                "positive": "high quality poster design, clear typography, cinematic lighting, vibrant colors, professional graphic design, sharp text rendering",
                "negative": "spelling mistakes, blurry text, messy lines, low resolution, pixelated"
            },
            # === 기존 스타일 (SD 3.5 최적화) ===
            "realistic": {
                "positive": "photorealistic photograph, highly detailed, professional photography, natural lighting, 8k uhd, sharp focus, authentic look",
                "negative": "cartoon, anime, illustration, painting, drawing, low quality, blurry, deformed, artificial"
            },
            "anime": {
                "positive": "anime style artwork, vibrant colors, cel shading, studio ghibli inspired, manga art, detailed illustration",
                "negative": "photorealistic, photo, 3d render, low quality, blurry, deformed"
            },
            "cartoon": {
                "positive": "cartoon style illustration, bold outlines, flat colors, playful design, disney style, clean lines",
                "negative": "photorealistic, photo, anime, low quality, blurry, deformed"
            }
        }

        config = style_config.get(style, style_config["realistic"])
        positive = f"{prompt}, {config['positive']}"
        negative = config["negative"]

        return positive, negative

    def _parse_size(self, size: str) -> tuple:
        """크기 문자열을 width, height 튜플로 파싱"""
        try:
            width, height = map(int, size.split("x"))
            # SD 3.5는 1024x1024가 기본, 64의 배수로 조정
            width = max(512, min(2048, (width // 64) * 64))
            height = max(512, min(2048, (height // 64) * 64))
            return width, height
        except:
            return 1024, 1024  # SD 3.5 기본 해상도

    def _inject_parameters(
        self,
        workflow: dict,
        positive_prompt: str,
        negative_prompt: str,
        width: int,
        height: int,
        seed: int,
        steps: int,
        cfg: float,
        output_prefix: str
    ) -> dict:
        """워크플로우 템플릿에 파라미터 주입"""
        # 깊은 복사
        workflow_copy = json.loads(json.dumps(workflow))
        prompt_data = workflow_copy.get("prompt", workflow_copy)

        # 각 노드의 입력값을 문자열 치환
        workflow_str = json.dumps(prompt_data)

        # 프롬프트 문자열을 JSON 안전하게 이스케이프 (따옴표, 백슬래시 등 처리)
        def escape_for_json(s: str) -> str:
            # json.dumps로 이스케이프 후 앞뒤 따옴표 제거
            return json.dumps(s)[1:-1]

        replacements = {
            "{{POSITIVE_PROMPT}}": escape_for_json(positive_prompt),
            "{{NEGATIVE_PROMPT}}": escape_for_json(negative_prompt),
            "{{WIDTH}}": str(width),
            "{{HEIGHT}}": str(height),
            "{{SEED}}": str(seed),
            "{{STEPS}}": str(steps),
            "{{CFG}}": str(cfg),
            "{{OUTPUT_PREFIX}}": output_prefix
        }

        for placeholder, value in replacements.items():
            workflow_str = workflow_str.replace(placeholder, value)

        return json.loads(workflow_str)

    def _queue_prompt(self, prompt: dict) -> str:
        """ComfyUI에 프롬프트 큐 요청"""
        payload = {
            "prompt": prompt,
            "client_id": self.client_id
        }

        response = requests.post(
            f"{COMFYUI_BASE_URL}/prompt",
            json=payload,
            timeout=30
        )
        response.raise_for_status()

        result = response.json()
        prompt_id = result.get("prompt_id")

        if not prompt_id:
            raise RuntimeError(f"프롬프트 ID를 받지 못했습니다: {result}")

        return prompt_id

    def _wait_for_completion_polling(self, prompt_id: str, timeout: int = 300) -> bool:
        """폴링 방식으로 작업 완료 대기"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                response = requests.get(f"{COMFYUI_BASE_URL}/history/{prompt_id}", timeout=10)
                if response.status_code == 200:
                    history = response.json()
                    if prompt_id in history:
                        status = history[prompt_id].get("status", {})
                        if status.get("completed", False):
                            return True
                        if status.get("status_str") == "error":
                            raise RuntimeError(f"ComfyUI 작업 실패: {history[prompt_id]}")
            except requests.exceptions.RequestException:
                pass

            time.sleep(1)

        raise TimeoutError(f"이미지 생성 타임아웃 ({timeout}초)")

    def _wait_for_completion_websocket(self, prompt_id: str, timeout: int = 300) -> bool:
        """WebSocket 방식으로 작업 완료 대기"""
        ws_url = f"ws://{COMFYUI_HOST}:{COMFYUI_PORT}/ws?clientId={self.client_id}"

        ws = websocket.create_connection(ws_url, timeout=timeout)
        try:
            start_time = time.time()

            while time.time() - start_time < timeout:
                result = ws.recv()
                if result:
                    message = json.loads(result)
                    msg_type = message.get("type")

                    if msg_type == "executing":
                        data = message.get("data", {})
                        if data.get("prompt_id") == prompt_id:
                            if data.get("node") is None:
                                # 모든 노드 실행 완료
                                return True

                    elif msg_type == "execution_error":
                        raise RuntimeError(f"ComfyUI 실행 오류: {message}")

                    elif msg_type == "progress":
                        data = message.get("data", {})
                        value = data.get("value", 0)
                        max_val = data.get("max", 1)
                        print(f"   📊 진행률: {value}/{max_val}")

        finally:
            ws.close()

        raise TimeoutError(f"이미지 생성 타임아웃 ({timeout}초)")

    def _get_output_images(self, prompt_id: str) -> list:
        """생성된 이미지 파일 경로 조회"""
        response = requests.get(f"{COMFYUI_BASE_URL}/history/{prompt_id}", timeout=10)
        response.raise_for_status()

        history = response.json()
        if prompt_id not in history:
            return []

        outputs = history[prompt_id].get("outputs", {})
        images = []

        for node_id, node_output in outputs.items():
            if "images" in node_output:
                for img_info in node_output["images"]:
                    filename = img_info.get("filename")
                    subfolder = img_info.get("subfolder", "")
                    if filename:
                        if subfolder:
                            images.append(OUTPUT_DIR / subfolder / filename)
                        else:
                            images.append(OUTPUT_DIR / filename)

        return images

    def generate(
        self,
        prompt: str,
        style: str = "realistic",
        size: str = "1024x1024",
        num_inference_steps: int = 28,
        guidance_scale: float = 4.5,
        seed: Optional[int] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None
    ) -> bytes:
        """
        프롬프트를 기반으로 이미지 생성

        Args:
            prompt (str): 이미지 생성 프롬프트 (영어, PC1에서 번역됨)
            style (str): 이미지 스타일
            size (str): 이미지 크기 (기본: 1024x1024)
            num_inference_steps (int): 추론 단계 수 (SD 3.5 권장: 28)
            guidance_scale (float): CFG 스케일 (SD 3.5 권장: 4.5)
            seed (Optional[int]): 랜덤 시드
            progress_callback: 진행률 콜백 (미사용, 호환성 유지)

        Returns:
            bytes: PNG 형식의 이미지 바이트
        """
        start_time = time.time()

        try:
            # 1. ComfyUI 연결 확인
            if not self._wait_for_comfyui():
                raise ConnectionError("ComfyUI 서버에 연결할 수 없습니다.")

            # 2. 워크플로우 템플릿 로드
            if self.workflow_template is None:
                self.workflow_template = self._load_workflow_template()

            # 3. 파라미터 준비
            positive_prompt, negative_prompt = self._apply_style_prompt(prompt, style)
            width, height = self._parse_size(size)
            actual_seed = seed if seed is not None else int(time.time() * 1000) % (2**32)
            output_prefix = f"dot_{uuid.uuid4().hex[:8]}"

            print(f"🎨 [ImageEngine] 이미지 생성 시작 (ComfyUI)")
            print(f"   - 프롬프트: {prompt[:50]}...")
            print(f"   - 스타일: {style}")
            print(f"   - 크기: {width}x{height}")
            print(f"   - 스텝: {num_inference_steps}")
            print(f"   - CFG: {guidance_scale}")
            print(f"   - 시드: {actual_seed}")

            # VRAM 사용량 로깅 (생성 전)
            self._log_vram_usage("이미지 생성 시작 전")

            # 4. 워크플로우에 파라미터 주입
            workflow = self._inject_parameters(
                self.workflow_template,
                positive_prompt,
                negative_prompt,
                width,
                height,
                actual_seed,
                num_inference_steps,
                guidance_scale,
                output_prefix
            )

            # 5. ComfyUI에 작업 요청
            print(f"📤 [ImageEngine] ComfyUI에 작업 요청 중...")
            prompt_id = self._queue_prompt(workflow)
            print(f"   - Prompt ID: {prompt_id}")

            # 6. 작업 완료 대기
            print(f"⏳ [ImageEngine] 이미지 생성 대기 중...")
            if WEBSOCKET_AVAILABLE:
                self._wait_for_completion_websocket(prompt_id)
            else:
                self._wait_for_completion_polling(prompt_id)

            # 7. 생성된 이미지 파일 조회
            output_images = self._get_output_images(prompt_id)
            if not output_images:
                raise RuntimeError("생성된 이미지를 찾을 수 없습니다.")

            # 8. 첫 번째 이미지 파일 읽기
            image_path = output_images[0]
            print(f"   - 출력 파일: {image_path}")

            # 파일이 생성될 때까지 잠시 대기
            for _ in range(10):
                if image_path.exists():
                    break
                time.sleep(0.5)

            if not image_path.exists():
                raise FileNotFoundError(f"이미지 파일을 찾을 수 없습니다: {image_path}")

            with open(image_path, "rb") as f:
                image_bytes = f.read()

            # ComfyUI 임시 출력 파일 삭제 (PC1에 HTTP 전송 후 유일한 사본이 됨)
            try:
                image_path.unlink()
                print(f"🗑️ [ImageEngine] ComfyUI 임시 파일 삭제: {image_path.name}")
            except Exception:
                pass

            # VRAM 사용량 로깅 (생성 후)
            self._log_vram_usage("이미지 생성 완료 후")

            total_time = time.time() - start_time
            print(f"✅ [ImageEngine] 이미지 생성 완료!")
            print(f"   - 파일 크기: {len(image_bytes)} bytes")
            print(f"   - 총 소요 시간: {total_time:.2f}초")

            return image_bytes

        except Exception as e:
            # ComfyUI 연결 실패 시 ready 상태 리셋 → 다음 요청에서 재연결 시도
            error_str = str(e).lower()
            if any(kw in error_str for kw in ['connection', 'resolve', 'refused', 'lost', 'timeout', 'disconnect']):
                self._comfyui_ready = False
                print(f"🔄 [ImageEngine] ComfyUI 연결 상태 리셋 (다음 요청 시 재연결)")
            raise


# =====================================================================
# 전역 인스턴스 (싱글톤 패턴)
# =====================================================================
_image_engine_instance = None


def get_image_engine() -> ImageEngine:
    """ImageEngine 싱글톤 인스턴스 반환"""
    global _image_engine_instance
    if _image_engine_instance is None:
        _image_engine_instance = ImageEngine()
    return _image_engine_instance


def load_image_model():
    """이미지 모델 로딩 (ComfyUI 연결 확인)"""
    engine = get_image_engine()
    engine.load_model()


def unload_image_model():
    """이미지 모델 언로드 (ComfyUI 메모리 해제 요청)"""
    engine = get_image_engine()
    engine.unload_model()
