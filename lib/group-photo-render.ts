import { measureCard, planGroupPhoto, type Box, type Framing, type GroupPhotoStyle } from "./group-photo-geometry.ts";
import { mosaicTileEdge, planMosaic } from "./group-photo-mosaic.ts";
import type { StudioStagePlan } from "./group-photo-stage-plan.ts";
import { registerStudioStep, registerStudioTable, studioTableMaterial, type TableMaterial } from "./group-photo-tabletop.ts";

export type PhotoSource = { url: string; graded: boolean; name: string; faceRatio?: number; crop?: Box };

function surface(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w)); canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

async function loadImage(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("image");
  return response.blob();
}

function thumbnail(bitmap: ImageBitmap, max: number) {
  const factor = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const ctx = surface(bitmap.width * factor, bitmap.height * factor);
  ctx.drawImage(bitmap,0,0,ctx.canvas.width,ctx.canvas.height);
  return ctx;
}

async function survey(source: PhotoSource, signal: AbortSignal) {
  const blob = await loadImage(source.url, signal);
  const bitmap = await createImageBitmap(blob);
  try {
    const ctx = thumbnail(bitmap, 273);
    const { width, height } = ctx.canvas;
    const frame = measureCard(ctx.getImageData(0, 0, width, height).data, width, height, source.graded, true);
    return { source, blob, frame, width, height, survey: ctx.canvas };
  } finally { bitmap.close(); }
}

function mosaicFace(frame: Framing): Box {
  const { x, y, w, h } = frame.face;
  // Detection follows the inner rim's contrast peak. Keep acrylic highlights
  // inside the holder from becoming stripes at the seams.
  const inset = .022;
  return { x: x+w*inset, y: y+h*inset, w: w*(1-2*inset), h: h*(1-2*inset) };
}

export async function calibrationImage(source: PhotoSource, signal: AbortSignal, cropMode = false) {
  const { survey: canvas, blob, frame, width, height } = await survey(source, signal);
  return { url: cropMode ? URL.createObjectURL(blob) : canvas.toDataURL(), face: cropMode ? mosaicFace(frame) : frame.face, width, height };
}

function jpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("JPEG")), "image/jpeg", .9));
}

function topOf(frame: Framing) {
  return frame.holder.y - (frame.hooks ? Math.min(frame.holder.y, frame.holder.h * .115) : 0);
}

function silhouette(ctx: CanvasRenderingContext2D, frame: Framing) {
  const { holder: { x, y, w, h }, standLeft: l, standRight: r, foot } = frame;
  const bottom = y + h, cx = x + w / 2, top = topOf(frame);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w,h) * .021);
  if (foot > bottom) {
    const dy = foot - bottom;
    ctx.moveTo(l, bottom - 1); ctx.lineTo(r, bottom - 1); ctx.lineTo(r + 1, foot);
    ctx.lineTo(r - (r-l)*.055, foot); ctx.lineTo(r - (r-l)*.30, bottom + dy * .26);
    ctx.lineTo(l + (r-l)*.30, bottom + dy * .26); ctx.lineTo(l + (r-l)*.055, foot); ctx.lineTo(l - 1, foot); ctx.closePath();
  }
  if (frame.hooks) {
    const hook = w * .054;
    ctx.moveTo(cx-hook, y+1); ctx.quadraticCurveTo(cx-hook, top, cx, top);
    ctx.quadraticCurveTo(cx+hook, top, cx+hook, y+1); ctx.lineTo(cx+hook*.62, y+1);
    ctx.quadraticCurveTo(cx+hook*.55, top+2, cx, top+2); ctx.quadraticCurveTo(cx-hook*.55,top+2,cx-hook*.62,y+1); ctx.closePath();
  }
  ctx.clip();
}

