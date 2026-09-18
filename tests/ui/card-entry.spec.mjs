import { expect, test } from "@playwright/test";

test.afterEach(async ({ page, request, baseURL }) => {
  const draftId = new URL(page.url()).searchParams.get("draft");
  if (!draftId) return;
  await page.goto("about:blank");
  const response = await request.delete(`/api/card-entry/drafts/${encodeURIComponent(draftId)}`, {
    headers: { Origin: baseURL }
  });
  expect(response.ok()).toBeTruthy();
});

test("Home shows a sort prompt while keeping newest and financial ordering available", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const sort = page.getByRole("combobox", { name: "排序", exact: true });
  await expect(sort).toHaveValue("");
  await expect(sort.locator("option:checked")).toHaveText("排序");
  await expect(sort.locator('option[value="newest"]')).toHaveText("最新录入");
  await sort.selectOption("costCnyAsc");
  await page.locator('form[method="get"] button[type="submit"]').click();
  await expect(page).toHaveURL(/sort=costCnyAsc/);
  await expect(page.getByRole("combobox", { name: "排序", exact: true })).toHaveValue("costCnyAsc");
});

test("entry types update attributes immediately within ordered sections", async ({ page }) => {
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  const form = page.locator('[data-card-entry-form="true"]');
  const numbered = form.locator('[name="isSerialNumbered"]');
  await expect(numbered).not.toBeChecked();
  await form.locator('[name="serialNumber"]').fill("12");
  await expect(numbered).toBeChecked();
  await numbered.click();
  await expect(numbered).toBeChecked();
  await form.locator('[name="serialNumber"]').fill("");
  await numbered.uncheck();
  await form.locator('[name="serialRange"]').fill("/99");
  await expect(numbered).toBeChecked();
  await form.locator('[name="serialRange"]').fill("");
  await numbered.uncheck();
  await numbered.check();
  await expect(numbered).toBeChecked();
  for (const [field, attribute, value] of [["autoType", "isAutograph", "on-card"], ["patchType", "isPatch", "logo patch"]]) {
    const input = form.locator(`[name="${field}"]`);
    const checkbox = form.locator(`[name="${attribute}"]`);
    await expect(checkbox).not.toBeChecked();
    await input.fill("   ");
    await expect(checkbox).not.toBeChecked();
    await input.fill(value);
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await input.fill("");
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  }
  await expect(form.locator(".form-section-heading h2")).toHaveText(["卡片信息", "评级信息", "财务记录"]);
  const position = async selector => (await form.locator(selector).boundingBox()).y;
  expect(await position('[name="patchType"]')).toBeLessThan(await position(".card-attribute-options"));
  expect(await position(".card-attribute-options")).toBeLessThan(await position('[name="gradingCompany"]'));
  const options = await form.locator(".card-attribute-options input").evaluateAll(elements => elements.map(element => ({ name: element.name, y: element.getBoundingClientRect().top })));
  expect(options.map(item => item.name)).toEqual(["isSerialNumbered", "isAutograph", "isPatch", "isRookie"]);
  expect(Math.max(...options.map(item => item.y)) - Math.min(...options.map(item => item.y))).toBeLessThan(1);
  await expect(form.getByRole("button", { name: "保存并复制新增" })).toHaveCount(0);
  await expect(form.getByRole("button", { name: "保存并继续", exact: true })).toBeVisible();
  await expect(form.locator('[name="autoType"]')).not.toHaveAttribute("placeholder");
  await expect(form.locator('[name="patchType"]')).not.toHaveAttribute("placeholder");
  await expect(form.locator('[name="publicDescription"]')).not.toHaveAttribute("placeholder");
  await expect(page.locator(".entry-draft-status")).toContainText("草稿已保存");
});

test("AI suggestions and restored drafts visibly select matching attributes", async ({ page }) => {
  await page.route("**/api/ai/recognize-card", route => route.fulfill({ json: { suggestion: { serialRange: "/25", autoType: "on-card", patchType: "logo patch" } } }));
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  await page.getByLabel("识别图片", { exact: true }).setInputFiles({ name: "front.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
  await page.getByRole("button", { name: "识别并填入", exact: true }).click();
  const numbered = page.locator('[name="isSerialNumbered"]');
  await expect(page.locator('[name="serialRange"]')).toHaveValue("/25");
  await expect(numbered).toBeChecked();
  await expect(page.locator('[name="isAutograph"]')).toBeChecked();
  await expect(page.locator('[name="isPatch"]')).toBeChecked();
  await expect(page).toHaveURL(/draft=/);
  await expect(page.locator(".entry-draft-status")).toContainText("草稿已保存");
  await page.reload({ waitUntil: "networkidle" });
  await expect(numbered).toBeChecked();
  await expect(page.locator('[name="serialRange"]')).toHaveValue("/25");
  await expect(page.locator('[name="autoType"]')).toHaveValue("on-card");
  await expect(page.locator('[name="patchType"]')).toHaveValue("logo patch");
  await expect(page.locator('[name="isAutograph"]')).toBeChecked();
  await expect(page.locator('[name="isPatch"]')).toBeChecked();
});

test("changing recognition images clears previous inferred attributes", async ({ page }) => {
  await page.goto("/cards/new", { waitUntil: "networkidle" });
  for (const [name, value] of [["serialRange", "/25"], ["autoType", "on-card"], ["patchType", "logo patch"]]) {
    await page.locator(`[name="${name}"]`).fill(value);
  }
  for (const name of ["isSerialNumbered", "isAutograph", "isPatch"]) await expect(page.locator(`[name="${name}"]`)).toBeChecked();
  await expect(page).toHaveURL(/draft=/);
  const clearedDraftSaved = page.waitForResponse(response => response.url().endsWith("/api/card-entry/drafts") && response.request().postDataJSON()?.values?.serialRange === "");
  await page.getByLabel("识别图片", { exact: true }).setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
  for (const name of ["isSerialNumbered", "isAutograph", "isPatch"]) await expect(page.locator(`[name="${name}"]`)).not.toBeChecked();
  for (const name of ["serialRange", "autoType", "patchType"]) await expect(page.locator(`[name="${name}"]`)).toHaveValue("");
  expect((await clearedDraftSaved).ok()).toBeTruthy();
  await page.reload({ waitUntil: "networkidle" });
  for (const name of ["isSerialNumbered", "isAutograph", "isPatch"]) await expect(page.locator(`[name="${name}"]`)).not.toBeChecked();
});
