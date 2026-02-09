import time
import torch
import os
from llama_cpp import Llama
from langchain_huggingface import HuggingFaceEmbeddings

# --- 설정 ---
LLM_PATH = "/ai_models/llm/llama-3-Korean-Bllossom-8B-Q4_K_M.gguf"
# 만약 임베딩 모델을 GPU로 올리고 싶다면 device='cuda'로 변경
EMBEDDING_DEVICE = "cpu" 

def print_gpu_status(step_name):
    if torch.cuda.is_available():
        # GPU 메모리 상태 확인 (MB 단위)
        free, total = torch.cuda.mem_get_info()
        used = (total - free) / 1024**2
        total_mb = total / 1024**2
        print(f"📊 [{step_name}] VRAM 사용량: {used:.1f} MB / {total_mb:.1f} MB (남은 공간: {free/1024**2:.1f} MB)")
    else:
        print(f"🚫 [{step_name}] GPU를 찾을 수 없습니다.")

def measure_llm():
    print("\n" + "="*40)
    print("🚀 1. LLM (Llama-3) 로딩 테스트")
    print("="*40)
    
    print_gpu_status("LLM 로딩 전")
    
    start_time = time.time()
    
    # 실제 서버와 동일한 설정으로 로드
    llm = Llama(
        model_path=LLM_PATH,
        n_ctx=8192,
        n_gpu_layers=-1, # GPU에 전부 올리기
        verbose=False
    )
    
    end_time = time.time()
    
    print(f"⏱️ LLM 로딩 소요 시간: {end_time - start_time:.2f} 초")
    print_gpu_status("LLM 로딩 후")
    return llm

def measure_rag():
    print("\n" + "="*40)
    print(f"📘 2. RAG 임베딩 모델 로딩 테스트 (Device: {EMBEDDING_DEVICE})")
    print("="*40)
    
    print_gpu_status("RAG 로딩 전")
    
    start_time = time.time()
    
    # 임베딩 모델 로드
    embeddings = HuggingFaceEmbeddings(
        model_name="jhgan/ko-sbert-nli",
        model_kwargs={'device': EMBEDDING_DEVICE}
    )
    
    # 더미 데이터로 한번 실행해봐야 실제 메모리가 잡힘
    embeddings.embed_query("테스트 문장입니다.")
    
    end_time = time.time()
    
    print(f"⏱️ RAG 모델 로딩+웜업 시간: {end_time - start_time:.2f} 초")
    print_gpu_status("RAG 로딩 후")

if __name__ == "__main__":
    print("🔍 시스템 자원 측정 시작...")
    
    # 1. LLM 먼저 로드 (가장 큼)
    llm_instance = measure_llm()
    
    # 2. 그 상태에서 RAG 로드 (남은 공간에 들어가는지 확인)
    measure_rag()
    
    print("\n✅ 테스트 완료.")