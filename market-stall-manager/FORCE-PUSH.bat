@echo off
title Force Push to GitHub
color 0A
cd /d "%~dp0"
cls

echo.
echo  ============================================================
echo   FORCE PUSH FIX
echo  ============================================================
echo.

:: Get GitHub username
for /f "tokens=*" %%i in ('gh api user --jq .login 2^>nul') do set GH_USER=%%i
if "%GH_USER%"=="" (
    echo  [*] Logging in to GitHub...
    gh auth login --hostname github.com --git-protocol https --web
    for /f "tokens=*" %%i in ('gh api user --jq .login') do set GH_USER=%%i
)
echo  [+] Logged in as: %GH_USER%
echo.

:: Delete the existing repo on GitHub completely
echo  [*] Deleting old GitHub repo...
gh repo delete %GH_USER%/market-stall-manager --yes 2>nul
echo  [+] Old repo deleted.
echo.

:: Clean local git
echo  [*] Cleaning local git...
if exist ".git" rd /s /q ".git"
echo  [+] Done.
echo.

:: Fresh init
echo  [*] Creating fresh local repository...
git init
git add .
git commit -m "Market Stall Manager - full app"
git branch -M main
echo  [+] Done.
echo.

:: Create brand new repo on GitHub and push
echo  [*] Creating new GitHub repo and pushing...
gh repo create market-stall-manager --public --source=. --remote=origin --push

if %errorLevel% neq 0 (
    echo.
    echo  [!] Failed. Please take a screenshot of this window
    echo      and share it so we can fix it.
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo   SUCCESS! All files are now on GitHub.
echo  ============================================================
echo.
echo  Repo: https://github.com/%GH_USER%/market-stall-manager
echo.
start "" "https://github.com/%GH_USER%/market-stall-manager"
start "" "%~dp0NEXT-STEPS.html"
pause
