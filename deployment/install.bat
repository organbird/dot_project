@echo off
chcp 65001 > nul
cls

echo ========================================================
echo        DOT System Installer (Windows)
echo ========================================================
echo.

:: Check Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop is not running.
    echo         Please start Docker Desktop and try again.
    echo.
    pause
    exit /b 1
)
echo [OK] Docker Desktop is running.
echo.

:: Get current directory
set "INSTALL_DIR=%~dp0"

echo ========================================================
echo        Select Installation Type
echo ========================================================
echo.
echo   1) Master Server (PC1)
echo      - DB, Redis, Backend, Frontend, LLM
echo.
echo   2) Worker Server (PC2)
echo      - Celery Worker, ComfyUI
echo      - Image generation, STT, RAG embedding
echo.
set /p INSTALL_TYPE="Select [1/2]: "

if "%INSTALL_TYPE%"=="1" set "ROLE=master"
if "%INSTALL_TYPE%"=="2" set "ROLE=worker"

if not defined ROLE (
    echo [ERROR] Invalid selection.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo        Network Configuration
echo ========================================================
echo.

:: Get local IP (exclude Docker/WSL internal IPs)
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo %%b | findstr /b "172\. 127\." >nul 2>&1
        if errorlevel 1 set "LOCAL_IP=%%b"
    )
)
if not defined LOCAL_IP set "LOCAL_IP=unknown"
echo    Detected IP: %LOCAL_IP%

if "%ROLE%"=="master" goto MASTER_IP_CONFIG
goto WORKER_IP_CONFIG

:MASTER_IP_CONFIG
set /p INPUT_IP="   This PC's IP [%LOCAL_IP%]: "
if "%INPUT_IP%"=="" set "INPUT_IP=%LOCAL_IP%"
set "MASTER_IP=%INPUT_IP%"
goto LOAD_IMAGES

:WORKER_IP_CONFIG
set /p MASTER_IP="   Master Server IP: "
if "%MASTER_IP%"=="" (
    echo [ERROR] Master IP is required.
    pause
    exit /b 1
)
goto LOAD_IMAGES

:LOAD_IMAGES
echo.
echo ========================================================
echo        Loading Docker Images (This may take a while)
echo ========================================================
echo.

if "%ROLE%"=="master" goto LOAD_MASTER
goto LOAD_WORKER

:LOAD_MASTER
echo [1/4] Loading backend.tar...
docker load -i "%INSTALL_DIR%images\backend.tar"
echo [2/4] Loading frontend.tar...
docker load -i "%INSTALL_DIR%images\frontend.tar"
echo [3/4] Loading mysql.tar...
docker load -i "%INSTALL_DIR%images\mysql.tar"
echo [4/4] Loading redis.tar...
docker load -i "%INSTALL_DIR%images\redis.tar"
goto SETUP_ENV

:LOAD_WORKER
echo [1/2] Loading worker.tar...
docker load -i "%INSTALL_DIR%images\worker.tar"
echo [2/2] Loading comfyui.tar...
docker load -i "%INSTALL_DIR%images\comfyui.tar"
goto SETUP_ENV

:SETUP_ENV
echo.
echo ========================================================
echo        Setting up Environment
echo ========================================================
echo.

:: Create work directory
set "WORK_DIR=%USERPROFILE%\dot-project"
if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"
if not exist "%WORK_DIR%\ai_models" mkdir "%WORK_DIR%\ai_models"
if not exist "%WORK_DIR%\backend\uploads\images" mkdir "%WORK_DIR%\backend\uploads\images"
if not exist "%WORK_DIR%\backend\uploads\documents" mkdir "%WORK_DIR%\backend\uploads\documents"
if not exist "%WORK_DIR%\backend\uploads\meetings" mkdir "%WORK_DIR%\backend\uploads\meetings"
if not exist "%WORK_DIR%\backend\uploads\chroma_db" mkdir "%WORK_DIR%\backend\uploads\chroma_db"

:: Copy .env file and replace MASTER_IP
copy "%INSTALL_DIR%config\.env.template" "%WORK_DIR%\.env" > nul
powershell -Command "(Get-Content '%WORK_DIR%\.env') -replace '__MASTER_IP__', '%MASTER_IP%' | Set-Content '%WORK_DIR%\.env'"

echo [OK] Environment configured.
echo.

:: Copy models
echo Copying AI models... (This may take a while)

if "%ROLE%"=="master" goto COPY_MASTER_MODELS
goto COPY_WORKER_MODELS

:COPY_MASTER_MODELS
echo    - Copying LLM models...
xcopy "%INSTALL_DIR%models\llm" "%WORK_DIR%\ai_models\llm\" /E /I /Y /Q > nul
echo    - Copying embedding models...
xcopy "%INSTALL_DIR%models\embedding" "%WORK_DIR%\ai_models\embedding\" /E /I /Y /Q > nul
echo    - Copying chroma_db...
xcopy "%INSTALL_DIR%models\chroma_db" "%WORK_DIR%\ai_models\chroma_db\" /E /I /Y /Q > nul
goto START_SERVICES

:COPY_WORKER_MODELS
echo    - Copying STT models...
xcopy "%INSTALL_DIR%models\stt" "%WORK_DIR%\ai_models\stt\" /E /I /Y /Q > nul
echo    - Copying image models...
xcopy "%INSTALL_DIR%models\image" "%WORK_DIR%\ai_models\image\" /E /I /Y /Q > nul
echo    - Copying embedding models...
xcopy "%INSTALL_DIR%models\embedding" "%WORK_DIR%\ai_models\embedding\" /E /I /Y /Q > nul
goto START_SERVICES

:START_SERVICES
echo.
echo ========================================================
echo        Starting Services
echo ========================================================
echo.

cd /d "%WORK_DIR%"

if "%ROLE%"=="master" goto START_MASTER
goto START_WORKER

:START_MASTER
copy "%INSTALL_DIR%config\docker-compose-master-deploy.yml" "%WORK_DIR%\docker-compose.yml" > nul

:: Open firewall ports for Worker connection
echo    Opening firewall ports...
netsh advfirewall firewall add rule name="DOT-MySQL" dir=in action=allow protocol=TCP localport=3306 >nul 2>&1
netsh advfirewall firewall add rule name="DOT-Redis" dir=in action=allow protocol=TCP localport=6379 >nul 2>&1
netsh advfirewall firewall add rule name="DOT-Backend" dir=in action=allow protocol=TCP localport=8000 >nul 2>&1
netsh advfirewall firewall add rule name="DOT-Frontend" dir=in action=allow protocol=TCP localport=5173 >nul 2>&1
echo    [OK] Firewall configured.

docker compose up -d
goto COMPLETE

:START_WORKER
copy "%INSTALL_DIR%config\docker-compose-worker-deploy.yml" "%WORK_DIR%\docker-compose.yml" > nul
docker compose up -d
goto COMPLETE

:COMPLETE
echo.
echo ========================================================
echo        Installation Complete!
echo ========================================================
echo.

if "%ROLE%"=="master" echo    Web Access: http://%MASTER_IP%:5173

echo.
echo    Install Path: %WORK_DIR%
echo.
echo    Service Commands:
echo      - Status:  docker compose ps
echo      - Logs:    docker compose logs -f
echo      - Restart: docker compose restart
echo      - Stop:    docker compose down
echo.
pause
