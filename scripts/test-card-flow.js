const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  decodeHtmlAttribute,
  fetchPage,
  fileDatabaseUrl,
  findAvailablePort,
  initializeTestDatabase,
  removeTempRoot,
  startTestServer,
  stopServer,
  waitForServer
} = require("./test-http-flow-utils");

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
    initializeTestDatabase(testEnv);
    serverProcess = startTestServer(port, testEnv, output);
    await waitForServer(baseUrl, output, serverProcess, "Card flow");

    const newPage = await fetchPage(baseUrl, "/cards/new");
    for (const marker of ["录入工作台", "批量录入", "导入并预处理", "保存并查看", "保存并继续", "保存并复制新增", "录入草稿", "模板", "Ctrl + Enter 保存并继续"]) {
      if (!newPage.includes(marker)) {
        throw new Error(`Entry workbench is missing the expected marker: ${marker}`);
      }
    }
    if (
      newPage.includes("填写后将自动保存文字草稿。") ||
      newPage.includes("录入模板") ||
      !newPage.includes("disclosure-icon entry-queue-chevron") ||
      !newPage.includes('class="entry-queue-count">0</span>')
    ) {
      throw new Error("Entry workbench helper copy or queue disclosure icon does not match the compact layout.");
    }

    const settingsPage = await fetchPage(baseUrl, "/settings");
    for (const removedCopy of [
      "管理本地存储、备份恢复、AI 服务和 Card Vault 应用信息。",
      "设置数据库、卡片图片、分享封面和导出文件的本地保存位置，并检查当前存储数据是否完整。",
      "备份会生成 SQLite 一致性快照；恢复前会再次备份当前数据"
    ]) {
      if (settingsPage.includes(removedCopy)) {
        throw new Error(`Settings page still contains removed helper copy: ${removedCopy}`);
      }
    }
    if (!settingsPage.includes('aria-label="展开 AI 设置"') || settingsPage.includes("已配置 Azure OpenAI")) {
      throw new Error("Settings disclosure control does not use the expected compact icon presentation.");
    }

    const showcasePage = await fetchPage(baseUrl, "/showcase");
    if (showcasePage.includes("按球员浏览")) {
      throw new Error("Showcase page still contains the removed browsing heading.");
    }

    const templateResponse = await fetch(`${baseUrl}/api/card-entry/templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "E2E Template",
        values: {
          sport: "Basketball",
          team: "Template Team",
          year: "2026",
          productLine: "Template Product",
          cardNumber: "must-not-persist",
          visibility: "public",
          collectionStatus: "holding",
          tags: "template"
        }
      })
    });
    const templatePayload = await templateResponse.json();
    if (!templateResponse.ok || !templatePayload.template?.id || "cardNumber" in templatePayload.template.values) {
      throw new Error(`Entry template creation mismatch: ${JSON.stringify(templatePayload)}`);
    }
    const templateUseResponse = await fetch(
      `${baseUrl}/api/card-entry/templates/${templatePayload.template.id}/use`,
      { method: "POST" }
    );
    const templateUsePayload = await templateUseResponse.json();
    if (!templateUseResponse.ok || templateUsePayload.template?.useCount !== 1) {
      throw new Error(`Entry template usage mismatch: ${JSON.stringify(templateUsePayload)}`);
    }
    const templateUpdateResponse = await fetch(
      `${baseUrl}/api/card-entry/templates/${templatePayload.template.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "E2E Template Updated",
          values: { sport: "Basketball", team: "Updated Template Team" }
        })
      }
    );
    const templateUpdatePayload = await templateUpdateResponse.json();
    if (
      !templateUpdateResponse.ok ||
      templateUpdatePayload.template?.name !== "E2E Template Updated" ||
      templateUpdatePayload.template?.values?.team !== "Updated Template Team"
    ) {
      throw new Error(`Entry template update mismatch: ${JSON.stringify(templateUpdatePayload)}`);
    }

    const invalidDraftResponse = await fetch(`${baseUrl}/api/card-entry/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "../invalid", values: { playerName: "Invalid" } })
    });
    if (invalidDraftResponse.status !== 400) {
      throw new Error(`Invalid draft id was not rejected (${invalidDraftResponse.status}).`);
    }
    const oversizedDraftResponse = await fetch(`${baseUrl}/api/card-entry/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: { notes: "x".repeat(100_001) } })
    });
    if (oversizedDraftResponse.status !== 413) {
      throw new Error(`Oversized draft was not rejected (${oversizedDraftResponse.status}).`);
    }

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const batchForm = new FormData();
    batchForm.append("label", "E2E Queue Batch");
    batchForm.append("pairingMode", "pairs");
    batchForm.append("images", new Blob([png], { type: "image/png" }), "front.png");
    batchForm.append("images", new Blob([png], { type: "image/png" }), "back.png");
    batchForm.append("images", new Blob([Buffer.from("not-an-image")], { type: "image/png" }), "invalid.png");
    const batchResponse = await fetch(`${baseUrl}/api/card-entry/queue`, {
      method: "POST",
      body: batchForm
    });
    const batchPayload = await batchResponse.json();
    if (
      !batchResponse.ok || batchPayload.itemCount !== 2 ||
      batchPayload.readyCount !== 1 || batchPayload.failedCount !== 1
    ) {
      throw new Error(`Queue batch preprocessing mismatch: ${JSON.stringify(batchPayload)}`);
    }

    let db = new DatabaseSync(dbPath, { readOnly: true });
    const readyQueueItem = db.prepare("SELECT id FROM CardEntryQueueItem WHERE batchId = ? AND status = 'ready'").get(batchPayload.batchId);
    const failedQueueItem = db.prepare("SELECT id, errorMessage FROM CardEntryQueueItem WHERE batchId = ? AND status = 'failed'").get(batchPayload.batchId);
    const processedQueueImages = readyQueueItem
      ? db.prepare("SELECT originalName, processedPath, processedBytes, width, height, side, sortOrder FROM CardEntryQueueImage WHERE itemId = ? ORDER BY sortOrder").all(readyQueueItem.id)
      : [];
    db.close();
    if (
      !readyQueueItem?.id || !failedQueueItem?.id || processedQueueImages.length !== 2 ||
      processedQueueImages.some((image) => !image.processedPath?.endsWith(".webp") || image.processedBytes <= 0 || image.width !== 1 || image.height !== 1)
    ) {
      throw new Error("Queue batch did not isolate failures or persist WebP preprocessing metadata.");
    }
    for (const image of processedQueueImages) {
      if (!fs.existsSync(path.join(dataDir, "uploads", path.basename(image.processedPath)))) {
        throw new Error("Queue preprocessing did not persist an output image.");
      }
    }

    const retryResponse = await fetch(`${baseUrl}/api/card-entry/queue/${failedQueueItem.id}/retry`, { method: "POST" });
    const retryPayload = await retryResponse.json();
    if (!retryResponse.ok || retryPayload.status !== "failed") {
      throw new Error(`Failed queue retry did not remain isolated: ${JSON.stringify(retryPayload)}`);
    }
    const swapResponse = await fetch(`${baseUrl}/api/card-entry/queue/${readyQueueItem.id}/swap`, { method: "POST" });
    if (!swapResponse.ok) {
      throw new Error(`Queue image swap failed: ${(await swapResponse.text()).slice(0, 300)}`);
    }
    db = new DatabaseSync(dbPath, { readOnly: true });
    const swappedFront = db.prepare("SELECT originalName, side FROM CardEntryQueueImage WHERE itemId = ? ORDER BY sortOrder LIMIT 1").get(readyQueueItem.id);
    db.close();
    if (swappedFront?.originalName !== "back.png" || swappedFront?.side !== "front") {
      throw new Error("Queue image swap did not update front/back ordering.");
    }

    db = new DatabaseSync(dbPath);
    db.prepare(`
      INSERT INTO CardEntryRecognition (
        id, itemId, status, suggestionJson, confidenceJson, attemptCount
      ) VALUES (?, ?, 'review', ?, ?, 1)
    `).run(
      "e2e-recognition",
      readyQueueItem.id,
      JSON.stringify({
        playerName: "AI Candidate Player",
        cardTitle: "AI Candidate Card",
        sport: "Basketball",
        cardNumber: "AI-42"
      }),
      JSON.stringify({
        playerName: "high",
        cardTitle: "medium",
        sport: "high",
        cardNumber: "low"
      })
    );
    db.close();
    const recognitionPage = await fetchPage(baseUrl, `/cards/new?queue=${encodeURIComponent(readyQueueItem.id)}`);
    if (
      !recognitionPage.includes('value="AI Candidate Player"') ||
      !recognitionPage.includes('value="AI Candidate Card"') ||
      !recognitionPage.includes("低置信字段：卡号")
    ) {
      throw new Error("Persisted AI candidate was not loaded for explicit review.");
    }

    const draftResponse = await fetch(`${baseUrl}/api/card-entry/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: {
          playerName: "E2E Draft Player",
          cardTitle: "E2E Draft Card",
          sport: "Basketball",
          isRookie: true
        }
      })
    });
    const draftPayload = await draftResponse.json();
    if (!draftResponse.ok || !draftPayload.id) {
      throw new Error(`Draft create returned HTTP ${draftResponse.status}: ${JSON.stringify(draftPayload)}`);
    }
    const draftPage = await fetchPage(baseUrl, `/cards/new?draft=${encodeURIComponent(draftPayload.id)}&queue=${encodeURIComponent(readyQueueItem.id)}`);
    if (
      !draftPage.includes('value="E2E Draft Player"') ||
      !draftPage.includes('value="E2E Draft Card"') ||
      !draftPage.includes("队列预处理图片")
    ) {
      throw new Error("Entry workbench did not restore draft values and queue images together.");
    }

    const createForm = new FormData();
    appendServerActionFields(createForm, draftPage);
    createForm.append("draftId", draftPayload.id);
    createForm.append("queueItemId", readyQueueItem.id);
    createForm.append("saveIntent", "view");
    appendCardFields(createForm, {
      playerName: "E2E Create Player",
      cardTitle: "E2E Create Card",
      grade: "Auto Auth",
      description: "创建流程回归测试。"
    });
    createForm.append("images", new Blob([png], { type: "image/png" }), "card.png");

    const createResponse = await fetch(`${baseUrl}/cards/new`, { method: "POST", body: createForm, redirect: "manual" });
    const createLocation = createResponse.headers.get("location") || "";
    const cardId = createLocation.match(/^\/cards\/([^?]+)\?success=created$/)?.[1];
    if (createResponse.status !== 303 || !cardId) {
      throw new Error(`Card create returned HTTP ${createResponse.status} (${createLocation}).\n${(await createResponse.text()).slice(0, 500)}`);
    }

    db = new DatabaseSync(dbPath, { readOnly: true });
    const created = db.prepare("SELECT playerName, cardTitle, year, grade, totalCost, isSerialNumbered FROM Card WHERE id = ?").get(cardId);
    const createdImages = db.prepare("SELECT path FROM CardImage WHERE cardId = ? ORDER BY createdAt, rowid").all(cardId);
    const createdTransaction = db.prepare("SELECT kind, amountMinor, currency, provenance FROM CardTransaction WHERE cardId = ?").get(cardId);
    const createdExpense = db.prepare("SELECT kind, amountMinor, currency, provenance FROM CardExpense WHERE cardId = ?").get(cardId);
    const createdValuation = db.prepare("SELECT amountMinor, currency, source, provenance FROM CardValuation WHERE cardId = ?").get(cardId);
    const completedDraftCount = Number(db.prepare("SELECT COUNT(*) AS count FROM CardEntryDraft WHERE id = ?").get(draftPayload.id).count);
    const completedQueueCount = Number(db.prepare("SELECT COUNT(*) AS count FROM CardEntryQueueItem WHERE id = ?").get(readyQueueItem.id).count);
    const completedRecognitionCount = Number(db.prepare("SELECT COUNT(*) AS count FROM CardEntryRecognition WHERE itemId = ?").get(readyQueueItem.id).count);
    db.close();
    if (created?.playerName !== "E2E Create Player" || created?.year !== "2016-17" || created?.grade !== "Auto Auth" || created?.totalCost !== 120 || created?.isSerialNumbered !== 1) {
      throw new Error("Card create did not persist the expected fields.");
    }
    if (
      createdImages.length !== 3 ||
      createdImages.some((image) => !fs.existsSync(path.join(dataDir, "uploads", path.basename(image.path))))
    ) {
      throw new Error("Card create did not atomically adopt queue images and persist the appended upload.");
    }
    if (
      createdTransaction?.kind !== "purchase" || createdTransaction?.amountMinor !== 10000 ||
      createdExpense?.kind !== "grading" || createdExpense?.amountMinor !== 2000 ||
      createdValuation?.amountMinor !== 18000 || createdValuation?.source !== "个人估计" ||
      createdTransaction?.provenance !== "initial_card_entry"
    ) {
      throw new Error("Card create did not persist the expected initial financial history.");
    }
    if (completedDraftCount !== 0) {
      throw new Error("Card create did not atomically remove the completed entry draft.");
    }
    if (completedQueueCount !== 0) {
      throw new Error("Card create did not atomically consume the completed queue item.");
    }
    if (completedRecognitionCount !== 0) {
      throw new Error("Card create did not remove the consumed AI recognition candidate.");
    }

    const duplicateResponse = await fetch(`${baseUrl}/api/card-entry/duplicates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: {
          playerName: "E2E Create Player",
          year: "2016-17",
          brand: "Test Brand",
          productLine: "Test Product",
          cardNumber: "42",
          parallel: "Gold"
        }
      })
    });
    const duplicatePayload = await duplicateResponse.json();
    if (
      !duplicateResponse.ok ||
      duplicatePayload.candidates?.[0]?.id !== cardId ||
      duplicatePayload.candidates[0].level !== "high"
    ) {
      throw new Error(`Duplicate candidate mismatch: ${JSON.stringify(duplicatePayload)}`);
    }
    const templateDeleteResponse = await fetch(
      `${baseUrl}/api/card-entry/templates/${templatePayload.template.id}`,
      { method: "DELETE" }
    );
    if (!templateDeleteResponse.ok) {
      throw new Error(`Entry template deletion failed: ${(await templateDeleteResponse.text()).slice(0, 300)}`);
    }

    const deleteFailedQueueResponse = await fetch(`${baseUrl}/api/card-entry/queue/${failedQueueItem.id}`, { method: "DELETE" });
    if (!deleteFailedQueueResponse.ok) {
      throw new Error(`Failed queue item could not be removed: ${(await deleteFailedQueueResponse.text()).slice(0, 300)}`);
    }
    db = new DatabaseSync(dbPath, { readOnly: true });
    const completedBatchCount = Number(db.prepare("SELECT COUNT(*) AS count FROM CardEntryBatch WHERE id = ?").get(batchPayload.batchId).count);
    db.close();
    if (completedBatchCount !== 0) {
      throw new Error("Empty queue batch was not cleaned up after its final item was removed.");
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
    if (imageCount !== 3) {
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
    const entryReturnTo = "/cards/new?draft=e2e-return-draft&queue=e2e-return-queue";
    const duplicateDetailPage = await fetchPage(
      baseUrl,
      `/cards/${cardId}?returnTo=${encodeURIComponent(entryReturnTo)}`
    );
    if (!duplicateDetailPage.includes('href="/cards/new?draft=e2e-return-draft&amp;queue=e2e-return-queue"')) {
      throw new Error("Duplicate-card detail does not return to the active entry workbench context.");
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
    console.log("Card flow HTTP E2E passed: drafts, templates, image queue, AI candidates, duplicates, create, edit, and detail routes.");
  } finally {
    stopServer(serverProcess);
    await removeTempRoot(tempRoot);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
