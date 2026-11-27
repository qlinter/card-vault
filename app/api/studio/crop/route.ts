import { revalidatePath } from "next/cache";
import { accountStatus } from "@/lib/account-server";
import { fileForCard, groupPhotoAsset } from "@/lib/studio-images";
import { saveStudioCrop, validCrop } from "@/lib/studio-crop";

export async function GET(request: Request) {
  if (!(await accountStatus()).authenticated) return new Response(null, {status:403});
  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 128) return new Response(null, {status:400});
  return Response.json(await groupPhotoAsset(id, await fileForCard(id)), {headers: {"Cache-Control":"no-store"}});
}

export async function POST(request: Request) {
  if (!(await accountStatus()).authenticated) return new Response(null, {status:403});
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !body.id || body.id.length > 128 ||
      typeof body.revision !== "string" || !body.revision || body.revision.length > 128 ||
      typeof body.version !== "string" || body.version.length > 256 || (body.box !== null && !validCrop(body.box))) {
    return new Response(null, {status:400});
  }
  const file = await fileForCard(body.id);
  const box = body.box && {x:body.box.x, y:body.box.y, w:body.box.w, h:body.box.h};
  const result = await saveStudioCrop(file, body.version, body.revision, box);
  if (result.status !== "saved") return Response.json({error:result.status}, {status:409});
  revalidatePath("/showcase/group-photo");
  return Response.json({revision:result.revision});
}
