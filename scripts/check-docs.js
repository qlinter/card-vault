const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const currentVersion = require("../package.json").version;
const docsDir = path.join(rootDir, "docs");
const markdownFiles = [
  path.join(rootDir, "README.md"),
  path.join(rootDir, "README.en.md"),
  ...fs.readdirSync(docsDir, { recursive: true })
    .filter(name => name.endsWith(".md"))
    .map(name => path.join(docsDir, name))
];

// Examples inside fenced code blocks are not rendered links or headings.
function withoutFences(source) {
  let fence = null;
  return source.split(/\r?\n/).map(line => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker?.[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length)) fence = null;
      return "";
    }
    if (marker) { fence = marker; return ""; }
    return line;
  }).join("\n");
}

function anchorsIn(source) {
  const anchors = new Set([...source.matchAll(/<a\s+id=["']([^"']+)["']/g)].map(match => match[1]));
  const headings = new Set();
  for (const match of source.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gm)) {
    const base = match[1].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/<[^>]+>/g, "")
      .toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "").replace(/\s/g, "-");
    let anchor = base;
    let suffix = 0;
    while (headings.has(anchor)) anchor = `${base}-${++suffix}`;
    headings.add(anchor);
    anchors.add(anchor);
  }
  return anchors;
}

const documents = new Map(markdownFiles.map(file => {
  const source = withoutFences(fs.readFileSync(file, "utf8"));
  return [file, { source, anchors: anchorsIn(source), targets: new Set() }];
}));
let localLinks = 0;
for (const [file, document] of documents) {
  for (const match of document.source.matchAll(/\[[^\]]*\]\((<[^>]+>|[^)]+)\)/g)) {
    const rawTarget = match[1].trim().replace(/^<([^>]+)>$/, "$1");
    if (!rawTarget || /^[a-z][a-z\d+.-]*:/i.test(rawTarget) || rawTarget.startsWith("//")) continue;
    const hash = rawTarget.indexOf("#");
    const target = hash < 0 ? rawTarget : rawTarget.slice(0, hash);
    const fragment = hash < 0 ? "" : decodeURIComponent(rawTarget.slice(hash + 1));
    const resolved = target ? path.resolve(path.dirname(file), decodeURIComponent(target)) : file;
    const description = `${path.relative(rootDir, file)}: ${rawTarget}`;
    assert.ok(fs.existsSync(resolved), `Broken local link in ${description}`);
    document.targets.add(resolved);
    localLinks++;
    if (fragment && resolved.endsWith(".md")) {
      const anchors = documents.get(resolved)?.anchors ?? anchorsIn(withoutFences(fs.readFileSync(resolved, "utf8")));
      assert.ok(anchors.has(fragment), `Missing Markdown anchor in ${description}`);
    }
  }
}

const currentRelease = path.join(docsDir, `release-v${currentVersion}.md`);
const historyIndex = path.join(docsDir, "history", "README.md");
const releaseArchive = path.join(docsDir, "history", "releases.md");
for (const file of [currentRelease, historyIndex, releaseArchive, path.join(docsDir, "history", "development.md")]) {
  assert.ok(documents.has(file), `Missing documentation: ${path.relative(rootDir, file)}`);
}

// Each directory owns its index; nested indexes must themselves be discoverable.
for (const file of markdownFiles.filter(file => file.startsWith(docsDir + path.sep))) {
  if (file === path.join(docsDir, "README.md")) continue;
  const index = path.join(path.basename(file) === "README.md" ? path.dirname(path.dirname(file)) : path.dirname(file), "README.md");
  assert.ok(documents.get(index)?.targets.has(file), `${path.relative(rootDir, index)} does not index ${path.relative(rootDir, file)}`);
}
for (const name of ["README.md", "README.en.md"]) {
  const document = documents.get(path.join(rootDir, name));
  for (const target of [currentRelease, historyIndex, path.join(docsDir, "README.md")]) {
    assert.ok(document.targets.has(target), `${name} must link to ${path.relative(rootDir, target)}`);
  }
  assert.doesNotMatch(document.source, /^\| `\d+\.\d+\.\d+` \|/m, `${name} must link to the shared history instead of duplicating it`);
}

const historySource = documents.get(historyIndex).source;
const history = [...historySource.matchAll(/^\| `(\d+\.\d+\.\d+)` \| (.+?) \| (.+?) \| (.+?) \|$/gm)].map(match => match[1]);
assert.equal(new Set(history).size, history.length, "History contains duplicate versions");
const recoveredVersions = [
  ...Array.from({ length: 20 }, (_, index) => `1.0.${index}`),
  "1.1.0", "1.1.1", "1.2.0", "1.2.1",
  ...Array.from({ length: 7 }, (_, index) => `1.3.${index}`),
  "1.4.0", "1.4.1", "1.4.2", "1.5.0", "1.5.1"
];
for (const version of recoveredVersions) assert.ok(history.includes(version), `History lost bilingual entry ${version}`);
function compareVersions(left, right) {
  const parts = right.split(".").map(Number);
  return left.split(".").map(Number).reduce((result, part, index) => result || part - parts[index], 0);
}
assert.deepEqual(history, [...history].sort((left, right) => compareVersions(right, left)), "History must be newest first");
assert.ok(history.every(version => compareVersions(version, currentVersion) < 0), "Current or future versions belong in their own release notes");
const archivedVersions = [...documents.get(releaseArchive).source.matchAll(/<a id="release-v(\d+)-(\d+)-(\d+)">/g)]
  .map(match => match.slice(1).join("."));
assert.equal(new Set(archivedVersions).size, archivedVersions.length, "Duplicate release archive entries");
for (const version of archivedVersions) assert.ok(history.includes(version), `History omits archived release ${version}`);
for (const version of history.filter(version => compareVersions(version, "1.0.14") >= 0)) {
  assert.ok(archivedVersions.includes(version), `Missing detailed archive for ${version}`);
}
for (const file of markdownFiles.filter(file => path.dirname(file) === docsDir)) {
  const version = /^release-v(\d+\.\d+\.\d+)\.md$/.exec(path.basename(file))?.[1];
  if (version) assert.equal(version, currentVersion, `Move completed release ${version} into the history archive`);
}

process.stdout.write(`Documentation check passed: ${markdownFiles.length} Markdown files, ${localLinks} local links, anchors and indexes; ${history.length} bilingual historical versions.\n`);
