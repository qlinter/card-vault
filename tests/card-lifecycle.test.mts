import test from "node:test";
import assert from "node:assert/strict";
import { cardLifecycle } from "../lib/card-lifecycle.ts";
const date = (day: number) => new Date(Date.UTC(2025, 0, day));
const trade = (id: string, kind: string, quantity: number, day: number) => ({ id, kind, quantity, occurredAt: date(day), createdAt: date(10), source: null });
test("backdated purchases, partial sales, liquidation and reacquisition follow ledger order", () => {
  const events = cardLifecycle({ createdAt: date(10), transactions: [trade("s2","sale",1,3),trade("s1","sale",2,2),trade("p2","purchase",2,4),trade("p1","purchase",3,1)],expenses:[],valuations:[] });
  assert.deepEqual(events.map(e=>e.title),["建立档案","再次买入","全部售出","卖出","买入"]);
});
test("the archive uses the local calendar day and a trade keeps its entered date", () => {
  const prior = process.env.TZ;
  try {
    for (const [zone, instant, day] of [
      ["Asia/Shanghai", "2026-12-31T16:30:00Z", "2027-01-01"],
      ["America/Los_Angeles", "2027-01-01T02:30:00Z", "2026-12-31"]
    ]) {
      process.env.TZ = zone;
      const createdAt = new Date(instant);
      const events = cardLifecycle({ createdAt, transactions:[{...trade("p","purchase",1,1), occurredAt:new Date("2027-01-01T00:00:00Z")}], expenses:[], valuations:[] });
      assert.equal(events.find(e=>e.key==="archive")?.day, day);
      assert.equal(events.find(e=>e.key==="trade-p")?.day, "2027-01-01");
    }
  } finally {
    if (prior === undefined) delete process.env.TZ;
    else process.env.TZ = prior;
  }
});

test("secondary entries stay available without suggesting a grading completion date", () => {
  const events=cardLifecycle({createdAt:date(2),transactions:[],expenses:[{id:"g",kind:"grading",occurredAt:date(3),vendor:"PSA"},{id:"s",kind:"shipping",occurredAt:date(4),vendor:null}],valuations:[{id:"v",valuedAt:date(5),source:"eBay"}]});
  assert.deepEqual(events.filter(e=>e.milestone).map(e=>e.title),["建立档案"]);
  assert.equal(events.length,4);
});
