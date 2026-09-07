const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawn, spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const rootDir = path.resolve(__dirname, "..");
const runtimeRoot = path.join(rootDir, "tests", ".ui-test-runtime");
const dataDir = path.join(runtimeRoot, "data");
const dbPath = path.join(dataDir, "dev.db");
const port = Number.parseInt(process.env.UI_TEST_PORT || "3360", 10);
const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

function assertSafeRuntimePath(target) {
  const resolved = path.resolve(target);
  const testsRoot = path.join(rootDir, "tests") + path.sep;
  if (!resolved.startsWith(testsRoot) || path.basename(resolved) !== ".ui-test-runtime") {
    throw new Error(`Refusing UI test cleanup outside the dedicated runtime: ${resolved}`);
  }
  return resolved;
}

function databaseUrl(filePath) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

function seedDatabase() {
  const db = new DatabaseSync(dbPath);
  try {
    const insertCard = db.prepare(`
      INSERT INTO Card (
        id, playerName, cardTitle, sport, team, year, brand, productLine, parallel,
        isSerialNumbered, serialNumber, serialRange, isRookie, isAutograph,
        gradingCompany, grade, visibility, collectionStatus, holdingQuantity,
        tags, publicDescription, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCard.run(
      "ui-card-1", "Jordan Lee", "2024 Championship Rookie Auto", "Basketball", "Shanghai Meteors",
      "2024", "Aurora", "Championship", "Teal /99", 1, "08", "/99", 1, 1,
      "PSA", "10", "public", "holding", 2, "Core Collection,Rookie", "Public description for visual regression.", "UI fixture"
    );
    insertCard.run(
      "ui-card-2", "Alex Morgan", "2023 Spotlight Patch", "Football", "Bay City FC",
      "2023", "Spotlight", "Icons", "Gold", 0, null, null, 0, 0,
      null, null, "public", "holding", 1, "Patch,Featured", "Second card for responsive screenshots.", "UI fixture"
    );
    insertCard.run(
      "ui-card-3", "Racing Team 27", "2022 Victory Lap", "Motorsport", "Team 27",
      "2022", "Velocity", "Victory Lap", "Silver /50", 1, "21", "/50", 0, 0,
      "BGS", "9.5", "private", "sold", 0, "Sold", "Used for sold-card review.", "UI fixture"
    );

    // Stable creation dates keep newest-first screenshots independent of seed timing.
    const setCreatedAt = db.prepare("UPDATE Card SET createdAt=? WHERE id=?");
    for (const [index, day] of ["2026-08-22", "2026-08-21", "2026-08-20"].entries()) {
      setCreatedAt.run(day + "T00:00:00.000Z", "ui-card-" + (index + 1));
    }

    const insertImage = db.prepare("INSERT INTO CardImage (id, cardId, path, rotation) VALUES (?, ?, ?, ?)");
    insertImage.run("ui-image-1", "ui-card-1", "/media/ui-card-1.webp", 0);
    insertImage.run("ui-image-2", "ui-card-2", "/media/ui-card-2.webp", 0);
    insertImage.run("ui-image-3", "ui-card-3", "/media/ui-card-3.webp", 0);

    const insertTransaction = db.prepare(`
      INSERT INTO CardTransaction (id, cardId, kind, amountMinor, currency, quantity, occurredAt, source, provenance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTransaction.run("ui-buy-1", "ui-card-1", "purchase", 120000, "CNY", 2, "2026-01-15T00:00:00.000Z", "UI Market", "ui-test");
    insertTransaction.run("ui-buy-2", "ui-card-2", "purchase", 24000, "USD", 1, "2026-03-18T00:00:00.000Z", "UI Market", "ui-test");
    insertTransaction.run("ui-buy-3", "ui-card-3", "purchase", 48000, "CNY", 1, "2025-09-10T00:00:00.000Z", "UI Market", "ui-test");
    insertTransaction.run("ui-sale-3", "ui-card-3", "sale", 68000, "CNY", 1, "2026-05-12T00:00:00.000Z", "UI Market", "ui-test");

    const insertExpense = db.prepare(`
      INSERT INTO CardExpense (id, cardId, kind, context, amountMinor, currency, occurredAt, vendor, provenance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertExpense.run("ui-expense-1", "ui-card-1", "grading", "grading", 18000, "CNY", "2026-02-01T00:00:00.000Z", "PSA", "ui-test");

    const insertValuation = db.prepare(`
      INSERT INTO CardValuation (id, cardId, amountMinor, currency, valuedAt, source, provenance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertValuation.run("ui-value-1-old", "ui-card-1", 155000, "CNY", "2026-04-01T00:00:00.000Z", "个人估计", "ui-test");
    insertValuation.run("ui-value-1", "ui-card-1", 188000, "CNY", "2026-08-20T00:00:00.000Z", "近期成交", "ui-test");
    insertValuation.run("ui-value-2", "ui-card-2", 31500, "USD", "2026-08-18T00:00:00.000Z", "平台报价", "ui-test");

    db.prepare(`
      INSERT INTO ShareCollection (id, title, subtitle, slug, theme, presentationConfig, description, themeNarrative, themeHighlights)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "ui-share-1", "2026 Featured Collection", "Card Vault Visual Baseline", "ui-gallery",
      "archive", '{"version":1,"layout":"archive","backgroundPosition":{"x":48,"y":50},"panelOpacity":18,"fontStyle":"editorial","density":"balanced","imageFit":"contain"}',
      "An annual selection organized with a local-first workflow.", "Three cards tell a collection story about rookies, competition, and speed.", "Rookie autograph\nClassic patch\nLimited motorsport card"
    );
    db.prepare(`
      INSERT INTO ShareSection (id, shareCollectionId, title, description, layout, sortOrder)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("ui-section-1", "ui-share-1", "Annual Focus", "Fixed section for visual regression.", "editorial", 0);
    const insertShareItem = db.prepare(`
      INSERT INTO ShareCollectionItem (id, shareCollectionId, cardId, sectionId, sortOrder, displayTitle, displayDescription)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertShareItem.run("ui-item-1", "ui-share-1", "ui-card-1", "ui-section-1", 0, "Rookie Autograph of the Year", "Core collection and annual key visual." );
    insertShareItem.run("ui-item-2", "ui-share-1", "ui-card-2", "ui-section-1", 1, "Spotlight Patch", "A layered variation from the football collection." );
  } finally {
    db.close();
  }
}

async function waitForHealth(server) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`UI test server exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // The production server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Timed out waiting for the UI test server.");
}

async function startUiTestServer() {
  assertSafeRuntimePath(runtimeRoot);
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  const uploadsDir = path.join(dataDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.copyFileSync(path.join(rootDir, "public", "showcase-bg.webp"), path.join(uploadsDir, "ui-card-1.webp"));
  fs.copyFileSync(path.join(rootDir, "public", "home-bg.webp"), path.join(uploadsDir, "ui-card-2.webp"));
  fs.copyFileSync(path.join(rootDir, "public", "shares-bg.webp"), path.join(uploadsDir, "ui-card-3.webp"));

  const env = {
    ...process.env,
    CARD_VAULT_DATA_DIR: dataDir,
    CARD_VAULT_STORAGE_CONFIG_PATH: path.join(runtimeRoot, "storage-config.json"),
    DATABASE_URL: databaseUrl(dbPath),
    XDG_CACHE_HOME: path.join(runtimeRoot, "cache"),
    NODE_ENV: "production",
    UI_TEST_MODE: "1"
  };
  const init = spawnSync(process.execPath, [path.join(rootDir, "scripts", "init-db.js")], {
    cwd: rootDir,
    env,
    encoding: "utf8",
    windowsHide: true
  });
  if (init.status !== 0) throw new Error(init.stderr || init.stdout || "Unable to initialize UI test database.");
  seedDatabase();

  const server = spawn(process.execPath, ["--require", path.join(__dirname, "ui-test-clock.js"), nextCliPath, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "inherit", "inherit"],
    windowsHide: true
  });
  await waitForHealth(server);
  return {
    async close() {
      if (server.exitCode !== null || server.killed) return;
      if (process.platform === "win32") {
        try {
          execFileSync("taskkill.exe", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
        } catch {
          server.kill();
        }
      } else {
        server.kill("SIGTERM");
      }
    }
  };
}

if (require.main === module) {
  startUiTestServer().then((runtime) => {
    const stop = () => runtime.close().finally(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { startUiTestServer };
