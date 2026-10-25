import assert from "node:assert/strict";
import test from "node:test";
import { mergeImportJobDelta, type ImportJobPage } from "../lib/import-job-state.ts";
import { cardMatchesImport, importMatch, importMatchKey } from "../lib/import-matching.ts";
import { OperationError, operationFailure } from "../lib/operation-errors.ts";

test("incremental import status preserves input values, loaded pages and unread row cursor", () => {
  const current: ImportJobPage = { id: "job", kind: "import", status: "preview", total: 205, counts: { pending: 205 }, nextRow: 101,
    rows: [{ id: "row", rowNumber: 2, status: "pending", error: null, cardId: null, values: { cardTitle: "Original title" } }] };
  const result = mergeImportJobDelta(current, { id: "job", kind: "import", status: "running", total: 205, counts: { applied: 50, pending: 155 }, delta: true, nextCursor: 51,
    rows: [{ id: "row", rowNumber: 2, status: "applied", error: null, cardId: "card" }, { id: "unloaded", rowNumber: 200, status: "applied", error: null, cardId: "other" }] })!;
  assert.equal(result.rows.length, 1); assert.equal(result.nextRow, 101);
  assert.equal(result.rows[0].values.cardTitle, "Original title"); assert.equal(result.rows[0].status, "applied");
  assert.equal(current.rows[0].status, "pending");
  assert.equal(mergeImportJobDelta(null, { ...result, id: "other", delta: true, nextCursor: null, rows: [] }), null);
  assert.equal(mergeImportJobDelta(current, { ...result, id: "other", delta: true, nextCursor: null, rows: [] }), current);
});

test("import matching keeps ID and certificate priority and exact null/text semantics", () => {
  const card = { id: "id", certNumber: "A'B", playerName: "Name", cardTitle: "Title", sport: "Basketball", year: null, parallel: null, serialNumber: null };
  assert.deepEqual(importMatch({ id: "id", certNumber: "other" }), { kind: "id", id: "id" });
  assert.equal(cardMatchesImport(card, importMatch({ certNumber: "A'B" })), true);
  const archive = importMatch({ playerName: "Name", cardTitle: "Title", sport: "Basketball", year: "" });
  assert.equal(cardMatchesImport(card, archive), true);
  assert.equal(cardMatchesImport({ ...card, year: "" }, archive), false);
  assert.notEqual(importMatchKey(archive), importMatchKey(importMatch({ ...card, year: "2020", certNumber: "", parallel: "", serialNumber: "" })));
});

test("operation error codes consistently map conflicts and missing records to HTTP status", () => {
  assert.equal(operationFailure(new OperationError("data_changed", "Changed"), "Failed").status, 409);
  assert.equal(operationFailure(new OperationError("not_found", "Missing"), "Failed").status, 404);
  assert.deepEqual(operationFailure(null, "Failed"), { status: 400, body: { error: "Failed", code: "invalid_input" } });
});
