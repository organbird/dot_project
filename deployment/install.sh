#!/bin/bash
# ===========================================
# DOT 시스템 설치 스크립트
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "   DOT 시스템 설치 프로그램 v1.0"
echo "=========================================="
echo ""

# 사전 요구사항 확인
check_requirements() {
    echo "[1/5] 시스템 요구사항 확인 중..."

    if ! command -v docker &> /dev/null; then
        echo "❌ Docker가 설치되어 있지 않습니다."
        echo "   먼저 Docker를 설치해주세요."
        exit 1
    fi

    if ! command -v docker compose &> /dev/null; then
        echo "❌ Docker Compose가 설치되어 있지 않습니다."
        exit 1
    fi

    if ! nvidia-smi &> /dev/null; then
        echo "⚠️  NVIDIA 드라이버가 감지되지 않습니다."
        echo "   GPU 기능이 제한될 수 있습니다."
        read -p "계속 진행하시겠습니까? [y/N]: " proceed
        if [[ ! "$proceed" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    echo "✅ 시스템 요구사항 확인 완료"
}

# 설치 유형 선택
select_install_type() {
    echo ""
    echo "[2/5] 설치 유형을 선택하세요:"
    echo ""
    echo "  1) Master 서버 (PC1)"
    echo "     - DB, Redis, Backend, Frontend, LLM"
    echo ""
    echo "  2) Worker 서버 (PC2)"
    echo "     - Celery Worker, ComfyUI"
    echo "     - 이미지 생성, STT, RAG 임베딩"
    echo ""
    read -p "선택 [1/2]: " INSTALL_TYPE

    case $INSTALL_TYPE in
        1) ROLE="master" ;;
        2) ROLE="worker" ;;
        *) echo "❌ 잘못된 선택입니다."; exit 1 ;;
    esac
}

# IP 설정
configure_network() {
    echo ""
    echo "[3/5] 네트워크 설정"

    # 현재 IP 자동 감지
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    echo "   감지된 IP: $LOCAL_IP"

    if [[ "$ROLE" == "master" ]]; then
        read -p "   이 PC의 IP 주소 [$LOCAL_IP]: " INPUT_IP
        MASTER_IP="${INPUT_IP:-$LOCAL_IP}"
    else
        read -p "   Master 서버의 IP 주소: " MASTER_IP
        if [[ -z "$MASTER_IP" ]]; then
            echo "❌ Master IP는 필수입니다."
            exit 1
        fi
    fi

    echo "✅ Master IP: $MASTER_IP"
}

# Docker 이미지 로드
load_images() {
    echo ""
    echo "[4/5] Docker 이미지 로딩 중... (시간이 걸릴 수 있습니다)"

    if [[ "$ROLE" == "master" ]]; then
        echo "   - backend.tar 로딩..."
        docker load -i images/backend.tar
        echo "   - frontend.tar 로딩..."
        docker load -i images/frontend.tar
        echo "   - mysql.tar 로딩..."
        docker load -i images/mysql.tar
        echo "   - redis.tar 로딩..."
        docker load -i images/redis.tar
    else
        echo "   - worker.tar 로딩..."
        docker load -i images/worker.tar
        echo "   - comfyui.tar 로딩..."
        docker load -i images/comfyui.tar
    fi

    echo "✅ 이미지 로딩 완료"
}

# 환경 설정 및 서비스 시작
start_services() {
    echo ""
    echo "[5/5] 서비스 시작 중..."

    # 작업 디렉토리 생성
    INSTALL_DIR="$HOME/dot-project"
    mkdir -p "$INSTALL_DIR"

    # 설정 파일 복사
    cp config/.env.template "$INSTALL_DIR/.env"
    sed -i "s/__MASTER_IP__/$MASTER_IP/g" "$INSTALL_DIR/.env"

    # 모델 디렉토리 복사
    mkdir -p "$INSTALL_DIR/ai_models"

    if [[ "$ROLE" == "master" ]]; then
        echo "   - LLM 모델 복사 중..."
        cp -r "$SCRIPT_DIR/models/llm" "$INSTALL_DIR/ai_models/"
        cp -r "$SCRIPT_DIR/models/embedding" "$INSTALL_DIR/ai_models/"
        cp -r "$SCRIPT_DIR/models/chroma_db" "$INSTALL_DIR/ai_models/"
    else
        echo "   - Worker 모델 복사 중..."
        cp -r "$SCRIPT_DIR/models/stt" "$INSTALL_DIR/ai_models/"
        cp -r "$SCRIPT_DIR/models/image" "$INSTALL_DIR/ai_models/"
        cp -r "$SCRIPT_DIR/models/embedding" "$INSTALL_DIR/ai_models/"
    fi

    # uploads 디렉토리 생성
    mkdir -p "$INSTALL_DIR/backend/uploads"/{images,documents,meetings,chroma_db}

    cd "$INSTALL_DIR"

    if [[ "$ROLE" == "master" ]]; then
        cp "$SCRIPT_DIR/config/docker-compose-master-deploy.yml" ./docker-compose.yml
    else
        cp "$SCRIPT_DIR/config/docker-compose-worker-deploy.yml" ./docker-compose.yml
    fi

    docker compose up -d

    echo "✅ 서비스 시작 완료"
}

# 설치 완료 메시지
show_complete() {
    echo ""
    echo "=========================================="
    echo "   설치가 완료되었습니다!"
    echo "=========================================="
    echo ""

    if [[ "$ROLE" == "master" ]]; then
        echo "🌐 웹 접속: http://$MASTER_IP:5173"
        echo ""
    fi

    echo "📁 설치 경로: $INSTALL_DIR"
    echo ""
    echo "서비스 관리 명령어:"
    echo "  - 상태 확인: docker compose ps"
    echo "  - 로그 확인: docker compose logs -f"
    echo "  - 재시작:    docker compose restart"
    echo "  - 중지:      docker compose down"
    echo ""
}

# 메인 실행
check_requirements
select_install_type
configure_network
load_images
start_services
show_complete
