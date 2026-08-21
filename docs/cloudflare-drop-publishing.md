# Cloudflare Drop 临时发布

适用版本：`1.1.0`。

Card Vault 的 Cloudflare Drop 发布包用于快速预览和短时分享。它不把 Drop 当作永久托管服务，也不保存发布 URL 或认领链接。

## 当前流程

1. 在分享集导出页生成“Cloudflare Drop 临时发布包”。
2. 查看 `CHECK-REPORT.md`；只有阻断错误全部消除后才会生成 ZIP。
3. 将生成的文件夹或 ZIP 人工上传至 Cloudflare Drop。
4. 在约一小时的有效期内人工检查首页、章节、单卡、图片和手机显示。
5. 需要永久保留时，由用户自行在 Cloudflare 规定时间内认领。

## 导出前检查

- `index.html` 位于发布包根目录。
- HTML 引用的本地 CSS、JavaScript、图片和单卡页面均存在，且不会越出发布包目录。
- `assets/data.json` 继续使用公开字段白名单，并再次检查价格、投入、购买渠道、备注、API Key 和本地路径等禁止字段。
- 文件数量不超过 Cloudflare Workers Static Assets 当前的 20,000 个文件限制。
- 每个文件不超过 25 MiB。
- 缺失的卡片图片、封面或背景作为非阻断提醒写入检查报告。
- 同名卡片生成唯一的单卡文件名，避免导出时互相覆盖。

## 包内文件

- `404.html`：无效地址的友好返回页。
- `_headers`：基础安全响应头和 `X-Robots-Tag`（Drop 模式）。
- `robots.txt`：禁止抓取（Drop 模式）。
- `publish-manifest.json`：导出格式、应用版本、数量和公开内容摘要，不包含 URL、凭据或本机路径。
- `CHECK-REPORT.md`：本次导出的完整性、大小和提醒。
- `README-Cloudflare-Drop.md`：人工上传及一小时有效期说明。

`noindex` 只能降低搜索引擎收录概率，不能提供身份验证。临时地址仍是公开地址；认领链接应视为敏感信息，不应写入 Card Vault、日志或公开聊天。

## 后续边界

永久域名、发布历史、线上版本验证、更新、撤回和凭据管理暂不属于本阶段。未来接入 Cloudflare 正式账户或独立服务器时，可在现有静态包和 `publish-manifest.json` 基础上增加发布适配器，而不改变分享编辑器的数据模型。
