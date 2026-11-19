@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar remoto.ps1" %*
set "resultado=%ERRORLEVEL%"
pause
exit /b %resultado%
