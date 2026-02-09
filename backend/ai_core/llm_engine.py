# =====================================================================
# LLM Engine - 대화형 언어 모델 엔진
# =====================================================================
# 이 파일은 Llama 모델을 사용한 대화 생성 기능을 제공합니다.
# - llama-cpp-python 라이브러리 사용
# - GPU 가속 지원
# - 스트리밍 및 일반 채팅 모드 지원
# - 대화 히스토리 관리
# - Thread-safe: 다중 사용자 환경에서 안전한 동시성 제어
# =====================================================================

import os
import threading
from llama_cpp import Llama

# LLM 동시 접근 제어를 위한 Lock (이미지 생성/채팅 간 충돌 방지)
llm_lock = threading.Lock()

class LLMEngine:
    """
    대화형 언어 모델 엔진 클래스

    Llama 모델(GGUF 포맷)을 사용하여 대화 생성 기능을 제공합니다.
    GPU 가속을 지원하며, 스트리밍 및 일반 모드로 응답을 생성할 수 있습니다.

    Attributes:
        model (Llama): llama-cpp-python 모델 인스턴스
        model_path (str): 모델 파일 경로 (Docker 볼륨 마운트 경로)
    """

    def __init__(self):
        """
        LLMEngine 초기화

        Note:
            - 초기화 시점에는 모델을 로드하지 않음
            - load_model()을 명시적으로 호출해야 함
        """
        self.model = None
        # Docker 볼륨에 마운트된 모델 파일 경로
        self.model_path = "/ai_models/llm/llama-3-Korean-Bllossom-8B-Q4_K_M.gguf"

    def load_model(self):
        """
        모델을 GPU 메모리에 로드

        서버 시작 시 1번만 호출됩니다. (main.py의 lifespan 이벤트)
        GPU 레이어를 최대한 활용하여 추론 속도를 향상시킵니다.

        Raises:
            Exception: 모델 로딩 실패 시

        Note:
            - n_gpu_layers=-1: 모든 레이어를 GPU에 로드
            - n_ctx=8192: 최대 컨텍스트 길이 (토큰 수)
            - verbose=True: 디버깅 로그 출력
            - 이미 로드된 경우 재로딩하지 않음
        """
        if self.model is None:
            print(f"🚀 [LLMEngine] 모델 로딩 시작: {self.model_path}")

            # VRAM 정리 (이전 모델 잔여물 제거)
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
                    import gc
                    gc.collect()
                    print("✅ [LLMEngine] VRAM 캐시 정리 완료")
            except Exception as e:
                print(f"⚠️ [LLMEngine] VRAM 정리 중 오류 (무시): {e}")

            try:
                self.model = Llama(
                    model_path=self.model_path,
                    n_gpu_layers=-1,  # GPU 레이어 전체 할당 (VRAM에 모두 로드)
                    n_ctx=8192,       # 문맥 길이 (길게 설정하면 긴 대화 처리 가능)
                    verbose=True      # 디버깅용 로그 켜기
                )
                print("✅ [LLMEngine] 모델 로딩 성공!")
            except Exception as e:
                print(f"❌ [LLMEngine] 로딩 실패: {e}")
                self.model = None  # 명시적으로 None 설정
                raise e  # 모델 로딩 실패 시 서버 시작을 중단해야 함
        else:
            print("⚡ [LLMEngine] 이미 로드되어 있습니다.")

    def unload_model(self):
        """
        모델을 VRAM에서 언로드하여 메모리 해제

        이미지 생성 등 다른 GPU 작업을 위해 VRAM을 확보할 때 사용합니다.
        """
        if self.model is not None:
            print("🔄 [LLMEngine] 모델 언로드 중...")
            del self.model
            self.model = None

            # 가비지 컬렉션 및 VRAM 캐시 정리
            try:
                import gc
                gc.collect()  # Python 객체 정리

                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    torch.cuda.synchronize()
                    print("✅ [LLMEngine] VRAM 캐시 정리 완료")
            except Exception as e:
                print(f"⚠️ [LLMEngine] VRAM 정리 중 오류: {e}")

            print("✅ [LLMEngine] 모델 언로드 완료")
        else:
            print("⚠️ [LLMEngine] 언로드할 모델이 없습니다.")

    def is_loaded(self) -> bool:
        """모델 로드 상태 확인"""
        return self.model is not None

    def ensure_loaded(self):
        """
        모델이 로드되어 있지 않으면 로드 (Thread-safe)
        이미지 생성 후 채팅 시 자동 복구를 위해 사용
        """
        with llm_lock:
            if self.model is None:
                print("🔄 [LLMEngine] 모델 자동 로드 중...")

                # VRAM 정리 및 안정화 대기
                try:
                    import gc
                    import time
                    gc.collect()

                    import torch
                    if torch.cuda.is_available():
                        torch.cuda.empty_cache()
                        torch.cuda.synchronize()
                        print("✅ [LLMEngine] VRAM 캐시 정리 완료")

                    # llama-cpp-python 버그 방지를 위한 딜레이
                    time.sleep(1.0)

                except Exception as e:
                    print(f"⚠️ [LLMEngine] VRAM 정리 중 오류 (무시): {e}")

                try:
                    self.load_model()
                except Exception as e:
                    print(f"⚠️ [LLMEngine] 자동 로드 실패: {e}")
                    print("   다음 요청 시 재시도합니다.")

    def chat(self, user_input: str) -> str:
        """
        일반 채팅 모드 (완성된 응답을 한 번에 반환)

        Args:
            user_input (str): 사용자의 질문 또는 메시지

        Returns:
            str: AI의 완성된 응답 텍스트

        Note:
            - 블로킹 방식: 전체 응답이 생성될 때까지 대기
            - 스트리밍이 필요 없는 경우 사용
            - temperature=0.7: 적절한 창의성 (0에 가까울수록 결정적)
        """
        if not self.model:
            return "시스템 에러: 모델이 준비되지 않았습니다."

        # OpenAI Chat API 형식의 메시지 구조
        messages = [
            {"role": "system", "content": "당신은 DOT 프로젝트의 유능한 AI 어시스턴트입니다. 한국어로 정확하고 친절하게 답변하세요."},
            {"role": "user", "content": user_input}
        ]

        # 채팅 완료 생성 (블로킹)
        response = self.model.create_chat_completion(
            messages=messages,
            max_tokens=1024,     # 최대 생성 토큰 수
            temperature=0.7,     # 샘플링 온도 (창의성 조절)
        )
        return response['choices'][0]['message']['content']

    def chat_stream(self, user_input: str, history: list = None):
        """
        스트리밍 채팅 모드 (토큰 단위로 실시간 생성)

        대화 히스토리를 포함하여 컨텍스트를 유지하며,
        생성되는 토큰을 실시간으로 yield합니다.

        Args:
            user_input (str): 현재 사용자의 질문
            history (list, optional): 이전 대화 기록
                형식: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, ...]

        Yields:
            str: 생성된 토큰 (문자 또는 단어 단위)

        Note:
            - 제너레이터 함수: for 루프로 토큰을 하나씩 받아야 함
            - history가 있으면 문맥을 이어서 답변 생성
            - temperature=0.7: 일관성과 창의성의 균형
            - max_tokens=2048: 긴 답변도 가능하도록 설정

        Example:
            >>> for token in llm.chat_stream("안녕하세요", history=[]):
            ...     print(token, end='', flush=True)
        """
        if self.model is None:
            yield "❌ 모델이 로드되지 않았습니다."
            return

        # 1. 기본 시스템 메시지 설정
        messages = [
            {"role": "system", "content": "당신은 DOT 프로젝트의 유능한 AI 어시스턴트입니다. 한국어로 친절하게 답변하세요."}
        ]

        # 2. 이전 대화 기록(History)이 있다면 중간에 끼워넣기
        # (웹 서버가 DB 또는 Redis에서 꺼내서 리스트로 전달함)
        if history:
            messages.extend(history)

        # 3. 현재 사용자 질문 추가
        messages.append({"role": "user", "content": user_input})

        print(f"🚀 [LLMEngine] 스트리밍 추론 시작 (총 메시지 수: {len(messages)})")

        # 4. 스트리밍 모드(stream=True)로 호출
        # 내부적으로 토큰 생성 루프를 돌면서 하나씩 yield함
        stream = self.model.create_chat_completion(
            messages=messages,
            max_tokens=2048,  # 답변 길이 제한
            temperature=0.7,
            stream=True       # ★ 핵심: 스트리밍 활성화
        )

        # 5. 한 토큰씩 껍질 까서 밖으로 던져주기 (yield)
        for chunk in stream:
            if 'choices' in chunk:
                delta = chunk['choices'][0]['delta']
                if 'content' in delta:
                    yield delta['content']

# =====================================================================
# 테스트용 실행 코드
# =====================================================================
# 실행법: docker compose exec backend python -m ai_core.llm_engine
if __name__ == "__main__":
    bot = LLMEngine()
    bot.load_model()
    print("\n💬 테스트 대화 시작 (종료: q)")
    while True:
        txt = input("User: ")
        if txt == 'q':
            break
        print(f"Bot: {bot.chat(txt)}")
