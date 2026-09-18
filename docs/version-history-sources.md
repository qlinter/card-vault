# 版本历史资料说明 / Version history sources

历史恢复核查日期：2026-09-08；本地标签与文档状态复核：2026-09-18。中英文入口：[README](../README.md) / [English README](../README.en.md)。

## 已找回的历史

- v1.0.0–v1.2.1 共 24 个版本的中英文简史，来自标签 `v1.2.1`（提交 `41dd731`）中的 `README.md` 和 `README.en.md`。当前两份 README 已恢复这些原始摘要，按新到旧排列，并链接仍存在的独立发布说明。
- 2026-09-05 的提交 `a9d3782` 仍保留版本简史；2026-09-07 的提交 `ea19951` 将简史移除，并改为“版本历史统一维护在文档目录”。本次按用户要求取消该规则。
- 英文文件名为 `README.en.md`，最早在 2026-08-07 的提交 `186783d` 中出现；当前工作区仍有此文件。对可访问的全部 Git 历史进行检查，未发现英文 README 被删除的提交。
- v1.3.0 的功能发布依据为 `ea19951` 及[发布说明](./release-v1.3.0.md)；2026-09-08 修订、当前格式清理和代码优化合并为 [v1.3.1](./release-v1.3.1.md)。当时 README 历史表新增 v1.3.0，共 25 个历史版本；9 月 7 日产物不包含后续修订。

## 未找到的资料与记录边界

- **v1.0.0–v1.0.13 的独立逐版发布说明未找到**；当前目录中的独立发布文档从 v1.0.14 开始。早期版本并非没有历史记录，其简要变化已从历史 README 恢复；不补写缺乏来源的详细发布说明、测试结果或下载信息。
- **v1.0.3 没有 Git 标签**，但历史 README 和提交 `c8e06a0` 均有记录，因此保留该版本。此提交日期为 2026-06-30，提交标题写作 `v1.0.3@2026/06/20`，不能据此确认实际发布日期；README 历史表不填写未经确认的发布日期。
- v1.3.0 的本地标签现已可用；早期恢复记录依据上述发布提交和文档。初始 `card vault_v1.0` 开发、撤回与恢复提交不另计为产品版本；正式历史从 `v1.0.0` 开始。
- 核查范围为当前工作区和本地可访问的全部 Git 引用；未核查未同步分支、已删除且不可达的提交或外部发布附件。

在仓库根目录可使用以下只读命令复查原文：

```powershell
git show v1.2.1:README.md
git show v1.2.1:README.en.md
git diff a9d3782 ea19951 -- README.md README.en.md
git log --all --diff-filter=D --summary -- '*README*'
git show --stat c8e06a0
```

文档维护规则统一见[文档索引](./README.md)。

## English

The 24 historical entries from v1.0.0 through v1.2.1 were recovered from both README files at tag `v1.2.1` (`41dd731`). Commit `a9d3782` still contained the history; `ea19951` removed it on 2026-09-07 in favor of keeping history only in the docs directory. This policy has now been replaced as requested.

`README.en.md` first appears in commit `186783d` on 2026-08-07 and remains in the current workspace. No deletion of the English README was found in the accessible Git history.

Standalone release notes for v1.0.0–v1.0.13 were not found; existing separate release documents start at v1.0.14. The early summaries are recoverable, so those versions remain documented without inventing detailed release notes or validation results. v1.0.3 has no tag but is recorded in the historical README and commit `c8e06a0`; its commit date and title contain different dates, so no release date is asserted. The local v1.3.0 tag is now available. Its early recovery used `ea19951` and the release notes; subsequent fixes are documented under v1.3.1. At the initial recovery, both README history tables contained 25 earlier versions, including v1.3.0.

The search covered the current workspace and all locally accessible Git references, not unsynchronized branches, unreachable deleted commits or external release attachments. Initial development/revert commits are not counted as separate product versions.

Both READMEs must retain detailed notes for the latest version and concise entries for every earlier version. On a new release, preserve the outgoing version's full notes in its release document and add its summary to the history table. Keep the two languages aligned, distinguish later source fixes from packaged artifacts, and document any source gaps explicitly.

## 当前维护状态 / Current maintenance status

当前版本为 v1.3.4；双语 README 历史表均包含从 v1.0.0 到 v1.3.3 的 28 个旧版本。v1.3.1–v1.3.3 的版本事实来自对应发布说明，本地标签均可用。功能和分发验证不在此重复，参见[文档索引](./README.md)；v1.3.4 已于 2026-09-18 经确认完成打包与产物校验。

The current version is v1.3.4. Both README histories retain 28 earlier versions, from v1.0.0 through v1.3.3. Later entries use their release notes, and local tags for v1.3.1–v1.3.3 are available. Feature and distribution facts stay in the [documentation index](./README.md) and linked release notes. Following user confirmation, v1.3.4 packaging and artifact validation completed on 2026-09-18.
