const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const rootDir = path.resolve(__dirname, "..");
const decoder = new TextDecoder("utf-8", { fatal: true });

const ignoredDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "coverage",
  "logs",
  "backups"
]);

const textExtensions = new Set([
  ".bat",
  ".cmd",
  ".css",
  ".env",
  ".example",
  ".gitignore",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".prisma",
  ".ps1",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml"
]);

const suspiciousPatterns = [
  /�/,
  /(?:鎴戠殑|鐞冩槦|鍗＄墖|绛涢|璇勭骇|鏂板|娣诲姞|淇敼|鍒犻櫎|澶辫触|涓汉|銆|€)/,
  /(?:锛岃|锛屼|锛屽|寰勫|勪笉|浜у搧绾|骞翠唤|褰撳墠|鏈€|鏈)/
];

function shouldCheck(filePath) {
  const baseName = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();

  return textExtensions.has(extension) || baseName === ".editorconfig" || baseName === ".gitattributes";
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(path.join(dir, entry.name), files);
      }
      continue;
    }

    if (entry.isFile()) {
      const filePath = path.join(dir, entry.name);
      if (shouldCheck(filePath)) {
        files.push(filePath);
      }
    }
  }

  return files;
}

function lineNumberFor(text, index) {
  return text.slice(0, index).split(/\r\n|\r|\n/).length;
}

const failures = [];

for (const filePath of walk(rootDir)) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  if (relativePath === "scripts/check-encoding.js") {
    continue;
  }

  const buffer = fs.readFileSync(filePath);
  let text;

  try {
    text = decoder.decode(buffer);
  } catch {
    failures.push(`${relativePath}: not valid UTF-8`);
    continue;
  }

  for (const pattern of suspiciousPatterns) {
    const match = pattern.exec(text);
    if (match) {
      failures.push(`${relativePath}:${lineNumberFor(text, match.index)} suspicious mojibake: ${match[0]}`);
      break;
    }
  }
}

if (failures.length > 0) {
  console.error("Encoding check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error("\nOpen the listed files as UTF-8 and restore the original Chinese text before committing.");
  process.exitCode = 1;
} else {
  console.log("Encoding check passed: all checked text files are valid UTF-8 with no known mojibake patterns.");
}
