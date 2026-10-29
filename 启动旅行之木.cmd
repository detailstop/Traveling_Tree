@echo off
rem 旅行之木 launcher: resolve project root from this script; no drive/user paths.
setlocal
cd /d "%~dp0"

where pythonw.exe >nul 2>nul
if not errorlevel 1 (
  start "" pythonw.exe "%~dp0main.py"
  exit /b 0
)

where python.exe >nul 2>nul
if not errorlevel 1 (
  echo pythonw.exe not found; falling back to python.exe.
  start "" python.exe "%~dp0main.py"
  exit /b 0
)

echo Python not found. Install Python 3 and add python.exe / pythonw.exe to PATH.
pause
exit /b 1
