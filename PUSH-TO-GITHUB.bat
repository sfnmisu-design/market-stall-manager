@echo off
title Push to GitHub
color 0A
cd /d "%~dp0"
cls

echo.
echo  ============================================================
echo   PUSH TO GITHUB - Using GitHub CLI (easiest method)
echo  ============================================================
echo.
echo  This uses GitHub's official tool - no tokens or passwords.
echo  It opens a browser where you just click to approve.
echo.
pause

:: ── INSTALL GITHUB CLI ───────────────────────────────────────────────────────
echo.
echo  [*] Installing GitHub CLI (official GitHub tool)...
winget install --id GitHub.cli --silent --accept-package-agreements --accept-source-agreements
if %errorLevel% neq 0 (
    echo  [!] Auto-install failed. Downloading manually...
    start "" "https://cli.github.com/"
    echo.
    echo  Download and install GitHub CLI from that page.
    echo  Then press any key to continue.
    pause >nul
)

:: Refresh PATH
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\GitHub CLI;%ProgramFiles%\GitHub CLI"

echo.
echo  [+] GitHub CLI ready.

:: ── LOGIN ────────────────────────────────────────────────────────────────────
echo.
echo  ============================================================
echo  [*] Logging in to GitHub...
echo.
echo  A browser window will open.
echo  Just click "Authorize GitHub CLI" and you are done.
echo  ============================================================
echo.
pause

gh auth login --hostname github.com --git-protocol https --web

if %errorLevel% neq 0 (
    echo  [!] Login failed. Please try again.
    pause & exit /b 1
)

echo.
echo  [+] Logged in to GitHub successfully!

:: ── GET USERNAME ─────────────────────────────────────────────────────────────
for /f "tokens=*" %%i in ('gh api user --jq .login') do set GH_USER=%%i
echo  [+] GitHub username: %GH_USER%

:: ── CREATE REPO ──────────────────────────────────────────────────────────────
echo.
echo  [*] Creating GitHub repository...
gh repo create market-stall-manager --public --source=. --remote=origin --push

if %errorLevel% equ 0 (
    echo.
    echo  ============================================================
    echo   SUCCESS! Code is on GitHub!
    echo  ============================================================
    echo.
    echo  Your repo: https://github.com/%GH_USER%/market-stall-manager
    echo.
    echo  Opening your next steps guide...
    start "" "https://github.com/%GH_USER%/market-stall-manager"
    start "" "%~dp0NEXT-STEPS.html"
    pause
    exit /b 0
)

:: ── IF REPO ALREADY EXISTS, JUST PUSH ────────────────────────────────────────
echo.
echo  [*] Repo may already exist. Trying to push directly...

if exist ".git" rd /s /q ".git"
git init
git add .
git commit -m "Initial commit - Market Stall Manager"
git branch -M main
git remote add origin https://github.com/%GH_USER%/market-stall-manager.git
git push -u origin main

if %errorLevel% neq 0 (
    echo.
    echo  [!] Push failed.
    echo      Go to github.com/new and create a repo called:
    echo      market-stall-manager
    echo      Then run this script again.
    pause & exit /b 1
)

echo.
echo  ============================================================
echo   SUCCESS! Code is on GitHub!
echo  ============================================================
echo.
start "" "%~dp0NEXT-STEPS.html"
pause
