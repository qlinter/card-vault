import { expect, test } from "@playwright/test";
import { withUiDatabase } from "./database-fixture.mjs";

const id = "inventory-boundary";
const url = "/cards/"+id;
function seed(kind = "gift_in", quantity = 1, date = "2026-01-01T00:00:00Z") {
  withUiDatabase(db => {
    db.prepare("INSERT INTO Card(id,playerName,cardTitle,sport,holdingQuantity) VALUES(?, 'Inventory', 'Verification', 'Football', ?)").run(id,quantity);
    db.prepare("INSERT INTO CardImage(id,cardId,path) VALUES('boundary-img',?,'/media/ui-card-1.webp')").run(id);
    db.prepare("INSERT INTO CardTransaction(id,cardId,kind,amountMinor,quantity,occurredAt,provenance) VALUES('boundary-in',?,?,0,?,?,'initial_card_entry')").run(id,kind,quantity,Date.parse(date));
  });
}
const stored = () => withUiDatabase(db => db.prepare("SELECT holdingQuantity,collectionStatus,(SELECT COUNT(*) FROM CardTransaction WHERE cardId=?) trades FROM Card WHERE id=?").get(id,id));
test.afterEach(() => withUiDatabase(db=>db.prepare("DELETE FROM Card WHERE id=?").run(id)));

async function out(page, day, quantity = "1") {
  await page.goto(url);
  await page.getByRole("button",{name:"新增财务记录"}).click();
  await page.getByRole("combobox",{name:"录入类型"}).selectOption("gift_out");
  const form = page.locator("#financial-add-record form:visible");
  await form.locator("[name=quantity]").fill(quantity);
  const date = form.locator("[name=occurredAt]");
  await date.fill(day);
  // Exercise the server rule even if the browser normally prevents submission.
  await date.evaluate(el=>el.removeAttribute("max"));
  await form.getByRole("button",{name:"保存交易"}).click();
  return form;
}

test("same-day gifts consume intraday legacy acquisitions; the disposal sets the closed status",async({page})=>{
  seed("purchase",1,"2026-09-07T04:00:00Z");
  await out(page,"2026-09-07");
  await expect(page).toHaveURL(/success=history-added/);
  expect(stored()).toEqual({holdingQuantity:0,collectionStatus:"gifted",trades:2});
  await page.goto(url+"/edit");
  const select=page.locator("[name=collectionStatus]");
  await expect(select.locator("option[value=sold]")).toHaveJSProperty("disabled",true);
  await select.locator("option[value=sold]").evaluate(el=>el.disabled=false);
  await select.selectOption("sold");
  await page.getByRole("button",{name:"保存修改",exact:true}).click();
  await expect(page.locator(".note-error")).toContainText("清仓状态由最后一笔转出流水决定");
  expect(stored().collectionStatus).toBe("gifted");
});

test("future and oversized gifts leave holdings intact",async({page})=>{
  seed();
  const future = await out(page,"2099-01-01");
  await expect(future.getByRole("alert")).toContainText("交易日期不能晚于今天");
  const oversized = await out(page,"2026-02-01","2");
  await expect(oversized.getByRole("alert")).toContainText("可赠送 1 张");
  expect(stored()).toEqual({holdingQuantity:1,collectionStatus:"holding",trades:1});
});

test("the last acquisition can be corrected but deleting it cannot strand holdings",async({page})=>{
  seed("gift_in",3);
  await page.goto(url);
  const history=page.locator(".financial-history-details");
  await history.locator("summary").click();
  await history.getByRole("button",{name:"编辑",exact:true}).click();
  const remove=history.getByRole("button",{name:"删除这条记录"});
  await expect(remove).toBeDisabled();
  await expect(history).toContainText("当前持仓的唯一来源");
  await remove.evaluate(el=>el.disabled=false);
  await remove.click();
  await expect(page.locator(".note-error")).toContainText("当前持仓的唯一来源");
  expect(stored()).toEqual({holdingQuantity:3,collectionStatus:"holding",trades:1});
  await page.goto(url);
  await history.locator("summary").click();
  await history.getByRole("button",{name:"编辑",exact:true}).click();
  await history.locator("[name=quantity]").fill("2");
  await history.getByRole("button",{name:"保存修改"}).click();
  await expect(page).toHaveURL(/success=history-updated/);
  expect(stored().holdingQuantity).toBe(2);
});
