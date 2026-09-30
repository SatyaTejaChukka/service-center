@echo off
title Pushpa Raj Automotive Services - Desktop App
cd /d "%~dp0"

if not exist "frontend\dist\index.html" (
    echo Building frontend assets for initial launch...
    cd frontend
    call npm run build
    cd ..
)

echo Starting Pushpa Raj Automotive Desktop Application...
cd desktop
call npx electron .
