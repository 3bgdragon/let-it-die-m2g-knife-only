@echo off
setlocal
cd /d "%~dp0"
echo No separate setup is required. This version uses Node.js only.
echo Starting run.bat...
call run.bat %*
exit /b %errorlevel%
