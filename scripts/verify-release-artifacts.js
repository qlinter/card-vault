const { sha256File } = require("../lib/file-hash");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { assertArtifactSize, defaultArtifactLimits, isForbiddenPackagedEntry } = require("./release-bundle-hygiene");
const { inspectAuthenticodeSignature, verifyAuthenticodeSignature } = require("./authenticode");
const { verifyPackagedApplication } = require("./packaged-app");

const rootDir = path.resolve(__dirname, "..");
const packageJson = require(path.join(rootDir, "package.json"));
const distDir = path.join(rootDir, "dist");
const setupPath = path.join(distDir, `card-vault-${packageJson.version}-setup.exe`);
const zipPath = path.join(distDir, `card-vault-${packageJson.version}-portable.zip`);
const checksumPath = path.join(distDir, "SHA256SUMS.txt");
const unpackedDir = path.join(distDir, "win-unpacked");


function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runPowerShell(command) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { windowsHide: true, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || "PowerShell artifact verification failed.");
  return result.stdout.trim();
}

function verifyUnpackedRuntime() {
  const executable = verifyPackagedApplication(unpackedDir, packageJson.version);
  verifyWindowsExecutableVersion(executable, "便携主程序");
}

function verifyWindowsExecutableVersion(filePath, label) {
  if (process.platform !== "win32") return;
  const escapedPath = filePath.replace(/'/g, "''");
  const expectedVersion = packageJson.version.replace(/'/g, "''");
  const command = [
    `$info=(Get-Item -LiteralPath '${escapedPath}').VersionInfo`,
    `if($info.ProductName -ne '${packageJson.productName.replace(/'/g, "''")}') { throw '${label}产品名称不一致' }`,
    `if($info.FileVersion -ne '${expectedVersion}') { throw '${label}文件版本不一致' }`,
    `if(@('${expectedVersion}','${expectedVersion}.0') -notcontains $info.ProductVersion) { throw '${label}产品版本不一致' }`
  ].join("; ");
  runPowerShell(command);
}

function verifyPortableArchive(signingMode) {
  if (process.platform !== "win32") return;
  const command = [
    "$ErrorActionPreference='Stop'",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
    `$zip=[System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}')`,
    `try {`,
    `$exe=$zip.Entries | Where-Object { ($_.FullName -replace '\\\\','/') -eq 'Card Vault.exe' } | Select-Object -First 1`,
    `$package=$zip.Entries | Where-Object { ($_.FullName -replace '\\\\','/') -eq 'resources/app/package.json' } | Select-Object -First 1`,
    `$tempExe=[System.IO.Path]::Combine([System.IO.Path]::GetTempPath(),('card-vault-artifact-'+[guid]::NewGuid().ToString('N')+'.exe'))`,
    `if(-not $exe) { throw 'Portable ZIP does not contain Card Vault.exe' }`,
    `if(-not $package) { throw 'Portable ZIP does not contain resources/app/package.json' }`,
    `$reader=[System.IO.StreamReader]::new($package.Open())`,
    `try { $version=($reader.ReadToEnd() | ConvertFrom-Json).version } finally { $reader.Dispose() }`,
    `if($version -ne '${packageJson.version.replace(/'/g, "''")}') { throw "Portable ZIP version $version does not match ${packageJson.version}" }`,
    `[System.IO.Compression.ZipFileExtensions]::ExtractToFile($exe,$tempExe,$true)`,
    `$info=(Get-Item -LiteralPath $tempExe).VersionInfo`,
    `if($info.ProductName -ne '${packageJson.productName.replace(/'/g, "''")}') { throw 'Portable executable product name is incorrect' }`,
    `if($info.FileVersion -ne '${packageJson.version.replace(/'/g, "''")}') { throw 'Portable executable file version is incorrect' }`,
    `if(@('${packageJson.version.replace(/'/g, "''")}','${packageJson.version.replace(/'/g, "''")}.0') -notcontains $info.ProductVersion) { throw 'Portable executable product version is incorrect' }`,
    `Import-Module (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1') -Force`,
    `$signature=Get-AuthenticodeSignature -LiteralPath $tempExe`,
    signingMode === "signed"
      ? `if($signature.Status -ne 'Valid' -or -not $signature.SignerCertificate -or -not $signature.TimeStamperCertificate) { throw ('Portable executable Authenticode signature is invalid: ' + $signature.Status) }`
      : `if($signature.Status -ne 'NotSigned') { throw ('Portable executable has an unexpected Authenticode status: ' + $signature.Status) }`,
    `$zip.Entries | ForEach-Object { $_.FullName }`,
    `} finally { $zip.Dispose(); if($tempExe -and (Test-Path -LiteralPath $tempExe)) { Remove-Item -LiteralPath $tempExe -Force } }`
  ].join("; ");
  const forbidden = runPowerShell(command).split(/\r?\n/).filter(isForbiddenPackagedEntry);
  assert.equal(forbidden.length, 0, `Portable ZIP contains forbidden files: ${forbidden.slice(0, 8).join(", ")}`);
}

function verifyInstallerVersion() {
  if (process.platform !== "win32") return;
  verifyWindowsExecutableVersion(setupPath, "安装包");
}

function main() {
  for (const artifact of [setupPath, zipPath]) {
    assert.ok(fs.existsSync(artifact), `发布文件不存在：${artifact}`);
    assert.ok(fs.statSync(artifact).size > 0, `发布文件为空：${artifact}`);
  }
  assertArtifactSize(setupPath, defaultArtifactLimits.installer, "Windows installer");
  assertArtifactSize(zipPath, defaultArtifactLimits.portable, "Portable ZIP");
  if (fs.existsSync(unpackedDir)) verifyUnpackedRuntime();
  verifyInstallerVersion();
  const installerSignature = inspectAuthenticodeSignature(setupPath, "Windows installer");
  const detectedSigningMode = installerSignature?.Status === "Valid"
    ? "signed"
    : installerSignature?.Status === "NotSigned"
      ? "unsigned"
      : "invalid";
  const expectedSigningMode = process.env.CARD_VAULT_EXPECTED_SIGNING_MODE || detectedSigningMode;
  assert.notEqual(detectedSigningMode, "invalid", `安装包签名状态无效：${installerSignature?.Status || "Unknown"}`);
  assert.equal(detectedSigningMode, expectedSigningMode, `安装包签名状态与预期不一致：${detectedSigningMode}`);
  if (detectedSigningMode === "signed") {
    verifyAuthenticodeSignature(setupPath, "Windows installer", {
      publisher: process.env.CARD_VAULT_AZURE_SIGN_PUBLISHER || process.env.CARD_VAULT_SIGNING_SUBJECT || ""
    });
  }
  verifyPortableArchive(detectedSigningMode);
  assert.ok(fs.existsSync(checksumPath), `校验清单不存在：${checksumPath}`);
  const checksums = fs.readFileSync(checksumPath, "utf8");
  assert.match(checksums, new RegExp(`${sha256File(setupPath).toUpperCase()}\\s+${escapeRegExp(path.basename(setupPath))}`));
  assert.match(checksums, new RegExp(`${sha256File(zipPath).toUpperCase()}\\s+${escapeRegExp(path.basename(zipPath))}`));
  process.stdout.write(`Release artifacts verified for v${packageJson.version} (${detectedSigningMode}).\n`);
  if (detectedSigningMode === "unsigned") {
    process.stdout.write("Warning: Windows may show Unknown Publisher or SmartScreen warnings for these unsigned artifacts.\n");
  }
  process.stdout.write(`${path.basename(setupPath)}  SHA256 ${sha256File(setupPath).toUpperCase()}\n`);
  process.stdout.write(`${path.basename(zipPath)}  SHA256 ${sha256File(zipPath).toUpperCase()}\n`);
}

main();
