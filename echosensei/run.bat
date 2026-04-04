@echo off
title EchoSensei Launcher
echo ========================================================
echo             ECHOSENSEI — AI HEALTHCARE ENGINE
echo ========================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please install Python (3.9+) to run EchoSensei.
    pause
    exit /b
)

:: Install/Verify dependencies
echo [1/3] Verifying dependencies...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [WARNING] There was an issue installing dependencies. 
    echo Attempting to continue anyway...
)

:: Start the server in the background
echo [2/3] Starting AI Engine (Flask Server)...
start /b python server.py

:: Give the server a moment to initialize
timeout /t 3 /nobreak >nul

:: Open the browser
echo [3/3] Opening your browser to http://localhost:5000
start "" "http://localhost:5000"

echo.
echo ========================================================
echo EchoSensei is running!
echo Keep this window open while using the application.
echo To stop, close this window or press Ctrl+C.
echo ========================================================
echo.
