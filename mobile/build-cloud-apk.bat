@echo off
title Vedotrix Pulse - Free Cloud Android APK Generator
cls
echo ==============================================================================
echo        VEDOTRIX PULSE - NATIVE ANDROID APK GENERATOR (FREE CLOUD BUILD)
echo                  Designed ^& Managed by Vedotrix Technologies
echo ==============================================================================
echo.
echo [*] Connected Live Supabase: https://cqevzpvyqvckvenutuzz.supabase.co
echo [*] Features: GPS Smart Punch, Bcrypt Auth, Hierarchy Access Requests
echo.
echo ------------------------------------------------------------------------------
echo STEP 1: Checking Expo EAS Cloud Login Status...
echo ------------------------------------------------------------------------------
cd /d "%~dp0"

call npx.cmd eas whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] You are not currently logged in to Expo.
    echo [*] If you do not have a free Expo account, sign up at: https://expo.dev/signup
    echo [*] Logging in now (please enter your Expo username/email and password):
    echo.
    call npx.cmd eas login
    if %errorlevel% neq 0 (
        echo [x] Login cancelled or failed. Please retry.
        pause
        exit /b 1
    )
)

echo.
echo [v] Expo account connected!
echo.
echo ------------------------------------------------------------------------------
echo STEP 2: Starting Free Cloud Android APK Compilation...
echo ------------------------------------------------------------------------------
echo [*] Expo will build your native .apk on remote build servers.
echo [*] When asked "Would you like to automatically create an EAS project?", press Enter (Y).
echo [*] When asked "Generate a new Android Keystore?", press Enter (Y).
echo.
call npx.cmd eas build -p android --profile preview

echo.
echo ==============================================================================
echo [*] Compilation finished! Copy the .apk download link from above.
echo [*] You can share this direct link or .apk file with your clients!
echo ==============================================================================
pause