function gradient(ctx: CanvasRenderingContext2D, y: number, h: number, a: string, b: string) {
  const g = ctx.createLinearGradient(0, y, ctx.canvas.width * .37, y + h);
  g.addColorStop(0, a); g.addColorStop(1, b);
  return g;
}
function caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, max: number) {
  ctx.fillStyle = "#453b32"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = size + 'px Georgia, "Microsoft YaHei", serif';
  if (ctx.measureText(text).width > max) ctx.font = Math.max(16, size * max / ctx.measureText(text).width) + 'px Georgia, "Microsoft YaHei", serif';
  ctx.fillText(text, x, y, max);
}

function encodePng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG")), "image/png"));
}

async function renderMosaic(sources: PhotoSource[], signal: AbortSignal, progress?: (done: number) => void) {
  const edge = mosaicTileEdge(sources.length), across = Math.floor(2048 / edge), perSheet = across * across;
  const sheets: CanvasRenderingContext2D[] = [], faces: Box[] = [];
  let output: CanvasRenderingContext2D | undefined;
  try {
    for (const [i, source] of sources.entries()) {
      signal.throwIfAborted();
      const slot = i % perSheet;
      if (!slot) {
        const slots = Math.min(perSheet, sources.length - i);
        sheets.push(surface(Math.min(slots, across) * edge, Math.ceil(slots / across) * edge));
      }
      const sheet = sheets.at(-1)!;
      try {
        const bitmap = await createImageBitmap(await loadImage(source.url, signal));
        try {
          const probe = thumbnail(bitmap, 273), { width, height } = probe.canvas;
          const manual = source.crop;
          const face = manual ? { x: manual.x * width, y: manual.y * height, w: manual.w * width, h: manual.h * height }
            : mosaicFace(measureCard(probe.getImageData(0, 0, width, height).data, width, height, source.graded, true));
          probe.canvas.width = 1;
          const scale = edge / Math.max(face.w, face.h);
          const turn = face.w > face.h;
          const faceWidth = Math.max(1, Math.round(face.w * scale)), faceHeight = Math.max(1, Math.round(face.h * scale));
          const box = { x: slot % across * edge, y: Math.floor(slot / across) * edge, w: turn ? faceHeight : faceWidth, h: edge };
          sheet.save(); sheet.beginPath(); sheet.rect(box.x, box.y, box.w, box.h); sheet.clip();
          sheet.translate(box.x, box.y);
          // Crop in the owner's displayed coordinates, then turn the entire wide
          // face clockwise into its portrait slot, including its artwork and text.
          if (turn) { sheet.translate(box.w, 0); sheet.rotate(Math.PI / 2); }
          sheet.scale(faceWidth / face.w, faceHeight / face.h); sheet.translate(-face.x, -face.y);
          sheet.drawImage(bitmap, 0, 0, width, height);
          sheet.restore(); faces.push(box);
        } finally { bitmap.close(); }
      } catch { signal.throwIfAborted(); throw new Error(source.name); }
      progress?.(i + 1);
    }
    signal.throwIfAborted();
    const layout = planMosaic(faces.map(box => box.w / box.h));
    output = surface(layout.width, layout.height);
    // Trim around each face's centre at the shared physical scale. Destination
    // rectangles meet exactly; the canvas contains only pixels from selected faces.
    layout.tiles.forEach((tile, i) => {
      const f = faces[i], sheet = sheets[Math.floor(i / perSheet)];
      const unit = Math.max(f.w, f.h) / layout.faceLong;
      const sw = Math.min(f.w, tile.w * unit), sh = Math.min(f.h, tile.h * unit);
      output!.drawImage(sheet.canvas, f.x + (f.w - sw) / 2, f.y + (f.h - sh) / 2, sw, sh, tile.x, tile.y, tile.w, tile.h);
      if ((i+1) % perSheet === 0 || i+1 === faces.length) sheet.canvas.width = 1;
    });
    const png = await encodePng(output.canvas);
    return { png, width: layout.width, height: layout.height, faceLong: Math.round(layout.faceLong) };
  } finally {
    for (const sheet of sheets) sheet.canvas.width = 1;
    if (output) output.canvas.width = 1;
  }
}

