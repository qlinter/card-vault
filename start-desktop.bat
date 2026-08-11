@echo off
setlocal

cd /d "%~dp0"
title Card Vault Desktop

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start the desktop app.
  pause
  exit /b 1
)

echo Checking project dependencies...
if not exist "node_modules" goto install_dependencies
if not exist "node_modules\.package-lock.json" goto install_dependencies

call npm.cmd ls --depth=0 >nul 2>nul
if errorlevel 1 goto install_dependencies

node -e "const fs=require('fs');const installed=fs.statSync('node_modules/.package-lock.json').mtimeMs;process.exit(['package.json','package-lock.json'].some((file)=>fs.statSync(file).mtimeMs>installed)?1:0)"
if errorlevel 1 goto install_dependencies
goto dependencies_ready

:install_dependencies
echo Dependencies are missing or out of date. Updating them now...
call npm.cmd install
if errorlevel 1 (
  echo.
  echo Dependency update failed. Check the network or run npm install manually.
  pause
  exit /b 1
)

:dependencies_ready
if not exist "node_modules\electron" (
  echo Electron is still unavailable after the dependency check.
  pause
  exit /b 1
)

call npm.cmd run electron
if errorlevel 1 (
  echo Desktop app failed to start.
  pause
  exit /b 1
)
