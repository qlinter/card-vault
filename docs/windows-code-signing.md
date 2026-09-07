# Windows 代码签名

Card Vault 的 Windows 代码签名是可选增强。`npm run release:win` 在配置受信任的 Authenticode 身份时会自动签名并验证 `Card Vault.exe` 和 NSIS 安装器；没有签名凭据时仍会生成经过结构、版本、运行时和 SHA-256 检查的未签名安装包与便携 ZIP。

未签名产物不能证明发布者身份，Windows 很可能显示“未知发布者”或 SmartScreen 提示；SHA-256 清单只能验证下载文件是否与发布文件一致，不能替代发布者身份认证。代码签名可以证明发布者身份和文件完整性，并消除“未知发布者”身份提示。SmartScreen 还会结合证书与下载信誉判断风险，因此任何签名方案都不能保证新文件第一次下载时绝对不显示 SmartScreen 提醒。

## 执行前提

当前 v1.3.0 已经用户确认生成未签名 Windows x64 安装包和便携包。后续新的分发构建仍需明确确认；仅作源码审查时使用 `npm run check:release`，不生成安装文件。

## 无证书发布

无需设置任何签名环境变量，直接运行：

```powershell
npm.cmd run release:win
```

流程会明确输出 `unsigned`，并要求安装器与便携包中的主程序均保持未签名状态，避免混用签名异常或部分签名的文件。发布时应同时提供 `SHA256SUMS.txt`，并在下载说明中明确提示 Windows 可能出现安全提醒。

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

一旦开始配置 Microsoft Artifact Signing，所有 `CARD_VAULT_AZURE_SIGN_*` 与 `AZURE_*` 变量必须完整提供；部分配置会在清理旧发布文件之前中止，避免误以为已经签名。

## 发布流程

`npm run release:win` 会依次：

1. 检查签名配置；没有凭据时选择未签名模式，有完整凭据时选择对应签名模式。
2. 执行完整测试、编码检查和生产构建；CI 额外执行全部依赖审计，本地发布前运行 `npm run audit:all`。
3. 使用 electron-builder 生成 Windows 安装版。
4. 签名模式验证安装器和主程序的签名者与 RFC 3161 时间戳；未签名模式验证两者均为 `NotSigned`。
5. 验证打包文件，运行卡片、分享、数据管理 HTTP 流程及包内健康端点冒烟测试。
6. 生成便携 ZIP 和 SHA-256 校验值，并再次验证 ZIP 内主程序与本次签名模式一致。

`npm run package:win` 只执行基础 electron-builder 打包，适合本机快速检查。对外发布应使用 `npm run release:win`，即使没有证书，也能获得完整门禁、冒烟测试、便携 ZIP 和 SHA-256 清单。

## GitHub Actions

经确认后手动运行 `.github/workflows/release-windows.yml` 可在 GitHub Windows Runner 上生成 Windows 产物。不配置签名 Secrets 时生成未签名产物；需要签名时任选一种方式配置仓库 Secrets：

- PFX：`WINDOWS_CERTIFICATE_BASE64`、`WINDOWS_CERTIFICATE_PASSWORD`
- Microsoft Artifact Signing：`CARD_VAULT_AZURE_SIGN_ENDPOINT`、`CARD_VAULT_AZURE_SIGN_ACCOUNT`、`CARD_VAULT_AZURE_SIGN_PROFILE`、`CARD_VAULT_AZURE_SIGN_PUBLISHER`、`AZURE_TENANT_ID`、`AZURE_CLIENT_ID`、`AZURE_CLIENT_SECRET`

候选入口 `.github/workflows/windows-release.yml` 仅复用同一发布流程，避免维护第二套发布实现。质量工作流只执行检查，不打包。

工作流只上传通过完整发布检查的安装包、便携包和 SHA-256 清单；配置签名时额外要求 Authenticode 与时间戳复核通过。

## 手工复核

发布后可再次检查安装包签名：

```powershell
Get-AuthenticodeSignature -LiteralPath '.\dist\card-vault-1.3.0-setup.exe' |
  Format-List Status,StatusMessage,SignerCertificate,TimeStamperCertificate
```

签名发布预期 `Status` 为 `Valid`，并同时显示签名者和时间戳证书；未签名发布预期为 `NotSigned`。两种模式都应在一台干净 Windows 设备上检查安装体验，未签名模式应预期出现“未知发布者”或 SmartScreen 提示。

## 官方参考

- [Microsoft：SmartScreen reputation for Windows app developers](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- [Microsoft：Time Stamping Authenticode Signatures](https://learn.microsoft.com/windows/win32/seccrypto/time-stamping-authenticode-signatures)
- [electron-builder：Windows Code Signing](https://www.electron.build/docs/features/code-signing/code-signing-win/)
