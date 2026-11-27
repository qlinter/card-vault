import sharp from "sharp";
import type { getStudioAiSettings } from "./ai-settings.ts";
import type { StudioStagePlan } from "./group-photo-stage-plan.ts";
import { editStudioImage, studioLighting } from "./studio-provider.ts";

type Settings = ReturnType<typeof getStudioAiSettings>;
export async function generateStudioStage(photo: Buffer, plan: StudioStagePlan, settings: Settings, signal: AbortSignal) {
  const width = Math.round(Math.min(1536,1024*plan.aspect)), height = Math.min(1024,Math.round(width/plan.aspect));
  const left = Math.floor((1536-width)/2), top = Math.floor((1024-height)/2);
  const steps = plan.steps.map(s => {
    const l=s.left*width, r=s.right*width, d=s.depth*width, b=s.back*height, f=s.front*height, base=s.base*height;
    return `<path fill="#999" d="M${l} ${f}H${r}V${base}H${l}Z"/><path fill="#fff" d="M${l} ${f}L${l+d} ${b}H${r+d}L${r} ${f}Z"/><path fill="#666" d="M${r} ${f}L${r+d} ${b}V${b+base-f}L${r} ${base}Z"/>`;
  }).join("");
  const geometry = await sharp(Buffer.from(`<svg width="1536" height="1024" xmlns="http://www.w3.org/2000/svg">
    <rect width="1536" height="1024" fill="#000"/><g transform="translate(${left} ${top})"><rect width="${width}" height="${height}" fill="#999"/>
    <rect width="${width}" height="${plan.back*height}" fill="#444"/><rect y="${plan.back*height}" width="${width}" height="${(plan.front-plan.back)*height}" fill="white"/>${steps}</g></svg>`)).png().toBuffer();
  const reference = await sharp(photo).png().toBuffer();
  const edited = await editStudioImage(settings, [
    "Photograph a NEW empty group display set in the exact photographic world of the FIRST image: the collector's finished single-card studio photograph. Reconstruct and extend the ACTUAL tabletop, its material, edge profile, subtle texture, ivory tone, wall, window pattern, soft daylight and exposure seen in that photograph across the entire new composition.",
    studioLighting, "Image TWO is solely a normalized construction diagram for the target camera framing: black is padding, dark grey wall, white horizontal surfaces, mid-grey vertical fascia. Put the physical planes and steps at these boundaries. Invent all appearance and photographic detail from image ONE. The diagram's flat fills and outlines must disappear entirely.",
    "Deliver a full photographic plate inside the indicated aperture. Recreate physical light falloff and contact occlusion at ledges. Remove the reference card, slab, display stand and their shadows completely. Do not add cards, lettering, logos or decorations. The real cards will be composited afterwards."
  ].join(" "), "1536x1024", [{name:"accepted-single-card-studio.png",png:reference},{name:"placement-diagram.png",png:geometry}], signal);
  const registered = await sharp(edited).resize(1536,1024,{fit:"fill"}).png().toBuffer();
  return sharp(registered).extract({left,top,width,height}).png().toBuffer();
}
