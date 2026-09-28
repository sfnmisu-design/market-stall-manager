@echo off
title Market Stall Manager - One-Click Setup
color 0A
cls

echo.
echo  ============================================================
echo    MARKET STALL MANAGER - Automatic Setup for Windows
echo    SFN TechGeek
echo  ============================================================
echo.
pause

:: ── ADMIN CHECK ──────────────────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo  [!] Right-click SETUP.bat and choose "Run as administrator"
    pause & exit /b 1
)

:: ── WINGET CHECK ─────────────────────────────────────────────────────────────
winget --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Update Windows then try again. Or download Node.js from nodejs.org
    pause & exit /b 1
)

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  STEP 1 - Installing Node.js
echo  ============================================================
node --version >nul 2>&1
if %errorLevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo  [+] Already installed: %%i
) else (
    echo  [*] Installing... (2-3 minutes, please wait)
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    set "PATH=%PATH%;%ProgramFiles%\nodejs"
    echo  [+] Node.js installed!
)

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  STEP 2 - Installing Git
echo  ============================================================
git --version >nul 2>&1
if %errorLevel% equ 0 (
    for /f "tokens=*" %%i in ('git --version') do echo  [+] Already installed: %%i
) else (
    echo  [*] Installing... (1-2 minutes, please wait)
    winget install --id Git.Git --silent --accept-package-agreements --accept-source-agreements
    set "PATH=%PATH%;%ProgramFiles%\Git\cmd"
    echo  [+] Git installed!
)

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  STEP 3 - Supabase credentials
echo  ============================================================
echo.
echo  Get these from: supabase.com ^> Your Project ^> Settings ^> API
echo.

:ask_url
set /p SUPABASE_URL="  Supabase Project URL: "
if "%SUPABASE_URL%"=="" ( echo  Cannot be empty. & goto ask_url )

:ask_key
set /p SUPABASE_KEY="  Supabase Anon Key:    "
if "%SUPABASE_KEY%"=="" ( echo  Cannot be empty. & goto ask_key )

echo REACT_APP_SUPABASE_URL=%SUPABASE_URL%> .env
echo REACT_APP_SUPABASE_ANON_KEY=%SUPABASE_KEY%>> .env
echo  [+] .env file created!

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  STEP 4 - Installing app files
echo  ============================================================
echo  [*] Running npm install... (1-2 minutes)
call npm install
if %errorLevel% neq 0 ( echo  [!] Failed. Try running as Administrator. & pause & exit /b 1 )
echo  [+] Done!

:: ════════════════════════════════════════════════════════════════════════════
echo.
echo  STEP 5 - GitHub setup
echo  ============================================================
echo.
echo  Your GitHub username:
:ask_username
set /p GH_USER="  Username: "
if "%GH_USER%"=="" ( goto ask_username )

:: ── TOKEN: Read from file instead of typing in terminal ──────────────────────
echo.
echo  ┌──────────────────────────────────────────────────────────────┐
echo  │                                                              │
echo  │   GitHub needs a token instead of a password.               │
echo  │                                                              │
echo  │   IMPORTANT - DO NOT paste the token here in this window.   │
echo  │   Instead, save it to a file. Here is how:                  │
echo  │                                                              │
echo  │   1. Your browser will open to generate a token             │
echo  │   2. Fill in Note: market-stall                             │
echo  │   3. Expiration: 90 days                                    │
echo  │   4. Tick the REPO checkbox                                 │
echo  │   5. Click Generate token                                   │
echo  │   6. COPY the ghp_ token that appears                       │
echo  │   7. Open Notepad (Start menu search Notepad)               │
echo  │   8. Paste ONLY the token into Notepad                      │
echo  │   9. Save the file as:  TOKEN.txt                           │
echo  │      inside this folder: %CD%
echo  │  10. Come back here and press any key                       │
echo  │                                                              │
echo  └──────────────────────────────────────────────────────────────┘
echo.
echo  Press any key to open GitHub token page...
pause >nul
start https://github.com/settings/tokens/new?scopes=repo^&description=market-stall

echo.
echo  Save your token to TOKEN.txt in this folder, then press any key...
pause >nul

:: Check TOKEN.txt exists and read it
:check_token_file
if not exist "TOKEN.txt" (
    echo.
    echo  [!] TOKEN.txt not found in this folder.
    echo      Please save your token to TOKEN.txt and press any key.
    pause >nul
    goto check_token_file
)

:: Read token from file — avoids all Windows paste/encoding issues
set /p GH_TOKEN=<TOKEN.txt
if "%GH_TOKEN%"=="" (
    echo  [!] TOKEN.txt is empty. Please paste your token in it and save.
    pause >nul
    goto check_token_file
)
echo  [+] Token loaded from TOKEN.txt!

:: Delete the token file immediately for security
del TOKEN.txt >nul 2>&1
echo  [+] TOKEN.txt deleted for security.

:: ── CREATE GITHUB REPO ───────────────────────────────────────────────────────
echo.
echo  [*] Opening GitHub to create your repository...
echo.
echo  On that page:
echo    - Repository name: market-stall-manager
echo    - Leave everything else as default
echo    - Click "Create repository"
echo.
start https://github.com/new
echo  Press any key once the repo is created...
pause >nul

:: ── GIT PUSH ─────────────────────────────────────────────────────────────────
echo.
echo  [*] Configuring Git...
git config --global user.name "%GH_USER%"
git config --global user.email "%GH_USER%@users.noreply.github.com"
git config --global init.defaultBranch main
git config --global credential.helper store

:: Write credentials file
echo https://%GH_USER%:%GH_TOKEN%@github.com> "%USERPROFILE%\.git-credentials"

echo  [*] Setting up repository...
if exist ".git" ( rd /s /q .git )
git init
git add .
git commit -m "Initial commit - Market Stall Manager"
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin https://%GH_USER%:%GH_TOKEN%@github.com/%GH_USER%/market-stall-manager.git

echo  [*] Pushing to GitHub...
git push -u origin main

if %errorLevel% neq 0 (
    echo.
    echo  ============================================================
    echo  [!] Push failed. Check:
    echo.
    echo   A) GitHub username is correct
    echo   B) Repository name is: market-stall-manager
    echo   C) TOKEN.txt had the correct full token
    echo.
    echo  Run the script again to retry.
    echo  ============================================================
    pause & exit /b 1
)

:: ── SUCCESS ──────────────────────────────────────────────────────────────────
echo.
echo  ============================================================
echo.
echo   ALL DONE on your computer!
echo.
echo   [+] Node.js installed
echo   [+] Git installed
echo   [+] .env file created
echo   [+] App files installed
echo   [+] Code pushed to GitHub
echo.
echo   2 steps left - opening your guide now...
echo  ============================================================
echo.
start NEXT-STEPS.html
start https://github.com/%GH_USER%/market-stall-manager
pause
