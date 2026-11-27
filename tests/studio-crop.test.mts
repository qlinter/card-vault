import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import snapshot from "../electron/storage/database-snapshot.js";
import { saveStudioCrop, studioCropInfo, validCrop } from "../lib/studio-crop.ts";

test("a saved rectangle follows the exact studio image through backup and rejects an obsolete edit", async t => {
  const base = await mkdtemp(path.join(os.tmpdir(),"vault-crop-"));
  t.after(() => rm(base,{recursive:true,force:true}));
  const data = path.join(base,"collection"), backup = path.join(base,"backup");
  const dir = path.join(data,"studio-images"), png = path.join(dir,"card.png");
  await mkdir(dir,{recursive:true}); await mkdir(backup);
  await writeFile(png,"accepted photo");
  const box = {x:.12,y:.21,w:.51,h:.64};
  const source = (await studioCropInfo(png))!;
  assert.equal(source.crop,null);
  const first = await saveStudioCrop(png,source.version,source.revision,box);
  assert.equal(first.status,"saved");
  assert.equal((await saveStudioCrop(png,source.version,source.revision,null)).status,"crop-changed");
  assert.equal(await readFile(png,"utf8"),"accepted photo");
  assert.deepEqual((await studioCropInfo(png))?.crop,box);

  snapshot.copyDataFilesForBackup(data,backup,path.join(data,"dev.db"));
  const copy = path.join(backup,"studio-images","card.png");
  await utimes(copy,new Date(0),new Date(0));
  const read = fs.readFile.bind(fs);
  let fullReads = 0;
  const spy = t.mock.method(fs,"readFile",(file: string, ...args: []) => {
    if (file === copy) fullReads++;
    return read(file,...args);
  });
  syncBuiltinESMExports();
  try {
    for (let attempt=0; attempt<3; attempt++) assert.deepEqual((await studioCropInfo(copy))?.crop,box);
    assert.equal(fullReads,1);
  } finally { spy.mock.restore(); syncBuiltinESMExports(); }
  await writeFile(png,"different accepted photo");
  const changed = (await studioCropInfo(png))!;
  assert.equal(changed.crop,null);
  assert.equal((await saveStudioCrop(png,source.version,source.revision,box)).status,"image-changed");
  const next = await saveStudioCrop(png,changed.version,changed.revision,box);
  assert.equal(next.status,"saved");
  assert.equal((await saveStudioCrop(png,source.version,source.revision,null)).status,"image-changed");
  const reset = await saveStudioCrop(png,changed.version,next.revision,null);
  assert.equal(reset.status,"saved");
  assert.equal((await saveStudioCrop(png,changed.version,next.revision,box)).status,"crop-changed");
  assert.equal((await studioCropInfo(png))?.crop,null);
  assert.equal(validCrop({...box,w:2}),false);
  assert.equal(validCrop({...box,h:0}),false);
});

test("a crop from an older backup has a stable revision and upgrades on the first edit",async t => {
  const base = await mkdtemp(path.join(os.tmpdir(),"vault-legacy-crop-"));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const dir = path.join(base,"studio-images"); await mkdir(dir);
  const png = path.join(dir,"legacy.png"); await writeFile(png,"accepted");
  const {version} = (await studioCropInfo(png))!;
  const box = {x:.1,y:.1,w:.7,h:.8};
  await writeFile(png+".crop.json",JSON.stringify({version,box}));
  const legacy = (await studioCropInfo(png))!;
  assert.deepEqual(legacy.crop,box);
  assert.equal(legacy.revision,(await studioCropInfo(png))?.revision);
  const reset = await saveStudioCrop(png,version,legacy.revision,null);
  assert.equal(reset.status,"saved");
  assert.equal((await saveStudioCrop(png,version,legacy.revision,box)).status,"crop-changed");
});
