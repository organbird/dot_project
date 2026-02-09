"""
Celery 비동기 작업 큐 설정 모듈

이 모듈은 백그라운드에서 실행될 비동기 작업들을 관리하는
Celery 애플리케이션을 설정합니다.

주요 기능:
    - Redis를 메시지 브로커(Broker) 및 결과 백엔드(Backend)로 사용
    - 무거운 AI 작업(PDF 학습, 채팅 저장 등)을 백그라운드에서 처리
    - FastAPI 웹 서버의 응답 속도 향상 (논블로킹 처리)

사용 기술:
    - Celery: 분산 작업 큐 시스템
    - Redis: 메시지 브로커 및 작업 결과 저장소

아키텍처:
    [FastAPI 서버] → (작업 요청) → [Redis] → [Celery Worker] → [작업 실행]
                    ← (결과 조회) ←

작성일: 2025
작성자: DOT-Project Team
"""

import os
from dotenv import load_dotenv
from celery import Celery

load_dotenv() 

# 환경 변수에서 Redis 주소 가져오기 (없으면 로컬 기본값)
# 도커 내부에서는 'redis' 호스트명을 사용합니다.
# 형식: redis://호스트:포트/DB번호
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

"""
Celery 애플리케이션 인스턴스 생성

Args:
    name (str): Celery 앱의 고유 이름 ('dot_worker')
        - 여러 Celery 앱을 구분하는 식별자
        - 로그 및 모니터링에서 사용됨

    broker (str): 메시지 브로커 URL (Redis)
        - 작업 요청(Task)을 전달하는 중간 매개체
        - Producer(FastAPI)와 Consumer(Worker) 사이의 큐 역할
        - FIFO 방식으로 작업 순서 보장

    backend (str): 작업 결과 저장소 URL (Redis)
        - 작업 실행 결과(성공/실패/반환값)를 저장
        - 작업 상태 추적에 사용 (PENDING → STARTED → SUCCESS/FAILURE)
        - TTL(Time To Live) 설정 가능

    include (list): 자동으로 불러올 작업 모듈 리스트
        - worker.tasks 모듈의 @celery_app.task 데코레이터가 붙은 함수들 자동 등록
        - 여러 모듈 지정 가능: ["worker.tasks", "worker.scheduled_tasks"]
"""
celery_app = Celery(
    "dot_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["worker.tasks"]  # tasks.py를 바라보게 설정
)

"""
Celery 애플리케이션 설정

작업 직렬화, 시간대, 동시성 제어 등 Celery의 동작 방식을 세밀하게 조정합니다.
AI 작업의 특성(무거움, 오래 걸림)에 최적화된 설정입니다.

Configuration:
    task_serializer (str): 작업 메시지 직렬화 방식
        - 'json': JSON 형식 사용 (호환성 좋음, 사람이 읽기 쉬움)
        - 'pickle'보다 안전하지만 복잡한 객체 전달 불가

    result_serializer (str): 작업 결과 직렬화 방식
        - 'json': 결과도 JSON으로 저장
        - Redis에 저장되는 결과값을 사람이 직접 확인 가능

    accept_content (list): 허용할 메시지 타입
        - ['json']: JSON만 허용 (보안: pickle 역직렬화 공격 방지)

    timezone (str): 작업 시간대
        - 'Asia/Seoul': 한국 표준시 (KST, UTC+9)
        - 스케줄링 작업(Celery Beat)에서 중요

    enable_utc (bool): UTC 시간 사용 여부
        - False: timezone 설정값 사용
        - True면 모든 시간이 UTC로 기록됨

    task_track_started (bool): 작업 시작 상태 추적 여부
        - True: PENDING → STARTED → SUCCESS/FAILURE 상태 변화 추적
        - False면 PENDING → SUCCESS/FAILURE만 표시 (STARTED 생략)
        - 긴 작업의 진행 상황 모니터링에 유용

    worker_prefetch_multiplier (int): 워커가 미리 가져올 작업 개수
        - 1: 한 번에 1개만 가져옴 (무거운 작업에 권장)
        - 기본값(4)은 가벼운 작업에 적합
        - AI 모델 로딩 같은 메모리 집약 작업에서 OOM 방지

    task_acks_late (bool): 작업 완료 후 확인(Ack) 전송 여부
        - True: 작업이 성공적으로 끝난 후에만 Ack 전송
        - False: 작업을 받자마자 Ack 전송 (워커 죽으면 작업 유실)
        - True 설정 시 워커 크래시 시 작업 재시도 가능 (안정성 향상)

Note:
    - 이 설정들은 AI 작업 특성(느림, 무거움)에 최적화됨
    - 가벼운 작업이 많다면 worker_prefetch_multiplier를 높이는 것 권장
    - task_acks_late=True는 멱등성(Idempotency)이 보장되는 작업에만 사용
"""
# Celery 기본 설정
celery_app.conf.update(
    task_serializer="json",  # 작업 메시지를 JSON으로 직렬화
    result_serializer="json",  # 작업 결과를 JSON으로 직렬화
    accept_content=["json"],  # JSON 형식만 허용 (보안)
    timezone="Asia/Seoul",  # 한국 표준시 사용
    enable_utc=False,  # UTC 대신 timezone 설정 사용
    # --- 추가 권장 설정 ---
    task_track_started=True,  # 작업 시작 상태 추적 (Started 상태 확인 가능)
    worker_prefetch_multiplier=1,  # 무거운 AI 작업 시 한 번에 하나씩만 가져오도록 설정
    task_acks_late=True,  # 작업이 성공적으로 끝난 후 응답(Ack)을 보냄 (안정성)
    # --- GPU 작업 큐 라우팅 ---
    task_routes={
        "generate_image_task": {"queue": "gpu_image"},
        "transcribe_audio_task": {"queue": "gpu_stt"},
        "release_gpu_if_idle_task": {"queue": "celery"},
    },
)

# =====================================================================
# Celery Beat 스케줄 설정 (주기적 작업)
# =====================================================================
# GPU 유휴 체크: 30초마다 확인하여 미사용 GPU 모델 자동 해제
# 양쪽 큐(이미지/STT) 모두 대기 없고 타임아웃 경과 시 VRAM 해제
# =====================================================================

celery_app.conf.beat_schedule = {
    # GPU 유휴 자원 자동 해제 (배치 인식 스케줄링)
    "check-gpu-idle-release": {
        "task": "release_gpu_if_idle_task",
        "schedule": 30.0,  # 30초마다 체크
    },
}

# =====================================================================
# 큐 구조
# =====================================================================
# celery (기본): 일반 작업 (채팅 저장, RAG, GPU 유휴 체크 등)
# gpu_image: 이미지 생성 작업 (ComfyUI via GPU)
# gpu_stt: STT 음성 인식 작업 (Faster Whisper via GPU)
#
# GPU 작업은 gpu_manager.py의 배치 인식 스케줄링으로 관리됩니다.
# 같은 타입 작업은 최대 5개까지 연속 처리 후 다른 타입으로 전환합니다.
# =====================================================================