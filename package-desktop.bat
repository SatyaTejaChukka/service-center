@echo off
setlocal enabledelayedexpansion
title Pushpa Raj Automotive Services - Desktop .EXE Compiler
echo ===================================================================
echo   Pushpa Raj Automotive Services - Standalone Desktop Builder
echo ===================================================================
echo.

cd /d "%~dp0"

echo [Step 1/5] Building Optimized React 19 Frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo [Step 2/5] Compiling Python FastAPI Backend (Onedir Sidecar)...
cd backend
call ..\.venv\Scripts\pyinstaller.exe backend.spec --clean --noconfirm
if %errorlevel% neq 0 (
    echo [ERROR] PyInstaller compilation failed!
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo [Step 3/5] Syncing Frontend Assets to Desktop Distribution...
if exist desktop\dist rmdir /s /q desktop\dist
mkdir desktop\dist
xcopy /E /I /Y frontend\dist desktop\dist >nul

echo.
echo [Step 4/5] Packaging Electron Native Shell and Windows Installer...
cd desktop
call npx electron-builder --win nsis --x64
if %errorlevel% neq 0 (
    echo [ERROR] electron-builder failed to generate NSIS installer!
    pause
    exit /b %errorlevel%
)
cd ..

echo.
echo ===================================================================
echo   BUILD SUCCESSFUL!
echo   Standalone installer generated at:
echo   release\PushpaRaj-Workshop-Setup-1.0.0.exe
echo ===================================================================
echo.
pause
