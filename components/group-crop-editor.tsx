"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { calibrationImage, type PhotoSource } from "@/lib/group-photo-render";
import type { Box } from "@/lib/group-photo-geometry";

const handles = [
  ["nw","左上角","top left"], ["n","上边","top edge"], ["ne","右上角","top right"], ["e","右边","right edge"],
  ["se","右下角","bottom right"], ["s","下边","bottom edge"], ["sw","左下角","bottom left"], ["w","左边","left edge"]
] as const;
type Handle = "move" | typeof handles[number][0];
type Drag = {id:number; handle:Handle; box:Box; x:number; y:number; width:number; height:number};
const clamp = (n:number, min:number, max:number) => Math.max(min,Math.min(max,n));

function adjust(box: Box, handle: Handle, dx: number, dy: number): Box {
  if (handle === "move") return {...box, x:clamp(box.x + dx,0,1-box.w), y:clamp(box.y + dy,0,1-box.h)};
  const right = box.x + box.w, bottom = box.y + box.h;
  const x = handle.includes("w") ? clamp(box.x + dx,0,right-.05) : box.x;
  const y = handle.includes("n") ? clamp(box.y + dy,0,bottom-.05) : box.y;
  const r = handle.includes("e") ? clamp(right + dx,x+.05,1) : right;
  const b = handle.includes("s") ? clamp(bottom + dy,y+.05,1) : bottom;
  return {x, y, w:r-x, h:b-y};
}

export function GroupCropEditor({id, version, revision, source, en, onClose, onSaved, onReload}: {
  onReload:()=>Promise<void>;
  id:string; version:string; revision:string; source:PhotoSource; en:boolean; onClose:()=>void; onSaved:(crop:Box | null, revision:string)=>void;
}) {
  const [image,setImage] = useState<Awaited<ReturnType<typeof calibrationImage>>>();
  const [box,setBox] = useState<Box>();
  const [error,setError] = useState<"load" | "save" | "changed" | "crop-changed" | null>(null);
  const [saving,setSaving] = useState(false);
  const [reloadFailed,setReloadFailed] = useState(false);
  const conflict = error === "crop-changed" || error === "changed";
  const drag = useRef<Drag | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    calibrationImage(source,controller.signal,true).then(photo => {
      if (controller.signal.aborted) { URL.revokeObjectURL(photo.url); return; }
      url = photo.url;
      setImage(photo);
      const {face,width,height} = photo;
      setBox(source.crop ?? {x:face.x/width,y:face.y/height,w:face.w/width,h:face.h/height});
    }).catch(() => { if (!controller.signal.aborted) setError("load"); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  },[source]);

  function begin(event: ReactPointerEvent<HTMLButtonElement>, handle: Handle) {
    if (saving || drag.current || !box || !surface.current || event.button !== 0) return;
    const {width,height} = surface.current.getBoundingClientRect();
    event.preventDefault();
    event.currentTarget.focus({preventScroll:true});
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {id:event.pointerId,handle,box,x:event.clientX,y:event.clientY,width,height};
  }
  function move(event: ReactPointerEvent) {
    const start = drag.current;
    if (start?.id !== event.pointerId) return;
    setBox(adjust(start.box,start.handle,(event.clientX-start.x)/start.width,(event.clientY-start.y)/start.height));
  }
  function end(event: ReactPointerEvent) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }
  async function save(value: Box | null) {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/studio/crop",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,version,revision,box:value})});
      if (response.ok) onSaved(value,(await response.json()).revision);
      else if (response.status === 409) {
        const result = await response.json();
        setError(result.error === "crop-changed" ? "crop-changed" : result.error === "image-changed" ? "changed" : "save");
      } else setError("save");
    } catch { setError("save"); }
    finally { setSaving(false); }
  }
  async function reload() {
    setSaving(true);
    setReloadFailed(false);
    try { await onReload(); setError(null); }
    catch { setReloadFailed(true); }
    finally { setSaving(false); }
  }
  function control(handle: Handle, label:string) {
    return <button key={handle} type="button" className={"group-crop-control crop-"+handle} aria-label={label} disabled={saving}
      onPointerDown={event => begin(event,handle)} onKeyDown={event => {
        if (!box || !image || !["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const step = event.shiftKey ? 5 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        setBox(adjust(box,handle,dx/image.width,dy/image.height));
      }} />;
  }
  return <div className="group-calibration">
    <div className="group-crop-heading">
      <strong>{source.name}</strong>
      <div className="group-photo-actions">
        <button type="button" className="btn" disabled={!box || saving || conflict} onClick={() => box && save(box)}>{en ? "Save crop" : "保存裁切"}</button>
        {source.crop && <button type="button" className="showcase-tool" disabled={saving || conflict} onClick={() => save(null)}>{en ? "Use automatic" : "恢复自动"}</button>}
        <button type="button" className="showcase-tool" disabled={saving} onClick={onClose}>{en ? "Close" : "关闭"}</button>
      </div>
    </div>
    <p>{en ? "Drag the frame to move it. Drag an edge or corner to resize it." : "拖动框内可移动，拖动边缘或四角可调整大小。"}</p>
    {image && box ? <div className="group-crop-surface" ref={surface}
      style={{width:`min(100%, ${58*image.width/image.height}vh, ${640*image.width/image.height}px)`,aspectRatio:image.width+"/"+image.height}}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <img src={image.url} alt={source.name} draggable={false} />
      <div className="group-crop-frame" style={{left:box.x*100+"%", top:box.y*100+"%",width:box.w*100+"%",height:box.h*100+"%"}}>
        {control("move",en ? "Move crop frame" : "移动裁切框")}
        {handles.map(([handle,zh,english]) => control(handle,en ? "Resize "+english : "调整"+zh))}
      </div>
    </div> : !error && <p role="status">{en ? "Loading…" : "读取中…"}</p>}
    {conflict && <button type="button" className="showcase-tool" onClick={reload} disabled={saving}>{en ? "Load latest crop" : "载入最新裁切"}</button>}
    {error && <p role="alert">{reloadFailed ? (en ? "Could not load the latest crop. Try again." : "最新裁切读取失败，请重试。")
      : error === "crop-changed" ? (en ? "Another window updated the crop." : "裁切已在其他窗口更新。")
      : error === "changed" ? (en ? "The studio image changed." : "展馆图已更新。")
      : error === "load" ? (en ? "Could not load this image. Refresh the page and try again." : "图片读取失败，请刷新页面后重试。")
      : (en ? "Could not save the crop. Your frame is still here. Try again." : "裁切保存失败，当前框选已保留，请重试。")}</p>}

  </div>;
}
