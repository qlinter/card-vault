import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import proxy from "../lib/ai-proxy-core.js";
import { generateStudioStage } from "../lib/group-photo-ai-server.ts";

const settings = {apiKey:"studio-test-only", imageModel:"configured-image-model",proxy:proxy.normalizeAiProxy({mode:"direct"})};
test("stage edit uses the configured image model, two set guides and the original bay proportions", async t => {
  const png = await sharp({create:{width:480,height:140,channels:3,background:"#cfbba7"}}).png().toBuffer();
  t.mock.method(globalThis,"fetch",async (url: string, init: RequestInit) => {
    assert.equal(String(url),"https://api.openai.com/v1/images/edits");
    assert.equal(new Headers(init.headers).get("authorization"),"Bearer studio-test-only");
    const form = init.body as FormData;
    assert.equal(form.get("model"),settings.imageModel);
    assert.equal(form.get("size"),"1536x1024");
    assert.deepEqual(form.getAll("image[]").map(file => (file as File).name),["accepted-single-card-studio.png","placement-diagram.png"]);
    const photos = form.getAll("image[]") as File[];
    assert.deepEqual(await sharp(Buffer.from(await photos[0].arrayBuffer())).raw().toBuffer(),await sharp(png).raw().toBuffer());
    const bytes = await photos[1].arrayBuffer();
    return Response.json({data:[{b64_json:Buffer.from(bytes).toString("base64")}]});
  });
  const result = await sharp(await generateStudioStage(png,{aspect:480/140,back:.7,front:.8,steps:[]},settings,new AbortController().signal)).metadata();
  assert.equal(result.format,"png");
  assert.ok(Math.abs(result.width / result.height - 480 / 140) < .01);
});
