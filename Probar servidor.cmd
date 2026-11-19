@echo off
setlocal
pushd "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
    echo Instala Node.js 20 o posterior y vuelve a ejecutar esta prueba.
    popd
    exit /b 1
)
node --test pruebas\duo.test.cjs
set "duo_exit=%errorlevel%"
popd
exit /b %duo_exit%
