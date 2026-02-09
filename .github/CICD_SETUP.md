# Ai DOT CI/CD 설정 가이드

## 개요

이 프로젝트는 GitHub Actions를 사용한 2서버 분산 CI/CD 파이프라인을 제공합니다.

## 서버 구성

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                        │
│                   (Build & Deploy)                       │
└────────────────┬────────────────────────┬───────────────┘
                 │                        │
                 ▼                        ▼
┌────────────────────────────┐  ┌────────────────────────────┐
│      Main Server           │  │     Worker Server          │
│                            │  │                            │
│  ❍ MySQL DB               │  │  ❍ Celery Worker          │
│  ❍ Redis                  │◄─┤  ❍ GPU (AI 처리)          │
│  ❍ Backend (FastAPI)      │  │                            │
│  ❍ Frontend (Vite)        │  │  (Main Server DB/Redis     │
│                            │  │   연결)                    │
│  docker-compose-master.yml │  │  docker-compose-worker.yml │
└────────────────────────────┘  └────────────────────────────┘
```

---

## 파이프라인 구성

### 1. CI Pipeline (`ci.yml`)
- **트리거**: `main`, `develop` 브랜치 push 및 PR
- **작업**:
  - Frontend: ESLint 검사, 빌드
  - Backend: flake8 검사, 문법 검증
  - Docker: 이미지 빌드 테스트

### 2. CD Pipeline (`cd.yml`)
- **트리거**: `main` 브랜치 push 또는 수동 실행
- **배포 대상 선택**:
  - `all`: 모든 서버 배포 (기본)
  - `main`: Main 서버만 배포
  - `worker`: Worker 서버만 배포

### 3. PR Check (`pr-check.yml`)
- **트리거**: PR 생성/업데이트
- **작업**: 코드 품질 검사, 보안 스캔

---

## GitHub Secrets 설정

Repository Settings > Secrets and variables > Actions에서 설정:

### Main Server

| Secret 이름 | 설명 | 예시 |
|------------|------|------|
| `MAIN_SSH_HOST` | Main 서버 IP | `192.168.1.100` |
| `MAIN_SSH_USERNAME` | SSH 사용자명 | `ubuntu` |
| `MAIN_SSH_KEY` | SSH 개인키 | `-----BEGIN OPENSSH...` |
| `MAIN_SSH_PORT` | SSH 포트 (선택) | `22` |
| `MAIN_DEPLOY_PATH` | 프로젝트 경로 | `/home/ubuntu/DOT-Project` |
| `MAIN_URL` | 서비스 URL | `http://192.168.1.100:5173` |

### Worker Server

| Secret 이름 | 설명 | 예시 |
|------------|------|------|
| `WORKER_SSH_HOST` | Worker 서버 IP | `192.168.1.101` |
| `WORKER_SSH_USERNAME` | SSH 사용자명 | `ubuntu` |
| `WORKER_SSH_KEY` | SSH 개인키 | `-----BEGIN OPENSSH...` |
| `WORKER_SSH_PORT` | SSH 포트 (선택) | `22` |
| `WORKER_DEPLOY_PATH` | 프로젝트 경로 | `/home/ubuntu/DOT-Project` |

---

## 환경별 .env 파일 설정

### Main Server (.env)
```env
# Database
DB_NAME=dot_db
DB_USER=root
DB_PASSWORD=your_password
WORKER_DB_USER=dot_user
WORKER_DB_PASSWORD=your_password

# Redis
REDIS_DB=0

# Frontend
VITE_API_URL=http://192.168.1.100:8000

# Upload Path
UPLOAD_PATH=/home/ubuntu/DOT-Project/uploads
```

### Worker Server (.env)
```env
# Main Server 연결 정보
MASTER_IP=192.168.1.100

# Database (Main Server 연결)
DB_NAME=dot_db
WORKER_DB_USER=dot_user
WORKER_DB_PASSWORD=your_password

# Redis (Main Server 연결)
REDIS_DB=0

# SMB 공유 폴더 (Main Server 업로드 폴더 접근)
SMB_USERNAME=your_username
SMB_PASSWORD=your_password
SMB_SHARE=uploads
```

