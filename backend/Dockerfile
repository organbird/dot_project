# 1. 베이스 이미지 (CUDA 12.1 - runtime)
# 모든 AI 라이브러리가 pre-built wheel 제공하므로 devel 불필요
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# 2. 환경 변수 설정 (한글 깨짐 방지 & 입력 대기 방지)
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8
ENV PYTHONIOENCODING=utf-8

# 3. 작업 디렉토리 설정
WORKDIR /app

# 4. 시스템 패키지 설치 (Python 3.10 내장)
# - curl, git: 라이브러리 다운로드 필수
# - libgl1: OpenCV/Pillow 의존성
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# 5. python3 -> python 심볼릭 링크
RUN ln -s /usr/bin/python3 /usr/bin/python

# 6. pip 업그레이드 (★중요: 미러 사이트 설정 삭제함)
RUN pip install --upgrade pip

# 7. [최적화] Llama-cpp-python 미리 설치 (GPU 가속용 Pre-built Wheel)
# - requirements.txt 실행 전에 미리 깔아두면, 나중에 빌드 시간을 대폭 아낄 수 있습니다.
# - CUDA 12.1에 맞는 버전을 지정해서 다운로드
RUN pip install llama-cpp-python \
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121 \
    --no-cache-dir

# 8. 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 -r requirements.txt

# 9. 소스 코드 복사
COPY . .

# 10. 서버 실행
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]