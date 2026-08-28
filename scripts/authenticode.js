const { spawnSync } = require("node:child_process");

function powershellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function inspectAuthenticodeSignature(filePath, label) {
  if (process.platform !== "win32") return null;
  const command = [
    "$ErrorActionPreference='Stop'",
    "Import-Module (Join-Path $PSHOME 'Modules\\Microsoft.PowerShell.Security\\Microsoft.PowerShell.Security.psd1') -Force",
    `$signature=Get-AuthenticodeSignature -LiteralPath ${powershellLiteral(filePath)}`,
    "$result=[ordered]@{Status=$signature.Status.ToString();StatusMessage=$signature.StatusMessage;Subject=if($signature.SignerCertificate){$signature.SignerCertificate.Subject}else{$null};Thumbprint=if($signature.SignerCertificate){$signature.SignerCertificate.Thumbprint}else{$null};TimestampSubject=if($signature.TimeStamperCertificate){$signature.TimeStamperCertificate.Subject}else{$null}}",
    "$result | ConvertTo-Json -Compress"
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", command], {
    windowsHide: true,
    encoding: "utf8"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${label} signature inspection failed.`);
  return JSON.parse(result.stdout.trim());
}

function verifyAuthenticodeSignature(filePath, label, options = {}) {
  const signature = inspectAuthenticodeSignature(filePath, label);
  if (!signature) return null;
  if (signature.status !== "Valid" && signature.Status !== "Valid") {
    throw new Error(`${label} Authenticode signature is not valid: ${signature.Status} ${signature.StatusMessage || ""}`.trim());
  }
  if (!signature.Subject) throw new Error(`${label} does not have a signer certificate.`);
  if (!signature.TimestampSubject) throw new Error(`${label} does not have an RFC 3161 timestamp.`);
  const publisher = String(options.publisher || "").trim();
  if (publisher && !signature.Subject.toLowerCase().includes(publisher.toLowerCase())) {
    throw new Error(`${label} signer does not match the configured publisher: ${signature.Subject}`);
  }
  return signature;
}

module.exports = { inspectAuthenticodeSignature, verifyAuthenticodeSignature };
