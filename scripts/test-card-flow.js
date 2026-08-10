const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { execFileSync, spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const rootDir = path.resolve(__dirname, "..");
const initDbScriptPath = path.join(rootDir, "scripts", "init-db.js");
const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

function fileDatabaseUrl(filePath) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(findAvailablePort(startPort + 1)));
    server.listen({ host: "127.0.0.1", port: startPort }, () => server.close(() => resolve(startPort)));
  });
}

async function waitForServer(baseUrl, output, serverProcess) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Card flow server exited with code ${serverProcess.exitCode}.\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the card flow server.\n${output.join("")}`);
}

async function fetchPage(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`);
  const html = await response.text();
  if (!response.ok) {
    throw new Error(`${route} returned HTTP ${response.status}.\n${html.slice(0, 500)}`);
  }
  return html;
}

function decodeHtmlAttribute(value = "") {
  return value.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

function cardFormHtml(html) {
  const fieldIndex = html.indexOf('name="playerName"');
  const formStart = html.lastIndexOf("<form", fieldIndex);
  const formEnd = html.indexOf("</form>", fieldIndex);
  if (fieldIndex < 0 || formStart < 0 || formEnd < 0) {
    throw new Error("Card page does not contain the expected card form.");
  }
  return html.slice(formStart, formEnd + 7);
}

function appendServerActionFields(formData, html) {
  const form = cardFormHtml(html);
  const fields = [...form.matchAll(/<input type="hidden" name="(\$ACTION_[^"]+)"(?: value="([^"]*)")?\/>/g)];
  if (fields.length === 0) {
    throw new Error("Card form does not contain a Server Action reference.");
  }
  for (const match of fields) {
    formData.append(match[1], decodeHtmlAttribute(match[2]));
  }
}

function appendCardFields(formData, values) {
  const fields = {
    playerName: values.playerName,
    cardTitle: values.cardTitle,
    sport: "Basketball",
    team: "Test Team",
    year: "2016-17",
    brand: "Test Brand",
    productLine: "Test Product",
    subsetName: "Test Subset",
    parallel: "Gold",
    cardNumber: "42",
    serialNumber: "01",
    serialRange: "/99",
    gradingCompany: "PSA",
    grade: values.grade,
    certNumber: "CERT-1",
    gradingLink: "https://example.test/cert-1",
    purchaseDate: "2026-08-09",
    purchasePrice: "100",
    gradingFee: "20",
    currentValue: "180",
    purchaseSource: "Test Source",
    visibility: "public",
    collectionStatus: "holding",
    tags: "rookie, test",
    publicDescription: values.description,
    notes: "Private test note",
    autoType: "on-card",
    patchType: "logo patch"
  };
  for (const [name, value] of Object.entries(fields)) {
    formData.append(name, value);
  }
  formData.append("isRookie", "on");
  formData.append("isAutograph", "on");
  formData.append("isPatch", "on");
}

