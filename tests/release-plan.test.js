const assert = require("node:assert/strict"), test = require("node:test"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { releasePlan, verifyInstalledDependencies } = require("../scripts/release-plan");
test("release defaults to all checks; package-only always keeps build and artifact verification", () => {
  assert.equal(releasePlan([]).checks, "required");
  assert.deepEqual(releasePlan(["--package-only", "--plan"]), { mode: "package-only", checks: "skipped", build: "required", runtimeTests: "skipped", artifactVerification: "required" });
  assert.throws(() => releasePlan(["--skip-everything"]), /Unknown release option/);
});
test("packaging rejects installed dependencies that do not match the lockfile", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-release-plan-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { example: "1.0.0" } }));
  fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ packages: { "node_modules/example": { version: "1.0.0" } } }));
  assert.throws(() => verifyInstalledDependencies(root), /npm ci/);
  fs.mkdirSync(path.join(root, "node_modules", "example"), { recursive: true });
  fs.writeFileSync(path.join(root, "node_modules", "example", "package.json"), '{"version":"1.0.0"}');
  assert.deepEqual(verifyInstalledDependencies(root), { example: "1.0.0" });
  fs.writeFileSync(path.join(root, "node_modules", "example", "package.json"), '{"version":"2.0.0"}');
  assert.throws(() => verifyInstalledDependencies(root), /differs from lockfile/);
});
