@echo off
title Pushpa Raj Automotive Services
echo ===================================================
echo   Pushpa Raj Automotive Services Management System
echo   Offline Local Workshop Server
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Local Backend API (FastAPI on 127.0.0.1:8000)...
start "PushpaRaj Backend" /min cmd /c "set PYTHONPATH=backend&& .venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000"

echo [2/3] Starting Frontend Web Interface (127.0.0.1:5173)...
start "PushpaRaj Frontend" /min cmd /c "cd frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo [3/3] Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo Opening Workshop System in browser...
start http://127.0.0.1:5173

echo.
echo Application is running!
echo Backend:  http://127.0.0.1:8000/api/v1/openapi.json
echo Frontend: http://127.0.0.1:5173
echo.
echo Press any key to exit this launcher window (services will remain running in background).
pause >nul
