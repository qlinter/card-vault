const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { builtinModules } = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const directories = ["app", "components", "lib", "electron", "scripts"];
const files = directories.flatMap(directory => fs.readdirSync(path.join(root, directory), { recursive: true })
  .filter(name => /\.(?:tsx?|[cm]?js)$/.test(name) && !name.endsWith(".d.ts"))
  .map(name => `${directory}/${name.replaceAll(path.sep, "/")}`));
for (const file of ["proxy.ts", "next.config.mjs"]) if (fs.existsSync(path.join(root, file))) files.push(file);
const sources = new Map(files.map(file => [file, fs.readFileSync(path.join(root, file), "utf8")]));
const nodeModules = new Set(builtinModules.map(name => name.replace(/^node:/, "")));
const directives = new Map();

function specifiers(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = new Set();
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) imports.add(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === "require")) {
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0])) imports.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return [...imports];
}

function resolve(file, specifier) {
  const base = specifier.startsWith("@/") ? specifier.slice(2)
    : specifier.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : null;
  if (!base) return null;
  const extensions = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
  return [base, ...extensions.map(extension => `${base}${extension}`), ...extensions.map(extension => `${base}/index${extension}`)]
    .find(candidate => sources.has(candidate)) ?? null;
}

const graph = new Map();
const runtimeImports = new Map();
for (const [file, source] of sources) {
  const prologue = new Set();
  for (const statement of ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true).statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    prologue.add(statement.expression.text);
  }
  directives.set(file, prologue);
  graph.set(file, specifiers(file, source).map(specifier => resolve(file, specifier)).filter(Boolean));
  // Transpilation removes type-only imports, including older implicit type imports.
  const emitted = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.Preserve } }).outputText;
  runtimeImports.set(file, specifiers(file, emitted));
}

const complete = new Set();
function checkCycles(file, stack = []) {
  assert.ok(!stack.includes(file), `Source dependency cycle: ${[...stack, file].join(" -> ")}`);
  if (complete.has(file)) return;
  for (const dependency of graph.get(file)) checkCycles(dependency, [...stack, file]);
  complete.add(file);
}
for (const file of files) checkCycles(file);

const checkedClientFiles = new Set();
function checkClientBoundary(file, stack = []) {
  // Next.js turns server-action imports into references; their implementation stays on the server.
  if (directives.get(file).has("use server") || checkedClientFiles.has(file)) return;
  checkedClientFiles.add(file);
  for (const specifier of runtimeImports.get(file)) {
    assert.ok(!nodeModules.has(specifier.replace(/^node:/, "")) && specifier !== "@prisma/client" && specifier !== "server-only",
      `Server dependency in client code: ${[...stack, file, specifier].join(" -> ")}`);
    const dependency = resolve(file, specifier);
    if (dependency) checkClientBoundary(dependency, [...stack, file]);
  }
}
for (const file of files) if (directives.get(file).has("use client")) checkClientBoundary(file);

process.stdout.write(`Architecture check passed: ${files.length} source files, no dependency cycles; ${checkedClientFiles.size} client-reachable modules respect the server boundary.\n`);
