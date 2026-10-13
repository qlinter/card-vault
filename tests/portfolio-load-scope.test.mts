import assert from "node:assert/strict";
import test from "node:test";
import { createPortfolioLoadScope } from "../lib/portfolio-load-scope.ts";

test("one operation coalesces concurrent loads but a new operation reads fresh data", async () => {
  let calls = 0;
  const load = async (key: string) => ({ key, revision: ++calls });
  const scope = createPortfolioLoadScope(load);
  const [left, right, other] = await Promise.all([scope("same"), scope("same"), scope("other")]);
  assert.equal(left, right);
  assert.notEqual(left, other);
  assert.equal(calls, 2);
  assert.equal((await createPortfolioLoadScope(load)("same")).revision, 3);
});

test("a failed load is shared with current callers and can be retried", async () => {
  let calls = 0;
  const scope = createPortfolioLoadScope(async () => {
    if (++calls === 1) throw new Error("temporarily unavailable");
    return "recovered";
  });
  const results = await Promise.allSettled([scope("same"), scope("same")]);
  assert.equal(calls, 1);
  assert.ok(results.every(result => result.status === "rejected"));
  assert.equal(await scope("same"), "recovered");
});
