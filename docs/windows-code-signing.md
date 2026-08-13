# Windows 代码签名

Card Vault v1.0.16 支持可选 Authenticode 签名。没有证书时仍可生成 Windows 安装包和便携包；配置签名凭据后，发布流程会自动签名 `Card Vault.exe` 和 NSIS 安装器，便携 ZIP 包含同一个已签名主程序。

代码签名可以证明发布者身份和文件完整性，并减少“未知发布者”提示。SmartScreen 还会结合证书与下载信誉判断风险；普通 OV 新证书可能需要一段信誉积累期，EV 证书或 Microsoft Artifact Signing 更适合希望新发布身份尽快获得公开信任的场景。

## 方案一：PFX 代码签名证书

从受 Windows 信任的代码签名 CA 获取 Authenticode 证书，并在当前 PowerShell 会话或 CI Secret 中设置：

```powershell
$env:WIN_CSC_LINK = 'D:\secure\card-vault-signing.pfx'
$env:WIN_CSC_KEY_PASSWORD = '<PFX password>'
npm.cmd run release:win
```

`WIN_CSC_LINK` 也可以是 electron-builder 支持的安全 URL 或 Base64 内容。不要把 PFX 和密码写进项目 `.env`；证书应保存在工作区之外。

## 方案二：证书存储或 EV 证书

证书已安装在 Windows 个人证书存储，或 EV 私钥位于硬件令牌时，可按证书主题或 SHA-1 指纹选择身份：

```powershell
$env:CARD_VAULT_SIGNING_SUBJECT = '<certificate Subject/CN>'
$env:CARD_VAULT_SIGNING_SHA1 = '<certificate thumbprint>'
npm.cmd run release:win
```

文件摘要和时间戳摘要仍使用 SHA-256。

## 方案三：Microsoft Artifact Signing

在 Microsoft Artifact Signing 中创建账户与证书配置文件，并为发布应用注册授予签名权限：

```powershell
$env:CARD_VAULT_AZURE_SIGN_ENDPOINT = 'https://<region>.codesigning.azure.net'
$env:CARD_VAULT_AZURE_SIGN_ACCOUNT = '<signing account>'
$env:CARD_VAULT_AZURE_SIGN_PROFILE = '<certificate profile>'
$env:CARD_VAULT_AZURE_SIGN_PUBLISHER = '<certificate publisher CN>'
$env:AZURE_TENANT_ID = '<tenant id>'
$env:AZURE_CLIENT_ID = '<application client id>'
$env:AZURE_CLIENT_SECRET = '<client secret>'
npm.cmd run release:win
```

所有 `CARD_VAULT_AZURE_SIGN_*` 与 `AZURE_*` 变量必须同时配置；缺少任意一项都会在清理旧发布文件之前中止。

## 发布流程

`npm run release:win` 会依次：

1. 检查签名配置；没有凭据时进入未签名模式。
2. 执行完整测试、编码检查和生产构建。
3. 使用 electron-builder 生成 Windows 安装版。
4. 验证打包文件、运行卡片和分享流程冒烟测试。
5. 生成便携 ZIP 和 SHA-256 校验值。

没有有效证书不会阻止 v1.0.16 打包，但未签名文件可能触发 Windows 风险提示。开发调试继续使用 `npm run electron`，同样不要求发布证书。

## 手工复核

发布后可再次检查安装包签名：

```powershell
Get-AuthenticodeSignature -LiteralPath '.\dist\card-vault-1.0.16-setup.exe' |
  Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

预期 `Status` 为 `Valid`，并同时显示签名者和时间戳证书。也应在一台未安装开发证书的干净 Windows 设备上检查安装体验。

## 官方参考

- [Microsoft：SmartScreen reputation for Windows app developers](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Microsoft：Time Stamping Authenticode Signatures](https://learn.microsoft.com/windows/win32/seccrypto/time-stamping-authenticode-signatures)
- [electron-builder：Windows Code Signing](https://www.electron.build/docs/features/code-signing/code-signing-win/)
