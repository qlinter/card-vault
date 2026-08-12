# Windows 代码签名

Card Vault v1.0.14 支持可选 Authenticode 签名。没有证书时仍可生成 Windows 安装包和便携包；配置签名凭据后，发布流程会自动签名 `Card Vault.exe` 和 NSIS 安装器，便携 ZIP 包含同一个已签名主程序。

代码签名可以证明发布者身份和文件完整性，并避免“未知发布者”。SmartScreen 还会结合证书与下载信誉判断风险：普通 OV 新证书可能需要一段信誉积累期，EV 证书或 Microsoft Artifact Signing 更适合希望新发布身份尽快获得公开信任的场景。

## 方案一：PFX 代码签名证书

从受 Windows 信任的代码签名 CA 获取 Authenticode 证书，并在当前 PowerShell 会话或 CI Secret 中设置：

```powershell
$env:WIN_CSC_LINK = 'D:\secure\card-vault-signing.pfx'
$env:WIN_CSC_KEY_PASSWORD = '<PFX password>'
npm.cmd run release:win
```

`WIN_CSC_LINK` 也可以是 electron-builder 支持的安全 URL 或 Base64 内容。不要把 PFX 和密码写进项目 `.env`；仓库已忽略 `*.pfx` 和 `*.p12`，但证书仍应保存在工作区之外。

## 方案二：证书存储或 EV 证书

证书已安装在 Windows 个人证书存储，或 EV 私钥位于硬件令牌时，可按证书主题或 SHA-1 指纹选择身份：

```powershell
$env:CARD_VAULT_SIGNING_SUBJECT = '证书的完整 Subject/CN'
# 多个证书主题相同的情况下再指定指纹：
$env:CARD_VAULT_SIGNING_SHA1 = '<certificate thumbprint>'
npm.cmd run release:win
```

硬件令牌可能在签名期间要求 PIN 或厂商客户端授权。`CARD_VAULT_SIGNING_SHA1` 只是证书选择指纹；文件摘要和时间戳摘要仍使用 SHA-256。

## 方案三：Microsoft Artifact Signing

在 Microsoft Artifact Signing（原 Trusted Signing）中创建账户与证书配置文件，并为用于发布的应用注册授予签名权限。设置：

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

全部 `CARD_VAULT_AZURE_SIGN_*` 与 `AZURE_*` 变量必须同时配置；缺少任何一项都会在清理旧发布文件之前中止。

## 发布流程

`npm run release:win` 会依次：

1. 检查是否配置签名方式；没有凭据时进入未签名模式。
2. 执行完整测试和生产构建。
3. 已配置证书时由 electron-builder 签名主程序、卸载程序和安装器。
4. 完成打包冒烟测试后生成便携 ZIP 和 SHA-256 校验值。

没有有效证书不会阻止 v1.0.14 打包，但未签名文件可能触发 Windows 风险提示。开发调试继续使用 `npm run electron`，同样不要求发布证书。

## 手工复核

发布后可再次检查：

```powershell
Get-AuthenticodeSignature -LiteralPath '.\dist\card-vault-1.0.14-setup.exe' |
  Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

预期 `Status` 为 `Valid`，并同时显示签名者和时间戳证书。也应在文件属性的“数字签名”页核对发布者名称，再使用一台未安装开发证书的干净 Windows 设备检查安装体验。

## 官方参考

- [Microsoft：SmartScreen reputation for Windows app developers](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Microsoft：Time Stamping Authenticode Signatures](https://learn.microsoft.com/windows/win32/seccrypto/time-stamping-authenticode-signatures)
- [electron-builder：Windows Code Signing](https://www.electron.build/docs/features/code-signing/code-signing-win/)
