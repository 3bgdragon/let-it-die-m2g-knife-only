@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 goto missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto missing
node tool.js %*
set "m2g_exit=%errorlevel%"
goto done
:missing
echo Node.js 22 or newer is required. Install Node.js LTS from https://nodejs.org/
echo Python, pip and npm install are NOT required.
set "m2g_exit=1"
:done
echo.
pause
exit /b %m2g_exit%
