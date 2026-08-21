import { readdir } from "node:fs/promises";
import path from "node:path";

export async function listRelativeFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(root, fullPath)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }

  return files.sort();
}
