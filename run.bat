@echo off
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
chcp 65001 >nul
if exist ".venv\Scripts\python.exe" goto use_venv
where py >nul 2>nul
if errorlevel 1 goto use_python
py -3 -c "import lzokay" >nul 2>nul
if errorlevel 1 goto missing
py -3 tool.py %*
goto done
:use_python
python -c "import lzokay" >nul 2>nul
if errorlevel 1 goto missing
python tool.py %*
goto done
:use_venv
".venv\Scripts\python.exe" -c "import lzokay" >nul 2>nul
if errorlevel 1 goto missing
".venv\Scripts\python.exe" tool.py %*
goto done
:missing
echo Python 3.10+ and lzokay are required.
echo Install Python, then run setup.bat.
:done
echo.
pause
endlocal
