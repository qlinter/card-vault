import fs from "fs";
import { readFile, stat } from "fs/promises";
import path from "path";
import { listRelativeFiles } from "./file-tree.ts";
import type { ExportData } from "./share-export-types.ts";

export const cloudflareStaticAssetFileLimit = 20_000;
export const cloudflareStaticAssetMaxBytes = 25 * 1024 * 1024;

export type ShareExportIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  file?: string;
};

export type ShareExportValidation = {
  valid: boolean;
  fileCount: number;
  totalBytes: number;
  maxFileBytes: number;
  issues: ShareExportIssue[];
};

const forbiddenExportKeys = new Set([
  "purchaseprice",
  "gradingfee",
  "totalinvested",
  "currentvalue",
  "purchasedate",
  "purchasesource",
  "notes",
  "apikey",
  "databasepath",
  "storagepath"
]);

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function walkPublicData(value: unknown, location: string, issues: ShareExportIssue[]): void {
  if (typeof value === "string") {
    if (/\bfile:\/\//i.test(value) || /(?:^|[\s"'])\p{L}:\\(?:Users|Documents and Settings)\\/iu.test(value)) {
      issues.push({
        level: "error",
        code: "local-path",
        message: `公开数据包含疑似本机路径：${location}`
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkPublicData(entry, `${location}[${index}]`, issues));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const nextLocation = `${location}.${key}`;
    if (forbiddenExportKeys.has(normalizedKey(key))) {
      issues.push({
        level: "error",
        code: "private-field",
        message: `公开数据包含禁止导出的私密字段：${nextLocation}`
      });
    }
    walkPublicData(entry, nextLocation, issues);
  }
}

export function validatePublicExportData(data: ExportData): ShareExportIssue[] {
  const issues: ShareExportIssue[] = [];
  walkPublicData(data, "export", issues);
  return issues;
}

function localReferences(html: string): string[] {
  const references: string[] = [];
  const attributePattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  const cssUrlPattern = /\burl\(\s*["']?([^"')]+)["']?\s*\)/gi;
  for (const pattern of [attributePattern, cssUrlPattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html))) {
      const reference = match[1].trim();
      if (
        reference &&
        !reference.startsWith("#") &&
        !reference.startsWith("data:") &&
        !reference.startsWith("mailto:") &&
        !reference.startsWith("tel:") &&
        !/^[a-z][a-z\d+.-]*:\/\//i.test(reference)
      ) {
        references.push(reference.split(/[?#]/, 1)[0]);
      }
    }
  }
  return references;
}

function isInsideRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function validateExportDirectory(
  folderPath: string,
  initialIssues: ShareExportIssue[] = []
): Promise<ShareExportValidation> {
  const root = path.resolve(folderPath);
  const files = await listRelativeFiles(root);
  const issues = [...initialIssues];
  let totalBytes = 0;
  let maxFileBytes = 0;

  if (!files.includes("index.html")) {
    issues.push({ level: "error", code: "missing-index", message: "发布包根目录缺少 index.html。" });
  }
  if (files.length > cloudflareStaticAssetFileLimit) {
    issues.push({
      level: "error",
      code: "file-count-limit",
      message: `发布包包含 ${files.length} 个文件，超过 Cloudflare 静态资源 ${cloudflareStaticAssetFileLimit} 个文件的限制。`
    });
  }

  for (const relativePath of files) {
    const fullPath = path.join(root, relativePath);
    const fileStat = await stat(fullPath);
    totalBytes += fileStat.size;
    maxFileBytes = Math.max(maxFileBytes, fileStat.size);
    if (fileStat.size > cloudflareStaticAssetMaxBytes) {
      issues.push({
        level: "error",
        code: "file-size-limit",
        file: relativePath,
        message: `${relativePath} 超过 Cloudflare 静态资源单文件 25 MiB 的限制。`
      });
    }

    if (!relativePath.endsWith(".html")) {
      continue;
    }
    const html = await readFile(fullPath, "utf8");
    for (const reference of localReferences(html)) {
      const target = path.resolve(path.dirname(fullPath), reference);
      if (!isInsideRoot(root, target)) {
        issues.push({
          level: "error",
          code: "unsafe-reference",
          file: relativePath,
          message: `${relativePath} 包含越出发布包目录的引用：${reference}`
        });
      } else if (!fs.existsSync(target)) {
        issues.push({
          level: "error",
          code: "broken-reference",
          file: relativePath,
          message: `${relativePath} 引用了不存在的文件：${reference}`
        });
      }
    }
  }

  return {
    valid: !issues.some((issue) => issue.level === "error"),
    fileCount: files.length,
    totalBytes,
    maxFileBytes,
    issues
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export function renderExportValidationReport(validation: ShareExportValidation): string {
  const errors = validation.issues.filter((issue) => issue.level === "error");
  const warnings = validation.issues.filter((issue) => issue.level === "warning");
  const issueLines = validation.issues.length > 0
    ? validation.issues.map((issue) => `- [${issue.level === "error" ? "错误" : "提醒"}] ${issue.message}`).join("\n")
    : "- 未发现问题。";

  return `# 分享包发布前检查

- 结果：${validation.valid ? "通过" : "未通过"}
- 文件数量：${validation.fileCount}
- 资源总大小：${formatBytes(validation.totalBytes)}
- 最大单文件：${formatBytes(validation.maxFileBytes)}
- 错误：${errors.length}
- 提醒：${warnings.length}

## 检查明细

${issueLines}
`;
}
