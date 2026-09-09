@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto use_python
py -3 -m venv .venv
goto install
:use_python
python -m venv .venv
:install
if errorlevel 1 goto done
".venv\Scripts\python.exe" -m pip install -r requirements.txt
:done
echo.
echo If installation succeeded, run run.bat.
pause
endlocal
