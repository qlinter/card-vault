import { expect, test } from "@playwright/test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

function fixture(action) {
  const db=new DatabaseSync(path.resolve("tests/.ui-test-runtime/data/dev.db"));
  try { db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");return action(db); } finally {db.close();}
}
const title="Entry finance v134 test";
test.afterEach(async ({ page, request, baseURL }) => {
  const draft=new URL(page.url()).searchParams.get("draft");
  await page.goto("about:blank");
  if(draft) await request.delete(`/api/card-entry/drafts/${draft}`,{headers:{Origin:baseURL}});
  fixture(db=>db.prepare("DELETE FROM Card WHERE cardTitle=?").run(title));
});
async function addRecord(page,type) {
  await page.getByRole("button",{name:"＋ 新增记录",exact:true}).click();
  await page.locator(".entry-financial-record-types").getByRole("button",{name:type,exact:true}).click();
  return page.locator(".entry-financial-record").last();
}
async function fill(record,key,value) { await record.locator(`[name$=".${key}"]`).fill(value); }

test("entry saves supplementary finance and sale links atomically after draft recovery",async({page})=>{
  await page.goto("/cards/new",{waitUntil:"networkidle"});
  await page.locator('[name="playerName"]').fill("Entry Test");
  await page.locator('[name="cardTitle"]').fill(title);
  await page.locator('[name="sport"]').fill("Basketball");
  await page.locator('[name="purchaseDate"]').fill("2026-01-01");
  await page.locator('[name="initialQuantity"]').fill("2");
  await page.locator('[name="purchasePrice"]').fill("100");
  await page.locator('[name="gradingFee"]').fill("5");
  let row=await addRecord(page,"交易");
  await row.locator('[name$=".kind"]').selectOption("sale");
  await fill(row,"amount","150");await fill(row,"quantity","1");await fill(row,"occurredAt","2026-02-01");await fill(row,"source","market");await fill(row,"notes","sale note");
  const saleId=await row.locator('[name="financialRecordId"]').inputValue();
  row=await addRecord(page,"费用");
  await row.locator('[name$=".context"]').selectOption("sale");
  await row.locator('[name$=".kind"]').selectOption("shipping");
  await fill(row,"amount","10");await fill(row,"occurredAt","2026-02-02");
  await row.locator('[name$=".transactionId"]').selectOption(saleId);
  row=await addRecord(page,"估值");
  await fill(row,"amount","-1");await fill(row,"valuedAt","2026-03-01");
  const removed = await addRecord(page,"费用");
  await removed.getByRole("button",{name:"删除",exact:true}).click();
  await expect(page.locator(".entry-financial-record")).toHaveCount(3);
  await expect(page.locator(".entry-draft-status")).toContainText("草稿已保存");
  await page.reload({waitUntil:"networkidle"});
  await expect(page.locator(".entry-financial-record")).toHaveCount(3);
  await expect(page.locator('[name$=".transactionId"]')).toHaveValue(saleId);
  await expect(page.locator('.entry-financial-record').first().locator('[name$=".notes"]')).toHaveValue("sale note");
  await page.screenshot({path:"logs/entry-refinement-20260918/v134-entry-finance.png",fullPage:true});
  await page.locator('.card-entry-form [name="images"]').setInputFiles({name:"finance.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64")});
  await page.getByRole("button",{name:"保存并查看",exact:true}).click();
  await expect(page.locator(".note-error")).toBeVisible();
  expect(fixture(db=>db.prepare("SELECT COUNT(*) AS count FROM Card WHERE cardTitle=?").get(title).count)).toBe(0);
  await expect(page.locator(".entry-financial-record")).toHaveCount(3);
  await fill(page.locator(".entry-financial-record").last(),"amount","90");
  await page.getByRole("button",{name:"保存并查看",exact:true}).click();
  await expect(page).toHaveURL(/\/cards\/[^/?]+\?success=created/);
  const saved=fixture(db=>{
    const card=db.prepare("SELECT id,holdingQuantity FROM Card WHERE cardTitle=?").get(title);
    return {card,transactions:db.prepare("SELECT * FROM CardTransaction WHERE cardId=?").all(card.id),expenses:db.prepare("SELECT * FROM CardExpense WHERE cardId=?").all(card.id),valuations:db.prepare("SELECT * FROM CardValuation WHERE cardId=?").all(card.id)};
  });
  expect(saved.card.holdingQuantity).toBe(1);expect(saved.transactions).toHaveLength(2);expect(saved.expenses).toHaveLength(2);expect(saved.valuations).toHaveLength(1);
  expect(saved.expenses.find(row=>row.context==="sale").transactionId).toBe(saved.transactions.find(row=>row.kind==="sale").id);
  expect(saved.valuations[0].amountMinor).toBe(9000);
});

test("valuation visibility persists across filters and reloads",async({page})=>{
  await page.goto("/",{waitUntil:"networkidle"});
  await expect(page.locator(".valuation-total-list")).toContainText("CNY");
  await expect(page.getByTestId("home-portfolio-link")).toHaveCount(0);
  await page.getByRole("button",{name:"隐藏估值",exact:true}).click();
  await expect(page.locator(".valuation-total-list")).toHaveText("••••••");
  await page.goto("/?sport=Basketball",{waitUntil:"networkidle"});
  await expect(page.locator(".valuation-total-list")).toHaveText("••••••");
  await page.reload({waitUntil:"networkidle"});
  await expect(page.locator(".valuation-total-list")).toHaveText("••••••");
  await page.getByRole("button",{name:"显示估值",exact:true}).click();
  await expect(page.locator(".valuation-total-list")).toContainText("CNY");
});

test("invalid supplementary finance cannot overwrite a recoverable draft",async({request,baseURL})=>{
  const headers={Origin:baseURL};
  const created=await request.post("/api/card-entry/drafts",{headers,data:{values:{cardTitle:title,financialRecords:"[]"}}});
  expect(created.ok()).toBeTruthy();
  const {id}=await created.json();
  try {
    const rejected=await request.post("/api/card-entry/drafts",{headers,data:{id,values:{cardTitle:title,financialRecords:'{"invalid":true}'}}});
    expect(rejected.ok()).toBeFalsy();
    const saved=fixture(db=>db.prepare("SELECT valuesJson FROM CardEntryDraft WHERE id=?").get(id));
    expect(JSON.parse(saved.valuesJson).financialRecords).toBe("[]");
  } finally {await request.delete(`/api/card-entry/drafts/${id}`,{headers});}
});