---

## 배포 방법

### 자동 배포 (모든 서버)
```bash
git push origin main
```

### 수동 배포 (특정 서버)
1. GitHub Repository > Actions 탭
2. "CD Pipeline" 워크플로우 선택
3. "Run workflow" 클릭
4. **deploy_target** 선택:
   - `all` - 모든 서버 (기본)
   - `main` - Main 서버만
   - `worker` - Worker 서버만
5. "Run workflow" 실행

### 배포 순서
```
1. Build (Docker 이미지 빌드 & 푸시)
           ↓
2. Deploy Main (DB, Redis 먼저 준비)
           ↓
3. Deploy Worker (Main 완료 후 실행 - DB/Redis 의존성)
           ↓
4. Summary / Rollback (필요시)
```

---

## SSH 키 설정

```bash
# 1. 로컬에서 SSH 키 생성
ssh-keygen -t ed25519 -C "github-actions-deploy"

# 2. 공개키를 각 서버에 등록
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@main-server
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@worker-server

# 3. 개인키를 GitHub Secret에 등록
cat ~/.ssh/id_ed25519
# 출력된 내용을 MAIN_SSH_KEY, WORKER_SSH_KEY에 등록
```

---

## Main Server 사전 설정

### MySQL 외부 접속 허용
```bash
# MySQL 접속
mysql -u root -p

# Worker 서버 접속용 사용자 생성
CREATE USER 'dot_user'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON dot_db.* TO 'dot_user'@'%';
FLUSH PRIVILEGES;
```

### 방화벽 설정
```bash
# MySQL, Redis 포트 개방
sudo ufw allow 3306
sudo ufw allow 6379
sudo ufw allow 8000
sudo ufw allow 5173
```

### SMB 공유 폴더 설정 (선택)
```bash
# Samba 설치
sudo apt install samba

# 공유 폴더 설정
sudo nano /etc/samba/smb.conf

# 추가:
[uploads]
   path = /home/ubuntu/DOT-Project/uploads
   browseable = yes
   read only = no
   guest ok = no

# Samba 사용자 추가
sudo smbpasswd -a ubuntu

# 서비스 재시작
sudo systemctl restart smbd
```

---

## Worker Server 사전 설정

### NVIDIA Docker 런타임
```bash
# NVIDIA Container Toolkit 설치
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt update
sudo apt install -y nvidia-docker2
sudo systemctl restart docker

# 테스트
docker run --rm --gpus all nvidia/cuda:12.1-base nvidia-smi
```

### CIFS 유틸 설치 (SMB 마운트용)
```bash
sudo apt install cifs-utils
```

---

## 트러블슈팅

### Worker가 Main DB에 연결 실패
```bash
# Main 서버에서 MySQL 바인드 주소 확인
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
# bind-address = 0.0.0.0 으로 변경

sudo systemctl restart mysql
```

### SMB 마운트 실패
```bash
# Worker 서버에서 연결 테스트
smbclient //MAIN_IP/uploads -U username

# 수동 마운트 테스트
sudo mount -t cifs //MAIN_IP/uploads /mnt/test -o username=user,password=pass
```

### Docker 권한 오류
```bash
# 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
# 재로그인 필요
```

---

## GitHub Environments 설정

Settings > Environments에서 생성:

### 1. main-server
- Secrets: `MAIN_*` 관련

### 2. worker-server
- Secrets: `WORKER_*` 관련

---

## 워크플로우 상태 배지

README.md에 추가:
```markdown
![CI](https://github.com/YOUR_USERNAME/DOT-Project/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/YOUR_USERNAME/DOT-Project/actions/workflows/cd.yml/badge.svg)
```

---

## 문서 이력

| 버전 | 변경일 | 변경 내용 |
|------|--------|----------|
| 1.0 | 2026-01-23 | 최초 작성 |
| 1.1 | 2026-01-23 | 3서버 분산 배포 구성 |
| 1.2 | 2026-01-23 | 2서버 구성으로 간소화 (Main + Worker) |