function raisedPlinth(ctx: CanvasRenderingContext2D, x: number, foot: number, width: number, lift: number) {
  if (!lift) return;
  const front = foot + 24, depth = Math.min(38, width * .07), left = x - width / 2, right = left + width;
  ctx.fillStyle = gradient(ctx, front, lift, "#ddcdb9", "#c7b49d");
  ctx.fillRect(left, front, width, lift);
  ctx.fillStyle = gradient(ctx, foot - 50, 74, "#f4eadb", "#e0d0ba");
  ctx.beginPath(); ctx.moveTo(left, front); ctx.lineTo(left + depth, foot - 50);
  ctx.lineTo(right + depth, foot - 50); ctx.lineTo(right, front); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#beab95"; ctx.beginPath(); ctx.moveTo(right, front); ctx.lineTo(right + depth, foot - 50);
  ctx.lineTo(right + depth, foot - 50 + lift); ctx.lineTo(right, front + lift); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f7eddf"; ctx.fillRect(left, front, width, 2);
}

export async function renderGroupPhoto(sources: PhotoSource[], style: GroupPhotoStyle, title: string, signal: AbortSignal, progress?: (done: number) => void,
  refineStage?: (photo: Blob, plan: StudioStagePlan, signal: AbortSignal) => Promise<Blob>) {
  if (style === "mosaic") return renderMosaic(sources, signal, progress);
  const exhibits = [];
  for (const source of sources) {
    signal.throwIfAborted();
    try { exhibits.push(await survey(source, signal)); }
    catch { signal.throwIfAborted(); throw new Error(source.name); }
  }
  const sizes = exhibits.map(({ frame, source, width, height }) => ({
    width: frame.holder.w, height: frame.foot - topOf(frame),
    faceLong: source.faceRatio ? source.faceRatio * Math.max(width, height) : Math.max(frame.face.w, frame.face.h)
  }));
  const layout = planGroupPhoto(sizes, style, Boolean(title));
  const ctx = surface(layout.width, layout.height), w = layout.width, wall = style === "wall";
  const inset = wall ? layout.inset : 0;
  const background = refineStage ? null : await createImageBitmap(await loadImage("/studio-style/landscape.png", signal));
  let refined: ImageBitmap | undefined;
  let material: TableMaterial | undefined;
  try {
    ctx.fillStyle = "#eae2d6"; ctx.fillRect(0, 0, w, layout.height);
    if (wall && title) caption(ctx, title, w / 2, layout.header * .55, 80, w * .87);
    for (let row = 0; row < layout.rows; row++) {
      const first = row * layout.columns, foot = layout.items[first].foot + layout.items[first].lift;
      const y = !wall && row === 0 ? 0 : layout.header + row * (layout.bay + layout.gap);
      const back = foot - 56, front = foot + 34, inner = w - 2 * inset;
      const end = !wall && row === layout.rows - 1 ? layout.height : layout.header + row * (layout.bay + layout.gap) + layout.bay;
      if (background) {
        ctx.drawImage(background, 0, 0, background.width, Math.floor(background.height * .205), inset, y, inner, back - y);
        ctx.fillStyle = gradient(ctx, back, front-back, "#f3e8d9", "#d6c7b6"); ctx.fillRect(inset, back, inner, front-back);
        ctx.fillStyle = gradient(ctx, front, end-front, "#e1d3c2", "#c9b8a6"); ctx.fillRect(inset, front, inner, end-front);
        ctx.fillStyle = "#f2e8d9"; ctx.fillRect(inset, front, inner, 3);
        if (style === "tiers") {
          const cell = (w - 2 * layout.inset) / layout.columns;
          for (const item of layout.items) raisedPlinth(ctx, item.cx, item.foot, cell * .94, item.lift);
        }
      }
      if (refineStage) {
        if (!refined) {
          const height = end-y, cell = (w-2*layout.inset)/layout.columns;
          const plan: StudioStagePlan = {aspect:inner/height, back:(back-y)/height, front:(front-y)/height,
            steps:layout.items.filter(item => item.lift > 0).map(item => ({
              left:(item.cx-cell*.47-inset)/inner, right:(item.cx+cell*.47-inset)/inner, depth:Math.min(38,cell*.94*.07)/inner,
              back:(item.foot-50-y)/height, front:(item.foot+24-y)/height, base:(item.foot+24+item.lift-y)/height
            }))};
          const photo = await createImageBitmap(exhibits[0].blob);
          material = studioTableMaterial(photo,exhibits[0].survey,exhibits[0].frame.foot);
          const reference = await jpeg(thumbnail(photo,1024).canvas);
          const plate = await refineStage(reference,plan,signal);
          signal.throwIfAborted();
          refined = await createImageBitmap(plate);
        }
        ctx.drawImage(refined,inset,y,inner,end-y);
        // Model-generated geometry can drift or omit an entire tier. Register
        // real photographed surfaces at the contact points before drawing feet.
        registerStudioTable(ctx,material!,inset,back,front,inner,end);
        if (style === "tiers") {
          const cell=(w-2*layout.inset)/layout.columns;
          for(const item of layout.items) registerStudioStep(ctx,material!,item.cx,item.foot,cell*.94,item.lift);
        }
      }
      for (let i = first; i < Math.min(exhibits.length, first + layout.columns); i++) {
        signal.throwIfAborted();
        const { source, frame, blob, width, height } = exhibits[i];
        const { cx, scale, foot: contact } = layout.items[i], x = cx - frame.holder.w * scale / 2, top = contact - frame.foot * scale;
        ctx.save(); ctx.translate(x - frame.holder.x * scale, top); ctx.scale(scale, scale);
        const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        shadow.addColorStop(0,"rgba(76,57,40,.34)"); shadow.addColorStop(1,"rgba(76,57,40,0)");
        ctx.save(); ctx.translate(frame.holder.x + frame.holder.w * .7, frame.foot - .8);
        ctx.scale(frame.holder.w * .61, Math.max(1, frame.holder.w * .032)); ctx.fillStyle = shadow;
        ctx.fillRect(-1,-1,2,2); ctx.restore();
        if (refined) {
          // Two real support feet anchor the object to the relit surface.
          for (const sx of [frame.standLeft,frame.standRight]) {
            ctx.save(); ctx.translate(sx,frame.foot-.6); ctx.rotate(-.12);
            ctx.scale(frame.holder.w*.052,Math.max(.7,frame.holder.w*.011));
            const contactShadow = ctx.createRadialGradient(0,0,0,0,0,1);
            contactShadow.addColorStop(0,"rgba(56,40,28,.45)"); contactShadow.addColorStop(1,"rgba(56,40,28,0)");
            ctx.fillStyle=contactShadow; ctx.fillRect(-1,-1,2,2); ctx.restore();
          }
        }
        silhouette(ctx, frame);
        const bitmap = await createImageBitmap(blob);
        try {
          // Draw once from the full-resolution original into the final image.
          ctx.drawImage(bitmap,0,0,width,height);
        } finally { bitmap.close(); ctx.restore(); }
        caption(ctx, source.name, cx, front + (wall ? 40 : 48), wall ? 32 : 38, (w - 2 * layout.inset) / layout.columns * .9);
      }
    }
    if (title && !wall) caption(ctx, title, w / 2, layout.height - 64, 70, w * .9);
    signal.throwIfAborted();
    const png = await encodePng(ctx.canvas);
    return { png, width: layout.width, height: layout.height, faceLong: Math.round(layout.faceLong) };
  } finally { material?.photo.close(); refined?.close(); background?.close(); ctx.canvas.width = 1; }
}
