import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareImageUpload } from "@/lib/image-upload";
import { getShareBackgroundsDir, getShareCoversDir } from "@/lib/storage-paths";

const destinations = {
  cover: { directory: getShareCoversDir, publicPrefix: "/share-covers/", label: "分享封面" },
  background: { directory: getShareBackgroundsDir, publicPrefix: "/share-backgrounds/", label: "分享背景" }
};

export async function saveShareImage(file: File, kind: keyof typeof destinations): Promise<string> {
  const destination = destinations[kind];
  const prepared = await prepareImageUpload(file, destination.label);
  const directory = destination.directory();
  await mkdir(directory, { recursive: true });
  const fileName = `share-${kind}-${Date.now()}-${randomUUID()}.${prepared.extension}`;
  await writeFile(path.join(directory, fileName), prepared.buffer);
  return destination.publicPrefix + fileName;
}

export async function removeManagedShareImage(imagePath: string | null): Promise<void> {
  if (!imagePath) return;
  const destination = Object.values(destinations).find(item => imagePath.startsWith(item.publicPrefix));
  if (!destination) return;
  try {
    await unlink(path.join(destination.directory(), path.basename(imagePath)));
  } catch {
    // Missing files do not need to block share collection updates.
  }
}
