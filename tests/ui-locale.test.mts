import assert from "node:assert/strict";
import test from "node:test";
import { formatHomeLoadMoreLabel } from "../lib/ui-locale.ts";
import { hasUntranslatedUiText, translateUiText } from "../lib/ui-translations.ts";

test("home load-more label is fully localized with its dynamic count", () => {
  assert.equal(formatHomeLoadMoreLabel("zh-CN", 17), "显示更多（剩余 17）");
  assert.equal(formatHomeLoadMoreLabel("en", 17), "Show More (17 remaining)");
});

test("expanded settings and portfolio status text have complete English translations", () => {
  assert.equal(translateUiText("视图与比较"), "Views & comparison");
  assert.equal(translateUiText("暂无已售卡片。"), "No sold cards.");
  const samples = [
    "估值超过 360 天",
    "暂无已售卡片。",
    "当前不是桌面端环境，界面内保存不可用；开发态可通过 .env.local 配置 AI 服务商。",
    "新增录入工作台 2.0：SQLite 草稿、连续录入、公共字段模板和批量图片 WebP 队列。",
    "Card Vault v1.2.1 更新说明",
    "设置公开标题、卡片故事和顺序，并可标记最多 6 张重点卡。",
    "导出会自动生成 WebP 展示图和缩略图，创建章节页与卡片主体专题页，并执行可访问性检查和版本差异比较。",
    "本机草稿不可用；修改仍可保存到分享集",
    "发现 2026/8/28 10:00:00 的本机草稿，恢复后仍可使用撤销返回当前已保存内容。",
    "取消已选择的背景图",
    "选择 Jordan Lee / 2024 Championship Rookie Auto"
  ];
  for (const sample of samples) {
    assert.equal(hasUntranslatedUiText(sample), false, `${sample} -> ${translateUiText(sample)}`);
  }
});
