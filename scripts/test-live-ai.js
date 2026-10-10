const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { spawnSync } = require("node:child_process");

// Opt-in acceptance only: credentials stay in process memory and never enter the report.
if (!process.versions.electron) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require("electron"), [__filename, ...process.argv.slice(2)], { env, windowsHide: true, stdio: "inherit", timeout: 480000 });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  const { app, safeStorage } = require("electron");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-live-ai-"));
  const configPath = process.argv[2] || process.env.CARD_VAULT_LIVE_AI_CONFIG_PATH;
  const profile = path.join(root, "profile");
  fs.mkdirSync(profile, { recursive: true });
  if (configPath) {
    const localState = path.join(path.dirname(path.resolve(configPath)), "Local State");
    if (fs.existsSync(localState)) fs.copyFileSync(localState, path.join(profile, "Local State"));
  }
  app.setPath("userData", profile);
  app.whenReady().then(async () => {
    const { DatabaseSync } = require("node:sqlite");
    const sharp = require("sharp");
    const { createAiConfigManager } = require("../electron/ai-config");
    const { fileDatabaseUrl, findAvailablePort, initializeTestDatabase, startTestServer, stopServer, removeTempRoot } = require("./test-http-flow-utils");
    if (!configPath) throw new Error("Pass the existing encrypted ai-config.json path.");
    assert.ok(fs.existsSync(configPath), "Encrypted configuration file does not exist.");
    const manager = createAiConfigManager(path.resolve(configPath), safeStorage);
    const runtime = manager.getRuntimeEnv();
    const publicSettings = manager.getPublicSettings();
    assert.equal(publicSettings.keyRecoveryRequired, false, "Existing encrypted credentials could not be decrypted in the isolated profile.");
    const visionOnly = process.argv.includes("--vision-only");
    const token = randomBytes(32).toString("base64url");
    const data = path.join(root, "data"), dbPath = path.join(data, "dev.db");
    const port = await findAvailablePort(3410), base = `http://127.0.0.1:${port}`;
    const env = { ...process.env, ...runtime, ELECTRON_RUN_AS_NODE: "1", CARD_VAULT_DATA_DIR: data, DATABASE_URL: fileDatabaseUrl(dbPath), CARD_VAULT_SESSION_TOKEN: token, CARD_VAULT_ALLOWED_ORIGIN: base };
    // Use the configured vision service for the public synthetic image fixture.
    if (runtime.AZURE_OPENAI_API_KEY) env.CARD_VAULT_AI_PROVIDER = "azure";
    initializeTestDatabase(env);
    const db = new DatabaseSync(dbPath);
    db.exec("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES('ai-acceptance','Jordan Lee','2024 Championship Rookie Auto','Basketball',1)");
    db.exec("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,currency,quantity,occurredAt,provenance) VALUES('buy','ai-acceptance','purchase',10000,'CNY',1,'2026-01-01T00:00:00.000Z','acceptance')");
    db.exec("INSERT INTO CardValuation(id,cardId,amountMinor,currency,valuedAt,source,provenance) VALUES('quote','ai-acceptance',15000,'CNY','2026-10-01T00:00:00.000Z','个人估计','acceptance')");
    db.close();
    const output = [], operations = [];
    const server = startTestServer(port, env, output);
    const headers = { Cookie: `card-vault-session=${token}`, Origin: base, Connection: "close" };
    const call = async (route, body) => {
      const response = await fetch(base + route, { method: "POST", headers: { ...headers, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) }, body: body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(360000) });
      const value = await response.json();
      assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
      return value;
    };
    const operation = async (name, work) => {
      const started = performance.now();
      try { const detail = await work(); operations.push({ name, ok: true, ms: Math.round(performance.now() - started), ...detail }); }
      catch (error) { operations.push({ name, ok: false, ms: Math.round(performance.now() - started), error: String(error.message).slice(0, 180) }); }
    };
    try {
      let ready = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        try { if ((await fetch(base + "/api/health", { headers })).ok) { ready = true; break; } } catch { /* Startup. */ }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      assert.ok(ready, "Isolated AI server did not start.");
      for (const provider of ["azure", "minimax", "deepseek"]) {
        if (visionOnly) break;
        if (!publicSettings[provider].hasApiKey) continue;
        await operation(`${provider}-connection`, async () => { assert.equal((await call("/api/ai/test-settings", { provider })).ok, true); return { provider }; });
      }
      await operation("vision-recognition", async () => {
        const svg = '<svg width="900" height="1300" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="1300" fill="#16304d"/><g fill="white" font-family="Arial" text-anchor="middle"><text x="450" y="160" font-size="60">CHAMPIONSHIP 2024</text><text x="450" y="420" font-size="80">JORDAN LEE</text><text x="450" y="560" font-size="55">BASKETBALL</text><text x="450" y="730" font-size="55">ROOKIE AUTO</text><text x="450" y="930" font-size="55">CARD #27</text></g></svg>';
        const picture = await sharp(Buffer.from(svg)).png().toBuffer();
        const form = new FormData(); form.append("images", new Blob([picture], { type: "image/png" }), "public-synthetic-card.png");
        const recognition = await call("/api/ai/recognize-card", form);
        assert.match(recognition.suggestion.playerName, /Jordan Lee/i);
        assert.match(recognition.suggestion.year, /2024/);
        return { provider: env.CARD_VAULT_AI_PROVIDER, fields: recognition.suggestion, confidence: recognition.confidence };
      });
      if (!visionOnly) await operation("portfolio-analysis", async () => {
        const value = await call("/api/ai/portfolio-analysis", { query: {} });
        assert.equal(value.fallback, false, "External analysis fell back to local statistics.");
        assert.equal(value.analysis.analysisVersion, 2);
        assert.equal(Object.keys(value.analysis.scorecard).length, 5);
        return { provider: value.provider, fallback: value.fallback, scorecardCount: Object.keys(value.analysis.scorecard).length };
      });
      const destination = path.resolve("logs", `v${require("../package.json").version}-review`, "live-ai.json");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const previous = visionOnly && fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, "utf8")).operations : [];
      const combined = [...previous.filter(item => !operations.some(current => current.name === item.name)), ...operations];
      fs.writeFileSync(destination, JSON.stringify({ testedAt: new Date().toISOString(), fixture: "synthetic public card and isolated collection", operations: combined }, null, 2));
      for (const item of operations) process.stdout.write(JSON.stringify(item) + "\n");
      assert.ok(combined.length >= 3 && combined.every(item => item.ok), "Live AI acceptance has failed operations; see the sanitized report.");
    } finally { stopServer(server); await removeTempRoot(root); }
  }).then(() => app.exit(0)).catch(error => { process.stderr.write(String(error.message).slice(0, 220) + "\n"); app.exit(1); });
}
