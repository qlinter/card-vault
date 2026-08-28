import type { ExportData } from "./share-export-types.ts";
import type { ShareExportIssue } from "./share-export-validation.ts";

export function auditShareAccessibility(data: ExportData): ShareExportIssue[] {
  const issues: ShareExportIssue[] = [];
  const cardIds = new Set(data.cards.map((card) => card.id));

  if (!data.title.trim()) {
    issues.push({ level: "error", code: "a11y-empty-title", message: "展馆缺少可供辅助技术识别的标题。" });
  }
  if (data.cards.length === 0) {
    issues.push({ level: "error", code: "a11y-empty-gallery", message: "展馆没有可浏览的卡片。" });
  }
  for (const card of data.cards) {
    if (!card.displayTitle.trim()) {
      issues.push({ level: "error", code: "a11y-empty-card-title", message: `${card.playerName} 的卡片缺少公开展示标题。` });
    }
    if (card.images.length === 0) {
      issues.push({ level: "warning", code: "a11y-card-image-placeholder", message: `${card.playerName} / ${card.displayTitle} 没有可用图片，将显示带说明的占位内容。` });
    }
  }
  for (const section of data.sections) {
    if (!section.title.trim()) {
      issues.push({ level: "error", code: "a11y-empty-section-title", message: "展馆包含缺少标题的章节。" });
    }
  }
  for (const cardId of data.presentation.featuredCardIds) {
    const card = data.cards.find((entry) => entry.id === cardId);
    if (!cardIds.has(cardId)) {
      issues.push({ level: "error", code: "a11y-missing-featured-card", message: `重点卡 ${cardId} 已不在当前展馆中。` });
    } else if (card && !card.description.trim()) {
      issues.push({ level: "warning", code: "a11y-featured-story", message: `重点卡 ${card.playerName} / ${card.displayTitle} 尚未添加卡片故事。` });
    }
  }

  return issues;
}

export function auditExportHtmlAccessibility(file: string, html: string): ShareExportIssue[] {
  const issues: ShareExportIssue[] = [];
  const error = (code: string, message: string) => issues.push({ level: "error" as const, code, file, message: `${file}：${message}` });

  if (!/<html\b[^>]*\blang=["'][^"']+["']/i.test(html)) error("a11y-html-lang", "缺少页面语言声明。");
  if (!/<meta\b[^>]*\bname=["']viewport["']/i.test(html)) error("a11y-viewport", "缺少移动端视口声明。");
  if (!/<main\b/i.test(html)) error("a11y-main-landmark", "缺少 main 主内容区域。");
  if (!/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)) error("a11y-page-heading", "缺少一级页面标题。");

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(match[0])) error("a11y-image-alt", "存在没有 alt 属性的图片。");
  }
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const attributes = match[1];
    const label = match[2].replace(/<[^>]+>/g, "").trim();
    if (!/\btype=["']button["']/i.test(attributes) && !/\btype=["']submit["']/i.test(attributes)) {
      error("a11y-button-type", "存在未声明 type 的按钮。");
    }
    if (!label && !/\baria-label=["'][^"']+["']/i.test(attributes)) error("a11y-button-label", "存在缺少可访问名称的按钮。");
  }

  return issues;
}
