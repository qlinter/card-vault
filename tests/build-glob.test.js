const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequire } = require("node:module");

test("build tools resolve solution files and TypeScript projects with the audited glob implementation", async t => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-build-glob-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  for (const name of ["build/app.sln", "src/tsconfig.json", "node_modules/example/tsconfig.json"]) {
    const file = path.join(cwd, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "");
  }
  fs.mkdirSync(path.join(cwd, "build", "folder.sln"));
  const options = { cwd, expandDirectories: false };
  const fromBuild = createRequire(require.resolve("node-gyp/package.json"));
  const fromParser = createRequire(require.resolve("@typescript-eslint/typescript-estree/package.json"));
  assert.equal(fromBuild("tinyglobby/package.json").name, "@card-vault/build-glob");
  assert.equal(fromParser("tinyglobby/package.json").name, "@card-vault/build-glob");
  assert.deepEqual(await fromBuild("tinyglobby").glob("build/*.sln", options), ["build/app.sln"]);
  const parserGlob = fromParser("tinyglobby");
  assert.equal(parserGlob.isDynamicPattern("src/tsconfig.json"), false);
  assert.equal(parserGlob.isDynamicPattern("**/tsconfig.json"), true);
  assert.deepEqual(parserGlob.globSync("**/tsconfig.json", { ...options, ignore: ["**/node_modules/**"] }), ["src/tsconfig.json"]);
});
