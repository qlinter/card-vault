import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
const { Open } = createRequire(import.meta.url)("unzipper");
import { createZipArchive } from "../lib/zip-archive.ts";

test("ZIP archive contains nested static share files", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "card-vault-zip-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const source = path.join(root, "share");
  fs.mkdirSync(path.join(source, "assets"), { recursive: true });
  fs.writeFileSync(path.join(source, "index.html"), "<h1>Card Vault</h1>");
  fs.writeFileSync(path.join(source, "assets", "site.css"), "body{}");

  fs.writeFileSync(path.join(source, "assets", "卡片.bin"), Buffer.from([0, 1, 128, 255]));
  const zipPath = path.join(root, "share.zip");
  await createZipArchive(source, zipPath);
  const archive = fs.readFileSync(zipPath);

  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.equal(archive.includes(Buffer.from("index.html")), true);
  assert.equal(archive.includes(Buffer.from("assets/site.css")), true);
  const extracted = await Open.file(zipPath);
  const expected = new Map([
    ["index.html", Buffer.from("<h1>Card Vault</h1>")],
    ["assets/site.css", Buffer.from("body{}")],
    ["assets/卡片.bin", Buffer.from([0, 1, 128, 255])]
  ]);
  assert.equal(extracted.files.length, expected.size);
  for (const entry of extracted.files) assert.deepEqual(await entry.buffer(), expected.get(entry.path));
  await assert.rejects(createZipArchive(source, zipPath), /EEXIST/);
  assert.deepEqual(fs.readFileSync(zipPath), archive);
});
