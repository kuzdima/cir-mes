@echo off
echo.
echo   ЦИР MES — Локальный запуск
echo   ================================
echo.
cd /d "%~dp0backend"
if not exist node_modules (
  echo   Установка зависимостей...
  npm install
)
echo   Запуск сервера...
echo.
echo   Откройте в браузере: http://localhost:8080
echo.
node server.js
pause
