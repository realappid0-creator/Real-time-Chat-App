@echo off
title NexChat Server (Localhost)
cd /d "%~dp0"

echo ====================================================
echo        Starting NexChat Real-time Chat App
echo ====================================================
echo.

:: Check for node in PATH or fallback to playwright bundled node
set NODE_EXE=node
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    set "NODE_EXE=C:\Users\varsh\AppData\Roaming\ProjectLightningV5\resources\binaries\win\python\Lib\site-packages\playwright\driver\node.exe"
)

if not exist "%NODE_EXE%" (
    where node >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Node.js executable not found.
        echo Please ensure Node.js is installed or on your PATH.
        pause
        exit /b 1
    )
)

echo Starting server on http://localhost:5731 ...
"%NODE_EXE%" run.js
pause
