#!/bin/bash
# ===========================================
# DOT 시스템 업데이트 스크립트
# ===========================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$HOME/dot-project"

echo "=========================================="
echo "   DOT 시스템 업데이트"
echo "=========================================="
echo ""

# 설치 디렉토리 확인
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo "❌ 설치 디렉토리를 찾을 수 없습니다: $INSTALL_DIR"
    echo "   먼저 install.sh로 설치해주세요."
    exit 1
fi

cd "$INSTALL_DIR"

# 현재 실행 중인 서비스 확인
echo "[1/3] 서비스 중지 중..."
docker compose down 2>/dev/null || true
docker compose -f docker-compose-master.yml down 2>/dev/null || true
docker compose -f docker-compose-worker.yml down 2>/dev/null || true

# 새 이미지 로드
echo ""
echo "[2/3] 새 이미지 로딩 중..."
cd "$SCRIPT_DIR"

for tarfile in images/*.tar.gz; do
    if [[ -f "$tarfile" ]]; then
        echo "   - $(basename $tarfile) 로딩..."
        gunzip -c "$tarfile" | docker load
    fi
done

# 서비스 재시작
echo ""
echo "[3/3] 서비스 재시작 중..."
cd "$INSTALL_DIR"

if [[ -f "docker-compose.yml" ]]; then
    docker compose up -d
elif [[ -f "docker-compose-master.yml" ]]; then
    docker compose -f docker-compose-master.yml up -d
    if [[ -f "docker-compose-worker.yml" ]]; then
        sleep 5
        docker compose -f docker-compose-worker.yml up -d
    fi
fi

echo ""
echo "=========================================="
echo "   업데이트가 완료되었습니다!"
echo "=========================================="
echo ""
echo "서비스 상태 확인: docker compose ps"
echo ""
