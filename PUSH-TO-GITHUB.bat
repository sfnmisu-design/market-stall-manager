@echo off
title Push to GitHub
color 0A
cls

:: Force the working directory to be the same folder as this bat file
cd /d "%~dp0"

echo.
echo  Working folder: %~dp0
echo.
echo  Looking for TOKEN.txt in this folder...
echo.

:: List files so user can see what's there
dir /b "*.txt" 2>nul
echo.

:: Check TOKEN.txt exists
:checkfile
if not exist "TOKEN.txt" (
    echo  [!] TOKEN.txt not found in: %~dp0
    echo.
    echo  Please save TOKEN.txt in the SAME folder as this bat file.
    echo  The folder is shown above - copy that path.
    echo.
    echo  Steps:
    echo   1. Open Notepad
    echo   2. Paste your GitHub token
    echo   3. File ^> Save As
    echo   4. Paste this path in the address bar: %~dp0
    echo   5. Filename: TOKEN.txt
    echo   6. Save
    echo   7. Press any key here
    echo.
    pause >nul
    goto checkfile
)

echo  [+] Found TOKEN.txt!
echo.

:: Read token - strip spaces and newlines
set "GH_TOKEN="
for /f "usebackq delims=" %%A in ("TOKEN.txt") do (
    if "!GH_TOKEN!"=="" set "GH_TOKEN=%%A"
)

:: If delayed expansion not available, use simpler method
if "%GH_TOKEN%"=="" (
    set /p GH_TOKEN=<TOKEN.txt
)

:: Strip any trailing spaces or carriage returns
for /f "tokens=* delims= " %%A in ("%GH_TOKEN%") do set GH_TOKEN=%%A

echo  [+] Token loaded successfully.
echo.

:: Delete immediately for security
del "TOKEN.txt" >nul 2>&1
echo  [+] TOKEN.txt deleted.
echo.

:: Get username
:getuser
set /p GH_USER="  Your GitHub username: "
if "%GH_USER%"=="" goto getuser
echo.

:: Repo check
echo  Make sure you have created a repo called market-stall-manager
echo  on GitHub. Press any key to open github.com/new if needed.
echo  Otherwise just press any key to continue.
pause >nul
start "" "https://github.com/new"
echo.
echo  Come back here once the repo exists and press any key...
pause >nul

:: Git config
echo  [*] Configuring Git...
git config --global user.name "%GH_USER%"
git config --global user.email "%GH_USER%@users.noreply.github.com"
git config --global init.defaultBranch main
git config --global credential.helper store

:: Write credentials
(echo https://%GH_USER%:%GH_TOKEN%@github.com)>"%USERPROFILE%\.git-credentials"

:: Clean old git
if exist ".git" (
    echo  [*] Removing old git folder...
    rd /s /q ".git"
)

:: Push
echo  [*] Initialising repository...
git init
git add .
git commit -m "Initial commit - Market Stall Manager"
git branch -M main

echo  [*] Connecting to GitHub...
git remote add origin https://%GH_USER%:%GH_TOKEN%@github.com/%GH_USER%/market-stall-manager.git

echo  [*] Pushing to GitHub... (30-60 seconds)
git push -u origin main

if %errorLevel% neq 0 (
    echo.
    echo  [!] Push failed. Check:
    echo      - GitHub username is correct
    echo      - Repo exists at github.com/%GH_USER%/market-stall-manager
    echo      - Token had full repo permission
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo   SUCCESS! Code is now on GitHub.
echo  ============================================================
echo.
echo  Opening your next steps guide...
start "" "%~dp0NEXT-STEPS.html"
pause
