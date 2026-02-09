@echo off
chcp 65001 > nul
cls
setlocal EnableDelayedExpansion

echo ========================================================
echo        DOT System - Pre-Installation
echo        (Run as Administrator)
echo ========================================================
echo.

:: Check admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator privileges required.
    echo         Right-click and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

:: Get current directory
set "INSTALLER_DIR=%~dp0"

echo [1/5] Checking system status...
echo.

:: Check NVIDIA driver (registry check - works before reboot)
reg query "HKLM\SOFTWARE\NVIDIA Corporation\Global" >nul 2>&1
if %errorLevel% equ 0 (
    echo    [OK] NVIDIA driver is installed.
    set NVIDIA_INSTALLED=1
) else (
    echo    [  ] NVIDIA driver is not installed.
    set NVIDIA_INSTALLED=0
)

:: Check WSL
wsl --status >nul 2>&1
if %errorLevel% equ 0 (
    echo    [OK] WSL is installed.
    set WSL_INSTALLED=1
) else (
    echo    [  ] WSL is not installed or needs update.
    set WSL_INSTALLED=0
)

:: Check Docker
where docker >nul 2>&1
if %errorLevel% equ 0 (
    echo    [OK] Docker is installed.
    set DOCKER_INSTALLED=1
) else (
    echo    [  ] Docker is not installed.
    set DOCKER_INSTALLED=0
)

echo.

if %NVIDIA_INSTALLED%==1 if %WSL_INSTALLED%==1 if %DOCKER_INSTALLED%==1 (
    echo    All required software is already installed!
    echo.
    echo    You can now run install.bat
    echo.
    pause
    exit /b 0
)

echo ========================================================
echo        Installation Plan
echo ========================================================
echo.
if %NVIDIA_INSTALLED%==0 (
    echo    [1] NVIDIA Driver
)
if %WSL_INSTALLED%==0 (
    echo    [2] WSL2 (Windows Subsystem for Linux)
)
if %DOCKER_INSTALLED%==0 (
    echo    [3] Docker Desktop
)
echo.

set /p PROCEED="Proceed with installation? [Y/n]: "
if /i "%PROCEED%"=="n" (
    echo Installation cancelled.
    pause
    exit /b 0
)

:: ==========================================
:: Install NVIDIA Driver (if needed)
:: ==========================================
if %NVIDIA_INSTALLED%==0 (
    echo.
    echo [2/5] Installing NVIDIA Driver...
    echo.

    if not exist "%INSTALLER_DIR%prerequisites\NVIDIADriver.exe" (
        echo [ERROR] NVIDIADriver.exe not found!
        pause
        exit /b 1
    )

    echo       Starting NVIDIA installer...
    echo       [!] Select "Custom Installation"
    echo       [!] Uncheck "GeForce Experience"
    echo.

    start /wait "" "%INSTALLER_DIR%prerequisites\NVIDIADriver.exe"

    echo    [OK] NVIDIA Driver installation initiated.
    set NEED_REBOOT=1
) else (
    echo.
    echo [2/5] NVIDIA Driver - Already installed (skipped)
)

:: ==========================================
:: Install WSL2 + Ubuntu (if needed)
:: ==========================================
if %WSL_INSTALLED%==0 (
    echo.
    echo [3/5] Installing WSL2 + Ubuntu...
    echo.

    :: Enable WSL feature
    echo       Enabling WSL feature...
    dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart >nul 2>&1
    dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart >nul 2>&1

    :: Install WSL2 package
    if exist "%INSTALLER_DIR%prerequisites\Microsoft.WSL_2.6.3.0_x64_ARM64.msixbundle" (
        echo       Installing WSL2...
        powershell -Command "Add-AppxPackage '%INSTALLER_DIR%prerequisites\Microsoft.WSL_2.6.3.0_x64_ARM64.msixbundle'" >nul 2>&1
        echo    [OK] WSL2 installed.
    ) else (
        echo [ERROR] Microsoft.WSL msixbundle not found!
        pause
        exit /b 1
    )

    :: Install Ubuntu
    if exist "%INSTALLER_DIR%prerequisites\Ubuntu2404-240425.AppxBundle" (
        echo       Installing Ubuntu 24.04...
        powershell -Command "Add-AppxPackage '%INSTALLER_DIR%prerequisites\Ubuntu2404-240425.AppxBundle'" >nul 2>&1
        echo    [OK] Ubuntu 24.04 installed.
    ) else (
        echo [ERROR] Ubuntu AppxBundle not found!
        pause
        exit /b 1
    )

    :: Set WSL2 as default
    wsl --set-default-version 2 >nul 2>&1

    set NEED_REBOOT=1
) else (
    echo.
    echo [3/5] WSL2 - Already installed (skipped)
)

:: ==========================================
:: Install Docker Desktop (if needed)
:: ==========================================
if %DOCKER_INSTALLED%==0 (
    echo.
    echo [4/5] Installing Docker Desktop...
    echo.

    if not exist "%INSTALLER_DIR%prerequisites\DockerDesktopInstaller.exe" (
        echo [ERROR] DockerDesktopInstaller.exe not found!
        pause
        exit /b 1
    )

    echo       Installing Docker Desktop (silent mode)...
    "%INSTALLER_DIR%prerequisites\DockerDesktopInstaller.exe" install --quiet --accept-license

    if %errorLevel% equ 0 (
        echo    [OK] Docker Desktop installed.
    ) else (
        echo    [!] Installation may need manual completion.
    )
    set NEED_REBOOT=1
) else (
    echo.
    echo [4/5] Docker Desktop - Already installed (skipped)
)

:: ==========================================
:: Complete
:: ==========================================
echo.
echo [5/5] Installation Summary
echo.
echo ========================================================
echo        Pre-Installation Complete
echo ========================================================
echo.

if defined NEED_REBOOT (
    echo [!] Please REBOOT your computer.
    echo.
    echo After reboot:
    echo   1. Start Docker Desktop
    echo   2. Click "Skip" on login screen (no account needed)
    echo   3. Wait for Docker to fully start
    echo   4. Run install.bat
    echo.
    set /p DO_REBOOT="Reboot now? [Y/n]: "
    if /i not "!DO_REBOOT!"=="n" (
        shutdown /r /t 10 /c "Rebooting for DOT System installation..."
        echo Rebooting in 10 seconds...
    )
) else (
    echo Next steps:
    echo   1. Start Docker Desktop
    echo   2. Click "Skip" on login screen
    echo   3. Wait for Docker to fully start
    echo   4. Run install.bat
    echo.
)

pause
