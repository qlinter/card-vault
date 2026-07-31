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

if not exist "node_modules" (
  echo node_modules was not found. Run npm install first.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo Electron is not installed yet.
  echo After dependencies are installed, run this file again.
  pause
  exit /b 1
)

call npm.cmd run electron
if errorlevel 1 (
  echo Desktop app failed to start.
  pause
  exit /b 1
)
