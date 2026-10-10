import assert from "node:assert/strict";
import test from "node:test";
import { isEditingUrl, previousNavigation } from "../lib/navigation-history.ts";
const origin = "http://127.0.0.1:3000";
const trail = (urls: string[]) => ({ visits: urls.map((url, index) => ({ key: String(index), url })), current: urls.length - 1 });
test("back skips card editing and the same card's pre-edit detail while retaining filters", () => {
  const visits = trail(["/?sport=Basketball&q=Jordan", "/cards/a?returnTo=filters", "/cards/a/edit?returnTo=filters", "/cards/a?success=updated&returnTo=filters"]);
  assert.deepEqual(previousNavigation(visits, visits.visits.at(-1)!.url, origin), { delta: -3, url: "/?sport=Basketball&q=Jordan" });
});
test("repeated edits and share editing are omitted while ordinary navigation uses one step", () => {
  const visits = trail(["/shares", "/shares/a/edit", "/shares/a/preview", "/shares/a/edit", "/shares/a/preview"]);
  assert.deepEqual(previousNavigation(visits, "/shares/a/preview", origin), { delta: -4, url: "/shares" });
  assert.deepEqual(previousNavigation(trail(["/portfolio", "/cards/a"]), "/cards/a", origin), { delta: -1, url: "/portfolio" });
  assert.equal(isEditingUrl("https://other.example/cards/a/edit", origin), false);
});
