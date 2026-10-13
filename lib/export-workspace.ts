import "server-only";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "./prisma";
import { snapshotExportDatabase } from "./export-database-snapshot.js";

type ExportWorkspace = { directory: string; snapshot: string; signal: AbortSignal };
let activeExports = 0;
export class ExportLimitError extends Error {
  constructor() { super("已有两个导出任务，请等待完成后重试。"); }
}
/** All private tabular exports share limits, consistent reads and cancellation cleanup. */
export async function exportFromSnapshot(build: (workspace: ExportWorkspace) => Promise<string>, requestSignal?: AbortSignal) {
  if (activeExports >= 2) throw new ExportLimitError();
  activeExports++;
  let directory: string | undefined, cleanupPromise: Promise<void> | undefined;
  const cleanup = () => cleanupPromise ??= (async () => {
    try { if (directory) await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
    finally { activeExports--; }
  })();
  try {
    const signal = AbortSignal.any([...(requestSignal ? [requestSignal] : []), AbortSignal.timeout(600000)]);
    signal.throwIfAborted();
    directory = await mkdtemp(path.join(tmpdir(), "card-vault-export-"));
    const databases = await prisma.$queryRaw<Array<{ name: string; file: string }>>`PRAGMA database_list`;
    const source = databases.find(row => row.name === "main")?.file;
    if (!source) throw new Error("无法定位收藏数据库。");
    const snapshot = path.join(directory, "snapshot.db");
    await snapshotExportDatabase(source, snapshot, signal);
    const output = await build({ directory, snapshot, signal });
    signal.throwIfAborted();
    const size = (await stat(output)).size, stream = createReadStream(output, { highWaterMark: 65536 });
    const iterator = stream[Symbol.asyncIterator]();
    let ended = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const abort = () => { if (ended) return; ended = true; controller.error(new Error("导出下载已取消。")); stream.destroy(); };
        signal.addEventListener("abort", abort, { once: true });
        stream.once("close", () => { signal.removeEventListener("abort", abort); void cleanup().catch(error => console.error("Export cleanup failed", error)); });
        if (signal.aborted) abort();
      },
      async pull(controller) {
        if (ended) return;
        try {
          const result = await iterator.next();
          if (ended) return;
          if (result.done) { ended = true; controller.close(); } else controller.enqueue(result.value);
        } catch (error) { if (!ended) { ended = true; controller.error(error); } stream.destroy(); }
      },
      cancel() { ended = true; stream.destroy(); return cleanup(); }
    }, { highWaterMark: 65536, size: chunk => chunk.byteLength });
    return { body, size };
  } catch (error) { await cleanup(); throw error; }
}
