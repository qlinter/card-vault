import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import files from "../../lib/studio-file.js";
import { uiDatabasePath, withUiDatabase } from "./database-fixture.mjs";

export async function installStudioPhoto(id, png) {
  const card = withUiDatabase(db => ({
    ...db.prepare("SELECT id,cardTitle FROM Card WHERE id=?").get(id),
    images:db.prepare("SELECT id,path,rotation FROM CardImage WHERE cardId=? ORDER BY sortOrder,createdAt,id LIMIT 1").all(id)
  }));
  const dir = path.join(path.dirname(uiDatabasePath),"studio-images");
  await mkdir(dir,{recursive:true});
  const file = path.join(dir,files.studioFilename(card));
  await writeFile(file,png,{flag:"wx"});
  return () => Promise.all([file, file + ".crop.json"].map(target => rm(target,{force:true})));
}
