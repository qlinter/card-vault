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

function assertIncludes(html, expected, label) {
  if (!html.includes(expected)) {
    throw new Error(`${label} does not contain expected text: ${expected}`);
  }
}

function shareActionFields(html) {
  const shareForm = html.match(/<form class="share-form"[\s\S]*?<\/form>/)?.[0];
  if (!shareForm) {
    throw new Error("Share edit page does not contain the expected form.");
  }

  const fields = [...shareForm.matchAll(/<input type="hidden" name="(\$ACTION_[^"]+)"(?: value="([^"]*)")?\/>/g)]
    .map((match) => [match[1], decodeHtmlAttribute(match[2])]);
  if (fields.length === 0) {
    throw new Error("Share edit form does not contain a Server Action reference.");
  }
  return fields;
}

function formActionFields(html, submitLabel) {
  const form = [...html.matchAll(/<form[\s\S]*?<\/form>/g)]
    .map((match) => match[0])
    .find((candidate) => candidate.includes(submitLabel));
  if (!form) {
    throw new Error(`Page does not contain the form for: ${submitLabel}`);
  }
  const fields = [...form.matchAll(/<input type="hidden" name="(\$ACTION_[^"]+)"(?: value="([^"]*)")?\/>/g)]
    .map((match) => [match[1], decodeHtmlAttribute(match[2])]);
  if (fields.length === 0) {
    throw new Error(`Form does not contain a Server Action reference: ${submitLabel}`);
  }
  return fields;
}

async function submitExport(baseUrl, html, submitLabel, exportMode) {
  const formData = new FormData();
  for (const [name, value] of formActionFields(html, submitLabel)) {
    formData.append(name, value);
  }
  formData.append("exportMode", exportMode);
  return fetch(`${baseUrl}/shares/e2e-share-1/export`, {
    method: "POST",
    body: formData,
    redirect: "manual"
  });
}

async function submitShareEdit(baseUrl, editPage) {
  const formData = new FormData();
  for (const [name, value] of shareActionFields(editPage)) {
    formData.append(name, value);
  }

  const fields = {
    cardIds: "e2e-card-1",
    title: "E2E 编辑后分享展馆",
    theme: "archive",
    layout: "archive",
    backgroundPositionX: "45",
    backgroundPositionY: "50",
    panelOpacity: "18",
    typography: "editorial",
    density: "compact",
    imageFit: "contain",
    textScale: "large",
    coverMode: "auto",
    subtitle: "编辑后副标题",
    description: "编辑后简介。",
    themeNarrative: "编辑后叙事。",
    themeHighlights: "",
    groupNotes: "",
    sectionsJson: JSON.stringify([
      {
        id: "e2e-section-1",
        title: "编辑后章节",
        description: "编辑后章节说明。",
        layout: "grid",
        cardIds: ["e2e-card-1"]
      }
    ]),
    "sortOrder-e2e-card-1": "1",
    "displayTitle-e2e-card-1": "编辑后展示标题",
    "displayDescription-e2e-card-1": "编辑后展示描述。"
  };
  for (const [name, value] of Object.entries(fields)) {
    formData.append(name, value);
  }

  return fetch(`${baseUrl}/shares/e2e-share-1/edit`, {
    method: "POST",
    body: formData,
    redirect: "manual"
  });
}

