import "server-only";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";

export function scoutIdentity(): string {
  const url = process.env.DATABASE_URL ?? "";
  let created = "";
  try { created = String(statSync(url.replace(/^file:/, "")).birthtimeMs); } catch { /* Test/in-memory database. */ }
  return createHash("sha256").update(url + "|" + created).digest("hex").slice(0, 24);
}