function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.killed) {
    return;
  }
  try {
    serverProcess.kill();
  } catch {
    // The server may already have exited.
  }
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill.exe", ["/pid", String(serverProcess.pid), "/t", "/f"], { stdio: "ignore", timeout: 3000 });
    }
  } catch {
    // The child process tree may already have exited.
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-card-e2e-"));
  const dataDir = path.join(tempRoot, "data");
  const dbPath = path.join(dataDir, "dev.db");
  const port = await findAvailablePort(3340);
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  let serverProcess;

  try {
    const testEnv = {
      ...process.env,
      CARD_VAULT_DATA_DIR: dataDir,
      DATABASE_URL: fileDatabaseUrl(dbPath),
      NODE_ENV: "production"
    };
    execFileSync(process.execPath, [initDbScriptPath], { cwd: rootDir, env: testEnv, stdio: "pipe" });
    serverProcess = spawn(process.execPath, [nextCliPath, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: rootDir,
      env: testEnv,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    serverProcess.stdout.on("data", (chunk) => output.push(chunk.toString()));
    serverProcess.stderr.on("data", (chunk) => output.push(chunk.toString()));
    await waitForServer(baseUrl, output, serverProcess);

    const newPage = await fetchPage(baseUrl, "/cards/new");
    const createForm = new FormData();
    appendServerActionFields(createForm, newPage);
    appendCardFields(createForm, {
      playerName: "E2E Create Player",
      cardTitle: "E2E Create Card",
      grade: "Auto Auth",
      description: "创建流程回归测试。"
    });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    createForm.append("images", new Blob([png], { type: "image/png" }), "card.png");

    const createResponse = await fetch(`${baseUrl}/cards/new`, { method: "POST", body: createForm, redirect: "manual" });
    const createLocation = createResponse.headers.get("location") || "";
    const cardId = createLocation.match(/^\/cards\/([^?]+)\?success=created$/)?.[1];
    if (createResponse.status !== 303 || !cardId) {
      throw new Error(`Card create returned HTTP ${createResponse.status} (${createLocation}).\n${(await createResponse.text()).slice(0, 500)}`);
    }

    let db = new DatabaseSync(dbPath, { readOnly: true });
    const created = db.prepare("SELECT playerName, cardTitle, year, grade, totalCost FROM Card WHERE id = ?").get(cardId);
    const createdImage = db.prepare("SELECT path FROM CardImage WHERE cardId = ?").get(cardId);
    db.close();
    if (created?.playerName !== "E2E Create Player" || created?.year !== "2016-17" || created?.grade !== "Auto Auth" || created?.totalCost !== 120) {
      throw new Error("Card create did not persist the expected fields.");
    }
    if (!createdImage || !fs.existsSync(path.join(dataDir, "uploads", path.basename(createdImage.path)))) {
      throw new Error("Card create did not persist the uploaded image.");
    }

    const editPage = await fetchPage(baseUrl, `/cards/${cardId}/edit`);
    const editForm = new FormData();
    appendServerActionFields(editForm, editPage);
    appendCardFields(editForm, {
      playerName: "E2E Updated Player",
      cardTitle: "E2E Updated Card",
      grade: "Authentic",
      description: "编辑流程回归测试。"
    });
    const editResponse = await fetch(`${baseUrl}/cards/${cardId}/edit`, { method: "POST", body: editForm, redirect: "manual" });
    const editLocation = editResponse.headers.get("location") || "";
    if (editResponse.status !== 303 || editLocation !== `/cards/${cardId}?success=updated`) {
      throw new Error(`Card edit returned HTTP ${editResponse.status} (${editLocation}).\n${(await editResponse.text()).slice(0, 500)}`);
    }

    db = new DatabaseSync(dbPath, { readOnly: true });
    const updated = db.prepare("SELECT playerName, cardTitle, grade, publicDescription FROM Card WHERE id = ?").get(cardId);
    const imageCount = Number(db.prepare("SELECT COUNT(*) AS count FROM CardImage WHERE cardId = ?").get(cardId).count);
    db.close();
    if (updated?.playerName !== "E2E Updated Player" || updated?.grade !== "Authentic" || updated?.publicDescription !== "编辑流程回归测试。") {
      throw new Error("Card edit did not persist the expected fields.");
    }
    if (imageCount !== 1) {
      throw new Error("Card edit unexpectedly changed the existing image count.");
    }

    const detailPage = await fetchPage(baseUrl, `/cards/${cardId}`);
    if (
      !detailPage.includes("E2E Updated Player") ||
      !detailPage.includes("E2E Updated Card") ||
      !detailPage.includes("Authentic") ||
      !detailPage.includes("返回上一页")
    ) {
      throw new Error("Updated card detail page does not show the saved values.");
    }
    const showcaseDetailPage = await fetchPage(baseUrl, `/showcase/cards/${cardId}?group=E2E%20Updated%20Player&q=Updated`);
    if (
      !showcaseDetailPage.includes("返回上一页") ||
      !showcaseDetailPage.includes("E2E Updated Card") ||
      !showcaseDetailPage.includes('href="/showcase?group=E2E+Updated+Player&amp;q=Updated"')
    ) {
      throw new Error("Showcase card detail page does not provide filtered-context navigation.");
    }

    const filteredHomePage = await fetchPage(baseUrl, "/?sport=Basketball&sort=valueDesc");
    const filteredCardHref = `/cards/${cardId}?returnTo=%2F%3Fsport%3DBasketball%26sort%3DvalueDesc`;
    if (!filteredHomePage.includes(filteredCardHref)) {
      throw new Error("Filtered home page does not preserve its query in card detail links.");
    }
    const filteredDetailPage = await fetchPage(baseUrl, filteredCardHref);
    if (!filteredDetailPage.includes('href="/?sport=Basketball&amp;sort=valueDesc"')) {
      throw new Error("Card detail page does not return to the preserved home filter query.");
    }
    console.log("Card flow HTTP E2E passed: create, upload, edit, and detail routes.");
  } finally {
    stopServer(serverProcess);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
