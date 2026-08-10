const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { execFileSync, spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const rootDir = path.resolve(__dirname, "..");
const initDbScriptPath = path.join(rootDir, "scripts", "init-db.js");
const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

function assertIncludes(html, expected, label) {
  if (!html.includes(expected)) {
    throw new Error(`${label} does not contain expected text: ${expected}`);
  }
}

function fileDatabaseUrl(filePath) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(findAvailablePort(startPort + 1)));
    server.listen({ host: "127.0.0.1", port: startPort }, () => {
      server.close(() => resolve(startPort));
    });
  });
}

async function waitForServer(baseUrl, output, serverProcess) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Share flow server exited with code ${serverProcess.exitCode}.\n${output.join("")}`);
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

  throw new Error(`Timed out waiting for the share flow server.\n${output.join("")}`);
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

function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  try {
    serverProcess.kill();
  } catch {
    // The server may have exited while the test was cleaning up.
  }

  try {
    if (process.platform === "win32") {
      execFileSync("taskkill.exe", ["/pid", String(serverProcess.pid), "/t", "/f"], {
        stdio: "ignore",
        timeout: 3000
      });
    }
  } catch {
    // The server may have exited while the test was cleaning up.
  }
}

function removeTempRoot(tempRoot) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      return;
    } catch {
      const waitUntil = Date.now() + 200;
      while (Date.now() < waitUntil) {
        // Give Windows time to release SQLite and Next.js file handles.
      }
    }
  }

  console.warn(`Unable to remove temporary E2E directory: ${tempRoot}`);
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

    execFileSync(process.execPath, [initDbScriptPath], {
      cwd: rootDir,
      env: testEnv,
      stdio: "pipe"
    });
    seedDatabase(dbPath, dataDir);

    serverProcess = spawn(process.execPath, [nextCliPath, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: rootDir,
      env: testEnv,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    serverProcess.stdout.on("data", (chunk) => output.push(chunk.toString()));
    serverProcess.stderr.on("data", (chunk) => output.push(chunk.toString()));

    await waitForServer(baseUrl, output, serverProcess);

    const sharesPage = await fetchPage(baseUrl, "/shares");
    assertIncludes(sharesPage, "E2E 分享展馆", "分享列表页");

    const newSharePage = await fetchPage(baseUrl, "/shares/new");
    assertIncludes(newSharePage, "新建分享集", "新建分享集页面");
    assertIncludes(newSharePage, "选择球星卡", "分享向导第一步");
    assertIncludes(newSharePage, "内容修改", "分享向导内容修改步骤");
    assertIncludes(newSharePage, "沉浸舞台", "沉浸舞台版式");
    assertIncludes(newSharePage, "典藏档案", "典藏档案版式");
    assertIncludes(newSharePage, "竞技主场", "竞技主场版式");
    assertIncludes(newSharePage, "足球赛场", "运动主题选项");
    assertIncludes(newSharePage, "F1 维修区", "F1 主题选项");
    assertIncludes(newSharePage, "蓝黑军团-1", "球队主题选项");
    assertIncludes(newSharePage, "蓝黑军团-2", "球队主题选项");
    assertIncludes(newSharePage, "分享展馆编辑工作台", "编辑器 2.0 工作台");
    assertIncludes(newSharePage, "基本内容", "编辑器 2.0 内容分区");
    assertIncludes(newSharePage, "视觉设计", "编辑器 2.0 视觉分区");
    assertIncludes(newSharePage, "桌面", "编辑器 2.0 桌面预览");
    assertIncludes(newSharePage, "手机", "编辑器 2.0 手机预览");

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

    const exportPage = await fetchPage(baseUrl, "/shares/e2e-share-1/export");
    assertIncludes(exportPage, "生成静态分享包", "静态导出入口");
    assertIncludes(exportPage, "生成云端发布包", "云端发布入口");
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
        .prepare("SELECT title, subtitle FROM ShareCollection WHERE id = ?")
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

    console.log("Share flow HTTP E2E passed: list, new, edit save, preview, and export routes.");
  } finally {
    stopServer(serverProcess);
    removeTempRoot(tempRoot);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
