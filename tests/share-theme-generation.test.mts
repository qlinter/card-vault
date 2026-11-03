import assert from "node:assert/strict";
import test from "node:test";
import { generateShareTheme } from "../lib/share-theme-generation.ts";
import type { ActiveAiSettings } from "../lib/ai-settings.ts";

const settings: ActiveAiSettings = {
  provider: "openai", endpoint: "http://127.0.0.1:1/fixture/chat/completions", model: "fixture-model", apiKey: "fixture-key",
  proxy: { mode: "direct", protocol: "http", host: "", port: "", username: "", password: "", noProxy: "" }
};
const card = { playerName: "Fixture player", cardTitle: "Fixture card", sport: "Basketball" };
const response = (text: string) => Response.json({ choices: [{ message: { content: text } }] });

test("share generation sends only public card and text fields, and normalizes suggestions", async t => {
  let prompt = "";
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    prompt = JSON.parse(init.body as string).messages[0].content;
    return response(JSON.stringify({ suggestion: { title: "Public title", themeHighlights: ["First", "Second"], notes: "do not return" } }));
  });
  const suggestion = await generateShareTheme(settings, {
    cards: [{ ...card, notes: "private-notes-sentinel", purchaseSource: "private-source-sentinel", purchasePrice: "private-price-sentinel" }],
    current: { title: "Existing title", notes: "private-current-sentinel", apiKey: "private-key-sentinel" }
  });
  assert.deepEqual(suggestion, { title: "Public title", themeHighlights: "First\nSecond" });
  assert.match(prompt, /Fixture player/);
  assert.match(prompt, /Existing title/);
  assert.doesNotMatch(prompt, /private-.*-sentinel/);
});

test("share generation repairs malformed JSON and retains the existing text fallback", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => response(++calls % 2 === 1 ? "A fixture gallery narrative" : "Still not JSON"));
  const suggestion = await generateShareTheme(settings, { cards: [card] });
  assert.equal(calls, 2);
  assert.equal(suggestion.themeNarrative, "A fixture gallery narrative");
  assert.match(suggestion.title!, /fixture gallery narrative/);
});

test("cancelling share JSON repair closes the request without returning a fallback or retrying", async t => {
  const controller = new AbortController();
  let calls = 0;
  let repairStarted!: () => void;
  const started = new Promise<void>(resolve => { repairStarted = resolve; });
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    if (++calls === 1) return response("A fixture gallery narrative");
    repairStarted();
    return new Promise<Response>((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true }));
  });
  const pending = generateShareTheme(settings, { cards: [card] }, controller.signal);
  await started;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls, 2);
});

test("invalid selections and already cancelled share requests never contact AI", async t => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected upstream call"); });
  await assert.rejects(generateShareTheme(settings, { cards: [] }), /至少一张/);
  await assert.rejects(generateShareTheme(settings, { cards: Array(81).fill(card) }), /80/);
  await assert.rejects(generateShareTheme(settings, { cards: [card] }, AbortSignal.abort()), { name: "AbortError" });
  assert.equal(fetchMock.mock.callCount(), 0);
});