function seedDatabase(dbPath, dataDir) {
  const uploadsDir = path.join(dataDir, "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(
    path.join(uploadsDir, "e2e-card.png"),
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
  );

  const db = new DatabaseSync(dbPath);
  try {
    db.prepare(`
      INSERT INTO Card (
        id, playerName, cardTitle, sport, team, year, brand, visibility,
        collectionStatus, publicDescription
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "e2e-card-1",
      "E2E 球员",
      "E2E 精选卡",
      "篮球",
      "E2E Team",
      "2026",
      "E2E Brand",
      "public",
      "holding",
      "用于分享流程回归测试的公开描述。"
    );
    db.prepare("INSERT INTO CardImage (id, cardId, path) VALUES (?, ?, ?)").run(
      "e2e-image-1",
      "e2e-card-1",
      "/media/e2e-card.png"
    );
    db.prepare(`
      INSERT INTO ShareCollection (id, title, subtitle, slug, theme, presentationConfig, description, themeNarrative)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "e2e-share-1",
      "E2E 分享展馆",
      "回归测试副标题",
      "e2e-share",
      "archive",
      '{"version":1,"layout":"archive","backgroundPosition":{"x":45,"y":50},"panelOpacity":18}',
      "回归测试简介。",
      "回归测试叙事。"
    );
    db.prepare(`
      INSERT INTO ShareSection (id, shareCollectionId, title, description, layout, sortOrder)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run("e2e-section-1", "e2e-share-1", "E2E 策展章节", "章节回归测试。", "rail", 0);
    db.prepare(`
      INSERT INTO ShareCollectionItem (id, shareCollectionId, cardId, sectionId, sortOrder, displayTitle, displayDescription)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "e2e-item-1",
      "e2e-share-1",
      "e2e-card-1",
      "e2e-section-1",
      0,
      "E2E 展示标题",
      "E2E 展示描述。"
    );
  } finally {
    db.close();
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-share-e2e-"));
  const dataDir = path.join(tempRoot, "data");
  const dbPath = path.join(dataDir, "dev.db");
  const port = await findAvailablePort(3310);
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
    seedDatabase(dbPath, dataDir);

    serverProcess = startTestServer(port, testEnv, output);
    await waitForServer(baseUrl, output, serverProcess, "Share flow");

    const sharesPage = await fetchPage(baseUrl, "/shares");
    assertIncludes(sharesPage, "E2E 分享展馆", "分享列表页");
    if (sharesPage.includes("创建球星卡精品展馆")) {
      throw new Error("Share list still contains the removed helper copy.");
    }

    const newSharePage = await fetchPage(baseUrl, "/shares/new");
    assertIncludes(newSharePage, "新建分享集", "新建分享集页面");
    assertIncludes(newSharePage, "选择球星卡", "分享向导第一步");
    assertIncludes(newSharePage, "内容修改", "分享向导内容修改步骤");
    assertIncludes(newSharePage, "沉浸舞台", "沉浸舞台版式");
    assertIncludes(newSharePage, "典藏档案", "典藏档案版式");
    assertIncludes(newSharePage, "竞技主场", "竞技主场版式");
    assertIncludes(newSharePage, "足球赛场", "运动主题选项");
    assertIncludes(newSharePage, "F1 维修区", "F1 主题选项");
    assertIncludes(newSharePage, "蓝黑军团-1", "Team 主题选项");
    assertIncludes(newSharePage, "蓝黑军团-2", "Team 主题选项");
    assertIncludes(newSharePage, "分享展馆编辑工作台", "编辑器 2.0 工作台");
    assertIncludes(newSharePage, "基础内容", "编辑器 2.0 内容分区");
    assertIncludes(newSharePage, "视觉设计", "编辑器 2.0 视觉分区");
    assertIncludes(newSharePage, "桌面", "编辑器 2.0 桌面预览");
    assertIncludes(newSharePage, "手机", "编辑器 2.0 手机预览");
    assertIncludes(newSharePage, "撤销", "编辑器 2.0 撤销入口");
    assertIncludes(newSharePage, "重做", "编辑器 2.0 重做入口");
    assertIncludes(newSharePage, "字体风格", "编辑器 2.0 排版选项");
    assertIncludes(newSharePage, "文字大小", "编辑器 2.0 字号选项");
    assertIncludes(newSharePage, "内容密度", "编辑器 2.0 密度选项");
    assertIncludes(newSharePage, "图片构图", "编辑器 2.0 图片构图选项");

    const editPage = await fetchPage(baseUrl, "/shares/e2e-share-1/edit");
    assertIncludes(editPage, "编辑分享集", "分享集编辑页");
    assertIncludes(editPage, "E2E 球员", "编辑页已选卡片");

    const previewPage = await fetchPage(baseUrl, "/shares/e2e-share-1/preview");
    assertIncludes(previewPage, "E2E 分享展馆", "分享集预览页标题");
    assertIncludes(previewPage, "E2E 展示标题", "分享集预览页展示覆盖");
    assertIncludes(previewPage, "Card Vault 展馆", "分享集预览页品牌标识");
    assertIncludes(previewPage, "theme-archive layout-archive", "分享集预览页主题与版式");
    assertIncludes(previewPage, "E2E 策展章节", "分享集预览页结构化章节");
    assertIncludes(previewPage, "share-preview-frame-shell", "统一渲染预览容器");
    assertIncludes(previewPage, 'data-preview-card=&quot;e2e-card-1&quot;', "应用预览内嵌单卡入口");
    assertIncludes(previewPage, 'data-preview-detail=&quot;e2e-card-1&quot;', "应用预览内嵌单卡详情");
    if (previewPage.includes('href=&quot;#card-e2e-card-1&quot;')) {
      throw new Error("应用预览仍包含会导航 iframe 的片段链接。");
    }

    const exportPage = await fetchPage(baseUrl, "/shares/e2e-share-1/export");
    assertIncludes(exportPage, "生成分享包", "统一分享包入口");
    assertIncludes(exportPage, "通用静态包", "通用静态包选项");
    assertIncludes(exportPage, "Cloudflare Drop 临时预览包", "Cloudflare Drop 临时预览选项");
    assertIncludes(exportPage, "不包含价格、成本", "导出隐私提示");

    const editResponse = await submitShareEdit(baseUrl, editPage);
    if (editResponse.status !== 303 || editResponse.headers.get("location") !== "/shares?success=updated") {
      const responseBody = await editResponse.text();
      throw new Error(
        `Share edit returned HTTP ${editResponse.status} (${editResponse.headers.get("location") ?? "no redirect"}).\n${responseBody.slice(0, 500)}`
      );
    }

    const verifyDb = new DatabaseSync(dbPath);
    try {
      const collection = verifyDb
        .prepare("SELECT title, subtitle, presentationConfig FROM ShareCollection WHERE id = ?")
        .get("e2e-share-1");
      const section = verifyDb
        .prepare("SELECT title, layout FROM ShareSection WHERE shareCollectionId = ?")
        .get("e2e-share-1");
      const item = verifyDb
        .prepare("SELECT displayTitle, sectionId FROM ShareCollectionItem WHERE shareCollectionId = ?")
        .get("e2e-share-1");
      if (collection?.title !== "E2E 编辑后分享展馆" || collection?.subtitle !== "编辑后副标题") {
        throw new Error("Share edit did not persist the collection fields.");
      }
      const presentation = JSON.parse(collection.presentationConfig);
      if (presentation.typography !== "editorial" || presentation.density !== "compact" || presentation.imageFit !== "contain" || presentation.textScale !== "large") {
        throw new Error("Share edit did not persist the Editor 2.0 composition controls.");
      }
      if (section?.title !== "编辑后章节" || section?.layout !== "grid") {
        throw new Error("Share edit did not replace the section fields.");
      }
      if (item?.displayTitle !== "编辑后展示标题" || !item?.sectionId) {
        throw new Error("Share edit did not persist the item fields and section assignment.");
      }
    } finally {
      verifyDb.close();
    }

    const editedPreviewPage = await fetchPage(baseUrl, "/shares/e2e-share-1/preview");
    assertIncludes(editedPreviewPage, "E2E 编辑后分享展馆", "编辑后的分享集预览标题");
    assertIncludes(editedPreviewPage, "编辑后章节", "编辑后的分享集章节");
    assertIncludes(editedPreviewPage, "编辑后展示标题", "编辑后的分享卡片标题");

    const currentExportPage = await fetchPage(baseUrl, "/shares/e2e-share-1/export");
    const staticExportResponse = await submitExport(baseUrl, currentExportPage, "生成分享包", "static");
    const staticExportLocation = staticExportResponse.headers.get("location") ?? "";
    if (staticExportResponse.status !== 303 || !staticExportLocation.includes("success=static")) {
      const responseBody = await staticExportResponse.text();
      throw new Error(`Static export returned HTTP ${staticExportResponse.status} (${staticExportLocation || "no redirect"}).\n${responseBody.slice(0, 500)}`);
    }

    const exportResponse = await submitExport(baseUrl, currentExportPage, "生成分享包", "drop");
    const exportLocation = exportResponse.headers.get("location") ?? "";
    if (exportResponse.status !== 303 || !exportLocation.includes("success=drop")) {
      const responseBody = await exportResponse.text();
      throw new Error(`Cloudflare export returned HTTP ${exportResponse.status} (${exportLocation || "no redirect"}).\n${responseBody.slice(0, 500)}`);
    }

    const exportsDir = path.join(dataDir, "exports");
    const exportFolderName = fs.readdirSync(exportsDir).find((entry) => entry.includes("-drop-") && !entry.endsWith(".zip"));
    if (!exportFolderName) {
      throw new Error("Cloudflare export did not create an export folder.");
    }
    const exportFolder = path.join(exportsDir, exportFolderName);
    for (const relativePath of [
      "index.html",
      "404.html",
      "_headers",
      "robots.txt",
      "publish-manifest.json",
      "CHECK-REPORT.md",
      "README-Cloudflare-Drop.md",
      "cards/e2e-e2e.html"
    ]) {
      if (!fs.existsSync(path.join(exportFolder, relativePath))) {
        throw new Error(`Cloudflare export is missing ${relativePath}.`);
      }
    }
    if (!fs.existsSync(`${exportFolder}.zip`)) {
      throw new Error("Cloudflare export did not create a ZIP archive.");
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(exportFolder, "publish-manifest.json"), "utf8"));
    if (manifest.temporaryPublishing?.provider !== "cloudflare-drop" || manifest.temporaryPublishing?.expiresAfterMinutes !== 60) {
      throw new Error("Cloudflare export manifest does not describe the temporary publishing boundary.");
    }
    const manifestText = JSON.stringify(manifest).toLowerCase();
    if (manifestText.includes("url") || manifestText.includes("claim")) {
      throw new Error("Cloudflare export manifest unexpectedly retains URL or claim data.");
    }
    assertIncludes(fs.readFileSync(path.join(exportFolder, "CHECK-REPORT.md"), "utf8"), "结果：通过", "发布前检查报告");
    assertIncludes(fs.readFileSync(path.join(exportFolder, "index.html"), "utf8"), "noindex, nofollow, noarchive", "临时发布 noindex");

    console.log("Share flow HTTP E2E passed: list, new, edit save, preview, and validated Cloudflare Drop export.");
  } finally {
    stopServer(serverProcess);
    await removeTempRoot(tempRoot);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
