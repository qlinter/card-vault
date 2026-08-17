@echo off
setlocal

cd /d "%~dp0"
title Card Vault Desktop

rem Keep npm cache and logs inside the project so dependency recovery does not
rem depend on the current Windows user's cache permissions.
set "npm_config_cache=%CD%\.npm-cache"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start the desktop app.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm is required to restore and start the desktop app.
  pause
  exit /b 1
)

rem Electron is downloaded separately from npm packages. Match the Electron
rem mirror to npmmirror when used, while preserving any user-provided setting.
if not defined ELECTRON_MIRROR call :configure_electron_mirror

echo Checking project dependencies...
if not exist "node_modules" goto install_dependencies
if not exist "node_modules\.package-lock.json" goto install_dependencies
if not exist "node_modules\electron\dist\electron.exe" goto install_dependencies

call npm.cmd ls --depth=0 >nul 2>nul
if errorlevel 1 goto install_dependencies

call :dependency_fingerprint_matches
if errorlevel 1 goto install_dependencies
goto dependencies_ready

:install_dependencies
echo Dependencies are missing or out of date. Recreating them from package-lock.json...
echo This can take several minutes. "npm warn deprecated" messages are non-fatal.
if exist "package-lock.json" (
  call npm.cmd ci --no-audit --no-fund
) else (
  call npm.cmd install --no-audit --no-fund
)
if errorlevel 1 (
  echo.
  echo Dependency update failed. Check the network or run npm ci manually.
  echo npm logs: "%npm_config_cache%\_logs"
  pause
  exit /b 1
)

call :write_dependency_fingerprint
if errorlevel 1 (
  echo.
  echo Dependencies were installed, but their verification record could not be saved.
  pause
  exit /b 1
)

:dependencies_ready
if not exist "node_modules\electron\dist\electron.exe" (
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

exit /b 0

:dependency_fingerprint_matches
node -e "const c=require('crypto'),f=require('fs'),p=require('./package.json'),scripts=p.scripts||{};const s={runtime:process.platform+'-'+process.arch+'-node'+process.versions.node.split('.')[0],dependencies:p.dependencies||{},devDependencies:p.devDependencies||{},optionalDependencies:p.optionalDependencies||{},peerDependencies:p.peerDependencies||{},overrides:p.overrides||{},installScripts:{preinstall:scripts.preinstall||'',install:scripts.install||'',postinstall:scripts.postinstall||''}};if(f.existsSync('package-lock.json')){const l=require('./package-lock.json');s.lockfileVersion=l.lockfileVersion;s.packages=Object.fromEntries(Object.entries(l.packages||{}).filter(([k])=>k));}const hash=c.createHash('sha256').update(JSON.stringify(s)).digest('hex'),marker='node_modules/.card-vault-dependencies.sha256';process.exit(f.existsSync(marker)&&f.readFileSync(marker,'utf8').trim()===hash?0:1)"
exit /b %errorlevel%

:write_dependency_fingerprint
node -e "const c=require('crypto'),f=require('fs'),p=require('./package.json'),scripts=p.scripts||{};const s={runtime:process.platform+'-'+process.arch+'-node'+process.versions.node.split('.')[0],dependencies:p.dependencies||{},devDependencies:p.devDependencies||{},optionalDependencies:p.optionalDependencies||{},peerDependencies:p.peerDependencies||{},overrides:p.overrides||{},installScripts:{preinstall:scripts.preinstall||'',install:scripts.install||'',postinstall:scripts.postinstall||''}};if(f.existsSync('package-lock.json')){const l=require('./package-lock.json');s.lockfileVersion=l.lockfileVersion;s.packages=Object.fromEntries(Object.entries(l.packages||{}).filter(([k])=>k));}const hash=c.createHash('sha256').update(JSON.stringify(s)).digest('hex');f.writeFileSync('node_modules/.card-vault-dependencies.sha256',hash+'\n')"
exit /b %errorlevel%

:configure_electron_mirror
set "card_vault_npm_registry="
for /f "delims=" %%R in ('npm.cmd config get registry 2^>nul') do set "card_vault_npm_registry=%%R"
if /i "%card_vault_npm_registry%"=="https://registry.npmmirror.com/" set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
if /i "%card_vault_npm_registry%"=="https://registry.npmmirror.com" set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
exit /b 0
