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

function appendActionFieldsForMarker(formData, html, marker) {
  const markerIndex = html.indexOf(marker);
  const formStart = html.lastIndexOf("<form", markerIndex);
  const formEnd = html.indexOf("</form>", markerIndex);
  if (markerIndex < 0 || formStart < 0 || formEnd < 0) {
    throw new Error(`Page does not contain the expected action form: ${marker}`);
  }
  const form = html.slice(formStart, formEnd + 7);
  const fields = [...form.matchAll(/<input type="hidden" name="(\$ACTION_[^"]+)"(?: value="([^"]*)")?\/>/g)];
  if (fields.length === 0) {
    throw new Error(`Action form does not contain a Server Action reference: ${marker}`);
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
    historyCurrency: "CNY",
    valuationDate: "2026-08-10",
    valuationSource: "个人估计",
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
    const created = db.prepare("SELECT playerName, cardTitle, year, grade, totalCost, isSerialNumbered FROM Card WHERE id = ?").get(cardId);
    const createdImage = db.prepare("SELECT path FROM CardImage WHERE cardId = ?").get(cardId);
    const createdTransaction = db.prepare("SELECT kind, amountMinor, currency, provenance FROM CardTransaction WHERE cardId = ?").get(cardId);
    const createdExpense = db.prepare("SELECT kind, amountMinor, currency, provenance FROM CardExpense WHERE cardId = ?").get(cardId);
    const createdValuation = db.prepare("SELECT amountMinor, currency, source, provenance FROM CardValuation WHERE cardId = ?").get(cardId);
    db.close();
    if (created?.playerName !== "E2E Create Player" || created?.year !== "2016-17" || created?.grade !== "Auto Auth" || created?.totalCost !== 120 || created?.isSerialNumbered !== 1) {
      throw new Error("Card create did not persist the expected fields.");
    }
    if (!createdImage || !fs.existsSync(path.join(dataDir, "uploads", path.basename(createdImage.path)))) {
      throw new Error("Card create did not persist the uploaded image.");
    }
    if (
      createdTransaction?.kind !== "purchase" || createdTransaction?.amountMinor !== 10000 ||
      createdExpense?.kind !== "grading" || createdExpense?.amountMinor !== 2000 ||
      createdValuation?.amountMinor !== 18000 || createdValuation?.source !== "个人估计" ||
      createdTransaction?.provenance !== "initial_card_entry"
    ) {
      throw new Error("Card create did not persist the expected initial financial history.");
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
    const historyCount = Number(db.prepare("SELECT (SELECT COUNT(*) FROM CardTransaction WHERE cardId = ?) + (SELECT COUNT(*) FROM CardExpense WHERE cardId = ?) + (SELECT COUNT(*) FROM CardValuation WHERE cardId = ?) AS count").get(cardId, cardId, cardId).count);
    db.close();
    if (updated?.playerName !== "E2E Updated Player" || updated?.grade !== "Authentic" || updated?.publicDescription !== "编辑流程回归测试。") {
      throw new Error("Card edit did not persist the expected fields.");
    }
    if (imageCount !== 1) {
      throw new Error("Card edit unexpectedly changed the existing image count.");
    }
    if (historyCount !== 3) {
      throw new Error("Ordinary card editing unexpectedly changed financial history.");
    }

    const detailPage = await fetchPage(baseUrl, `/cards/${cardId}`);
    const detailChecks = [
      detailPage.includes("E2E Updated Player"),
      detailPage.includes("E2E Updated Card"),
      detailPage.includes("Authentic"),
      detailPage.includes("返回上一页"),
      detailPage.includes("财务历史"),
      detailPage.includes("新增交易"),
      detailPage.includes("个人估计"),
      detailPage.includes("Team")
    ];
    if (detailChecks.some((check) => !check)) {
      throw new Error(`Updated card detail page does not show the saved values: ${detailChecks.join(",")}`);
    }
    if (!detailPage.includes("<summary>编辑</summary>") || detailPage.includes("纠错与删除") || detailPage.includes("保存纠错")) {
      throw new Error("Financial history does not use the expected edit wording.");
    }
    for (const financialStatus of ["旧数据迁移", "已纠错", "手动录入", "初始录入", "旧币种待纠正"]) {
      if (detailPage.includes(financialStatus)) {
        throw new Error(`Financial timeline still exposes an internal edit status: ${financialStatus}`);
      }
    }

    const valuationForm = new FormData();
    appendActionFieldsForMarker(valuationForm, detailPage, "保存估值");
    valuationForm.append("amount", "210.50");
    valuationForm.append("currency", "CNY");
    valuationForm.append("valuedAt", "2026-08-11");
    valuationForm.append("source", "平台报价");
    valuationForm.append("notes", "History action regression test.");
    const valuationResponse = await fetch(`${baseUrl}/cards/${cardId}`, { method: "POST", body: valuationForm, redirect: "manual" });
    const valuationLocation = valuationResponse.headers.get("location") || "";
    if (valuationResponse.status !== 303 || valuationLocation !== `/cards/${cardId}?success=history-added#financial-history`) {
      throw new Error(`Valuation action returned HTTP ${valuationResponse.status} (${valuationLocation}).\n${(await valuationResponse.text()).slice(0, 500)}`);
    }
    db = new DatabaseSync(dbPath, { readOnly: true });
    const latestValuation = db.prepare("SELECT id, amountMinor, source FROM CardValuation WHERE cardId = ? ORDER BY valuedAt DESC LIMIT 1").get(cardId);
    const syncedSnapshot = db.prepare("SELECT currentValue FROM Card WHERE id = ?").get(cardId);
    db.close();
    if (latestValuation?.amountMinor !== 21050 || latestValuation?.source !== "平台报价" || syncedSnapshot?.currentValue !== 210.5) {
      throw new Error("Detail financial action did not persist the valuation and synchronize the compatibility snapshot.");
    }

    const historyDetailPage = await fetchPage(baseUrl, `/cards/${cardId}?success=history-added`);
    const correctionForm = new FormData();
    appendActionFieldsForMarker(correctionForm, historyDetailPage, 'name="notes">History action regression test.');
    correctionForm.append("amount", "220.75");
    correctionForm.append("currency", "CNY");
    correctionForm.append("valuedAt", "2026-08-11");
    correctionForm.append("source", "近期成交");
    correctionForm.append("notes", "Corrected history action regression test.");
    const correctionResponse = await fetch(`${baseUrl}/cards/${cardId}`, { method: "POST", body: correctionForm, redirect: "manual" });
    const correctionLocation = correctionResponse.headers.get("location") || "";
    if (correctionResponse.status !== 303 || correctionLocation !== `/cards/${cardId}?success=history-updated#financial-history`) {
      throw new Error(`Valuation correction returned HTTP ${correctionResponse.status} (${correctionLocation}).`);
    }
    db = new DatabaseSync(dbPath, { readOnly: true });
    const correctedValuation = db.prepare("SELECT amountMinor, source, provenance FROM CardValuation WHERE cardId = ? ORDER BY valuedAt DESC, updatedAt DESC LIMIT 1").get(cardId);
    db.close();
    if (correctedValuation?.amountMinor !== 22075 || correctedValuation?.source !== "近期成交" || correctedValuation?.provenance !== "manual_correction") {
      throw new Error("Valuation correction did not persist the expected values.");
    }

    const correctedDetailPage = await fetchPage(baseUrl, `/cards/${cardId}?success=history-updated`);
    const deleteForm = new FormData();
    appendActionFieldsForMarker(deleteForm, correctedDetailPage, "删除这条记录");
    const deleteResponse = await fetch(`${baseUrl}/cards/${cardId}`, { method: "POST", body: deleteForm, redirect: "manual" });
    const deleteLocation = deleteResponse.headers.get("location") || "";
    if (deleteResponse.status !== 303 || deleteLocation !== `/cards/${cardId}?success=history-deleted#financial-history`) {
      throw new Error(`Valuation deletion returned HTTP ${deleteResponse.status} (${deleteLocation}).`);
    }
    db = new DatabaseSync(dbPath, { readOnly: true });
    const remainingValuationCount = Number(db.prepare("SELECT COUNT(*) AS count FROM CardValuation WHERE cardId = ?").get(cardId).count);
    const revertedSnapshot = db.prepare("SELECT currentValue FROM Card WHERE id = ?").get(cardId);
    db.close();
    if (remainingValuationCount !== 1 || revertedSnapshot?.currentValue !== 180) {
      throw new Error("Valuation deletion did not restore the previous compatibility snapshot.");
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
    const filteredHomeText = filteredHomePage
      .replace(/<!--.*?-->/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&yen;/g, "¥");
    const filteredCardHref = `/cards/${cardId}?returnTo=%2F%3Fsport%3DBasketball%26sort%3DvalueDesc`;
    if (
      !filteredHomePage.includes(filteredCardHref) ||
      !filteredHomeText.includes("CNY 180.00") ||
      !filteredHomeText.includes("估值覆盖 1/1")
    ) {
      throw new Error(`Filtered home page mismatch: link=${filteredHomePage.includes(filteredCardHref)}, amount=${filteredHomeText.includes("CNY 180.00")}, coverage=${filteredHomeText.includes("估值覆盖 1/1")}\n${filteredHomeText.match(/总估值.{0,180}/)?.[0] || "no valuation text"}`);
    }
    const filteredDetailPage = await fetchPage(baseUrl, filteredCardHref);
    if (!filteredDetailPage.includes('href="/?sport=Basketball&amp;sort=valueDesc"')) {
      throw new Error("Card detail page does not return to the preserved home filter query.");
    }
    const filteredEditPath = `/cards/${cardId}/edit?returnTo=${encodeURIComponent("/?sport=Basketball&sort=valueDesc")}`;
    if (!filteredDetailPage.includes(`href="${filteredEditPath}"`)) {
      throw new Error("Card detail page does not preserve the home filter query in the edit link.");
    }
    const filteredEditPage = await fetchPage(baseUrl, filteredEditPath);
    if (!filteredEditPage.includes('name="returnTo" value="/?sport=Basketball&amp;sort=valueDesc"')) {
      throw new Error("Card edit page does not carry the preserved home filter query.");
    }
    const filteredEditForm = new FormData();
    appendServerActionFields(filteredEditForm, filteredEditPage);
    appendCardFields(filteredEditForm, {
      playerName: "E2E Filtered Player",
      cardTitle: "E2E Filtered Card",
      grade: "Authentic",
      description: "筛选状态回归测试。"
    });
    filteredEditForm.append("returnTo", "/?sport=Basketball&sort=valueDesc");
    const filteredEditResponse = await fetch(`${baseUrl}${filteredEditPath}`, { method: "POST", body: filteredEditForm, redirect: "manual" });
    const filteredEditLocation = filteredEditResponse.headers.get("location") || "";
    const expectedFilteredEditLocation = `/cards/${cardId}?success=updated&returnTo=${encodeURIComponent("/?sport=Basketball&sort=valueDesc")}`;
    if (filteredEditResponse.status !== 303 || filteredEditLocation !== expectedFilteredEditLocation) {
      throw new Error(`Filtered card edit did not preserve the return query (${filteredEditLocation}).`);
    }
    const filteredEditedDetailPage = await fetchPage(baseUrl, filteredEditLocation);
    if (!filteredEditedDetailPage.includes('href="/?sport=Basketball&amp;sort=valueDesc"')) {
      throw new Error("Filtered card edit result does not return to the preserved home filter query.");
    }

    db = new DatabaseSync(dbPath, { readOnly: true });
    const filteredValuation = db.prepare("SELECT id FROM CardValuation WHERE cardId = ? ORDER BY valuedAt DESC, updatedAt DESC LIMIT 1").get(cardId);
    db.close();
    if (!filteredValuation?.id) {
      throw new Error("Filtered financial history test could not find a valuation record.");
    }
    const filteredHistoryEditForm = new FormData();
    appendActionFieldsForMarker(filteredHistoryEditForm, filteredEditedDetailPage, `value="valuation-${filteredValuation.id}"`);
    filteredHistoryEditForm.append("amount", "190.25");
    filteredHistoryEditForm.append("currency", "CNY");
    filteredHistoryEditForm.append("valuedAt", "2026-08-10");
    filteredHistoryEditForm.append("source", "近期成交");
    filteredHistoryEditForm.append("notes", "Filtered financial history regression test.");
    const filteredHistoryEditResponse = await fetch(`${baseUrl}${filteredEditLocation}`, {
      method: "POST",
      body: filteredHistoryEditForm,
      redirect: "manual"
    });
    const filteredHistoryEditLocation = filteredHistoryEditResponse.headers.get("location") || "";
    const expectedFilteredHistoryEditLocation = `/cards/${cardId}?success=history-updated&returnTo=${encodeURIComponent("/?sport=Basketball&sort=valueDesc")}#financial-history`;
    if (filteredHistoryEditResponse.status !== 303 || filteredHistoryEditLocation !== expectedFilteredHistoryEditLocation) {
      throw new Error(`Filtered financial history edit did not preserve the return query (${filteredHistoryEditLocation}).`);
    }
    const filteredHistoryEditedDetailPage = await fetchPage(baseUrl, filteredHistoryEditLocation);
    if (!filteredHistoryEditedDetailPage.includes('href="/?sport=Basketball&amp;sort=valueDesc"')) {
      throw new Error("Filtered financial history edit result does not return to the preserved home filter query.");
    }
    db = new DatabaseSync(dbPath, { readOnly: true });
    const filteredEditedValuation = db.prepare("SELECT amountMinor, source FROM CardValuation WHERE id = ?").get(filteredValuation.id);
    db.close();
    if (filteredEditedValuation?.amountMinor !== 19025 || filteredEditedValuation?.source !== "近期成交") {
      throw new Error("Filtered financial history edit did not persist the expected valuation changes.");
    }
    const analysisResponse = await fetch(`${baseUrl}/api/ai/portfolio-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: { sport: "Basketball", sort: "valueDesc", unknown: "drop me" } })
    });
    const analysisPayload = await analysisResponse.json();
    if (
      analysisResponse.status !== 400 ||
      analysisPayload?.snapshot?.cardCount !== 1 ||
      analysisPayload?.snapshot?.scope?.criteria?.length !== 1 ||
      analysisPayload?.snapshot?.scope?.criteria?.[0]?.field !== "sport"
    ) {
      throw new Error(`Portfolio analysis did not build a trusted server-side snapshot before AI configuration validation.\n${JSON.stringify(analysisPayload).slice(0, 500)}`);
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
