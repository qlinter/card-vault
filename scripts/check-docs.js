const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs");
const markdownFiles = [
  path.join(rootDir, "README.md"),
  path.join(rootDir, "README.en.md"),
  ...fs.readdirSync(docsDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(docsDir, name))
];
const removedSpecNames = ["share-editor-2.0.md", "share-gallery-3.0.md"];

for (const filePath of markdownFiles) {
  const source = fs.readFileSync(filePath, "utf8");
  for (const removedName of removedSpecNames) {
    assert.equal(
      source.includes(removedName),
      false,
      `${path.relative(rootDir, filePath)} still references removed specification ${removedName}`
    );
  }

  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    if (!rawTarget || rawTarget.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(rawTarget)) continue;
    const targetWithoutAnchor = rawTarget.split("#", 1)[0];
    const resolved = path.resolve(path.dirname(filePath), decodeURI(targetWithoutAnchor));
    assert.ok(
      fs.existsSync(resolved),
      `${path.relative(rootDir, filePath)} contains a broken local link: ${rawTarget}`
    );
  }
}

const docsIndex = fs.readFileSync(path.join(docsDir, "README.md"), "utf8");
for (const requiredSpec of [
  "v1.3.0-implementation.md",
  "project-assessment-2026-09-07.md",
  "data-center-guide.md",
  "release-v1.3.0.md",
  "share-gallery.md",
  "financial-history-model.md",
  "data-backup-guide.md",
  "cloudflare-drop-publishing.md",
  "windows-code-signing.md",
  "product-roadmap.md",
  "product-roadmap.en.md"
]) {
  assert.ok(docsIndex.includes(requiredSpec), `docs/README.md does not index ${requiredSpec}`);
}

const roadmap = fs.readFileSync(path.join(docsDir, "product-roadmap.md"), "utf8");
const roadmapEn = fs.readFileSync(path.join(docsDir, "product-roadmap.en.md"), "utf8");
assert.ok(roadmap.includes("已完成：分享展馆"), "Chinese roadmap does not mark Share Gallery complete");
assert.ok(roadmapEn.includes("Completed — Share Gallery"), "English roadmap does not mark Share Gallery complete");

process.stdout.write(`Documentation check passed: ${markdownFiles.length} Markdown files, local links and required documentation entries are valid.\n`);
