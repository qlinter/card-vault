import path from "node:path";
import { listRelativeFiles } from "./file-tree.ts";
import { writeStreamingZip } from "./streaming-zip.js";

export async function createZipArchive(sourceDir: string, zipPath: string): Promise<void> {
  const files = await listRelativeFiles(sourceDir);
  await writeStreamingZip(zipPath, files.map(name => ({ name, path: path.join(sourceDir, name) })));
}
