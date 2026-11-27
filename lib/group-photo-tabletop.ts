import type { Box } from "./group-photo-geometry.ts";

export type TableMaterial = { photo: ImageBitmap; top: Box; front: Box };

/** Sample the physical top and fascia immediately below the feet in the
 * accepted studio photo. A continuous horizontal edge separates the planes. */
export function studioTableMaterial(photo: ImageBitmap, survey: HTMLCanvasElement, foot: number): TableMaterial {
  const {width:w,height:h} = survey;
  const pixels = survey.getContext("2d")!.getImageData(0,0,w,h).data;
  const from = Math.min(Math.ceil(foot+2),Math.floor(h*.94));
  let best = -1, edge = from;
  for (let y = Math.max(2,from); y < h-3; y++) {
    let score = 0;
    for (let x = Math.floor(w*.15); x < w*.85; x++) {
      const i = 4*(y*w+x), d = 4*w;
      score += Math.min(60,Math.abs(pixels[i-d]-pixels[i+d])+Math.abs(pixels[i-d+1]-pixels[i+d+1]));
    }
    if (score > best) { best=score;edge=y; }
  }
  const sy = photo.height/h;
  function region(y: number, height: number): Box {
    return {x:photo.width*.18,y:y*sy,w:photo.width*.64,h:Math.max(1,height*sy)};
  }
  const start = Math.max(Math.min(foot+1,edge-3),edge-h*.055,0);
  return {photo,top:region(start,edge-1-start),front:region(edge+2,Math.max(1,h-edge-3))};
}

function plane(ctx: CanvasRenderingContext2D, m: TableMaterial, box: Box, x: number, y: number,
  ux: number, uy: number, vx: number, vy: number, shade = 0) {
  ctx.save(); ctx.transform(ux,uy,vx,vy,x,y);
  ctx.drawImage(m.photo,box.x,box.y,box.w,box.h,0,0,1,1);
  if (shade) { ctx.fillStyle=`rgba(52,40,32,${shade})`; ctx.fillRect(0,0,1,1); }
  ctx.restore();
}

export function registerStudioTable(ctx: CanvasRenderingContext2D, m: TableMaterial, inset: number, back: number, front: number, width: number, end: number) {
  plane(ctx,m,m.top,inset,back,width,0,0,front-back);
  plane(ctx,m,m.front,inset,front,width,0,0,end-front);
  ctx.fillStyle="rgba(255,247,234,.55)";ctx.fillRect(inset,front,width,2);
}

export function registerStudioStep(ctx: CanvasRenderingContext2D, m: TableMaterial, cx: number, foot: number, width: number, lift: number) {
  if (!lift) return;
  const x=cx-width/2, depth=Math.min(38,width*.07), front=foot+24, back=foot-50;
  plane(ctx,m,m.front,x,front,width,0,0,lift);
  plane(ctx,m,m.front,x+width,front,depth,back-front,0,lift,.19);
  plane(ctx,m,m.top,x+depth,back,width,0,-depth,front-back);
  ctx.fillStyle="rgba(255,247,234,.6)";ctx.fillRect(x,front,width,2);
}
