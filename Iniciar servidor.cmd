@echo off
setlocal
cd /d "%~dp0"
if not exist "runtime\FXServer.exe" (
  echo Falta runtime\FXServer.exe
  pause
  exit /b 1
)
if not exist "servidor\licencia.cfg" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Configurar licencia.ps1"
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
cd servidor
"..\runtime\FXServer.exe" +set sv_lan true +exec lan.cfg
pause
