const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const packageJson = require(path.join(rootDir, "package.json"));
const distDir = path.join(rootDir, "dist");
const setupPath = path.join(distDir, `card-vault-${packageJson.version}-setup.exe`);
const zipPath = path.join(distDir, `card-vault-${packageJson.version}-portable.zip`);
const checksumPath = path.join(distDir, "SHA256SUMS.txt");
const unpackedDir = path.join(distDir, "win-unpacked");

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex").toUpperCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runPowerShell(command) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { windowsHide: true, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || "PowerShell artifact verification failed.");
  return result.stdout.trim();
}

function verifyUnpackedRuntime() {
  const appRoot = path.join(unpackedDir, "resources", "app");
  const required = [
    path.join(unpackedDir, "Card Vault.exe"),
    path.join(appRoot, "package.json"),
    path.join(appRoot, ".next", "BUILD_ID"),
    path.join(appRoot, "node_modules", ".prisma", "client", "schema.prisma"),
    path.join(appRoot, "node_modules", "@swc", "helpers", "package.json")
  ];
  for (const filePath of required) assert.ok(fs.existsSync(filePath), `发布目录缺少 ${filePath}`);
  const packagedPackage = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
  assert.equal(packagedPackage.version, packageJson.version, "发布目录版本与 package.json 不一致");
}

function verifyPortableArchive() {
  if (process.platform !== "win32") return;
  const command = [
    "$ErrorActionPreference='Stop'",
    `Add-Type -AssemblyName System.IO.Compression.FileSystem`,
    `$zip=[System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/'/g, "''")}')`,
    `try {`,
    `$exe=$zip.Entries | Where-Object { ($_.FullName -replace '\\\\','/') -eq 'Card Vault.exe' } | Select-Object -First 1`,
    `$package=$zip.Entries | Where-Object { ($_.FullName -replace '\\\\','/') -eq 'resources/app/package.json' } | Select-Object -First 1`,
    `if(-not $exe) { throw 'Portable ZIP does not contain Card Vault.exe' }`,
    `if(-not $package) { throw 'Portable ZIP does not contain resources/app/package.json' }`,
    `$reader=[System.IO.StreamReader]::new($package.Open())`,
    `try { $version=($reader.ReadToEnd() | ConvertFrom-Json).version } finally { $reader.Dispose() }`,
    `if($version -ne '${packageJson.version.replace(/'/g, "''")}') { throw "Portable ZIP version $version does not match ${packageJson.version}" }`,
    `} finally { $zip.Dispose() }`
  ].join("; ");
  runPowerShell(command);
}

function verifyInstallerVersion() {
  if (process.platform !== "win32") return;
  const version = runPowerShell(`(Get-Item -LiteralPath '${setupPath.replace(/'/g, "''")}').VersionInfo.ProductVersion`);
  assert.equal(version, packageJson.version, "安装包 Windows 产品版本不一致");
}

function main() {
  for (const artifact of [setupPath, zipPath]) {
    assert.ok(fs.existsSync(artifact), `发布文件不存在：${artifact}`);
    assert.ok(fs.statSync(artifact).size > 0, `发布文件为空：${artifact}`);
  }
  if (fs.existsSync(unpackedDir)) verifyUnpackedRuntime();
  verifyInstallerVersion();
  verifyPortableArchive();
  assert.ok(fs.existsSync(checksumPath), `校验清单不存在：${checksumPath}`);
  const checksums = fs.readFileSync(checksumPath, "utf8");
  assert.match(checksums, new RegExp(`${hashFile(setupPath)}\\s+${escapeRegExp(path.basename(setupPath))}`));
  assert.match(checksums, new RegExp(`${hashFile(zipPath)}\\s+${escapeRegExp(path.basename(zipPath))}`));
  process.stdout.write(`Release artifacts verified for v${packageJson.version}.\n`);
  process.stdout.write(`${path.basename(setupPath)}  SHA256 ${hashFile(setupPath)}\n`);
  process.stdout.write(`${path.basename(zipPath)}  SHA256 ${hashFile(zipPath)}\n`);
}

main();
