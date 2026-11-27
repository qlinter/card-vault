import sharp from "sharp";
import { accountStatus } from "@/lib/account-server";
import { getStudioAiSettings } from "@/lib/ai-settings";
import { generateStudioStage } from "@/lib/group-photo-ai-server";
import { validStagePlan } from "@/lib/group-photo-stage-plan";

const bad = () => Response.json({error:"input"}, {status:400});
export async function POST(request: Request) {
  if (!(await accountStatus()).authenticated) return new Response(null,{status:403});
  const settings = getStudioAiSettings();
  if (!settings.apiKey) return Response.json({error:"key"},{status:400});
  if (Number(request.headers.get("content-length")) > 710_000) return bad();
  const form = await request.formData().catch(() => null);
  if (!form) return bad();
  const files = form.getAll("image");
  if (form.get("action") !== "stage" || files.length !== 1) return bad();
  const [file] = files;
  if (!(file instanceof File) || !file.size || file.size > 660_000 || file.type !== "image/jpeg") return bad();
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bad();
  const photo = await sharp(bytes,{limitInputPixels:2_000_000})
    .resize({width:1280,height:1280,fit:"inside",withoutEnlargement:true}).jpeg({quality:91}).toBuffer().catch(() => null);
  if (!photo) return bad();
  let plan: unknown;
  try { plan = JSON.parse(String(form.get("layout"))); } catch { return bad(); }
  if (!validStagePlan(plan)) return bad();
  try {
    const png = await generateStudioStage(photo, plan, settings, request.signal);
    return new Response(new Uint8Array(png),{headers:{"Content-Type":"image/png","Cache-Control":"private, no-store"}});
  } catch {
    if (request.signal.aborted) return new Response(null,{status:499});
    return Response.json({error:"image"}, {status:502});
  }
}
