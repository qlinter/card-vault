"use client";

import { useEffect, useState } from "react";
import { calibrationImage, type PhotoSource } from "@/lib/group-photo-render";

type Point = { x: number; y: number };
export function GroupPhotoCalibration({ source, en, onSave, onClose }: {
  source: PhotoSource; en: boolean; onSave: (ratio?: number) => void; onClose: () => void;
}) {
  const [image, setImage] = useState<Awaited<ReturnType<typeof calibrationImage>>>();
  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    calibrationImage(source, controller.signal).then(value => { if (!controller.signal.aborted) setImage(value); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [source]);
  const distance = points.length === 2 && image ? Math.hypot((points[1].x - points[0].x) * image.width, (points[1].y - points[0].y) * image.height) / Math.max(image.width, image.height) : 0;
  return <div className="group-calibration">
    <strong>{source.name}</strong>
    <p>{en ? "Click the two ends of one long edge of the printed card, inside its holder." : "在内层卡面的同一条长边上，依次点击两个端点。"}</p>
    {image ? <button type="button" className="group-calibration-surface" aria-label={en ? "Mark an endpoint. Use arrow keys and Enter." : "标记端点，可用方向键移动，回车确认"} style={{ aspectRatio: image.width + "/" + image.height }}
      onKeyDown={event => {
        const shift: Record<string, Point> = { ArrowLeft: { x: -.01, y: 0 }, ArrowRight: { x: .01, y: 0 }, ArrowUp: { x: 0, y: -.01 }, ArrowDown: { x: 0, y: .01 } };
        const step = shift[event.key];
        if (step) { event.preventDefault(); setCursor(p => ({ x: Math.max(0, Math.min(1, (p?.x ?? .5) + step.x)), y: Math.max(0, Math.min(1, (p?.y ?? .5) + step.y)) })); }
      }} onClick={event => {
        let point = cursor ?? { x: .5, y: .5 };
        if (event.detail !== 0) {
          const transform = event.currentTarget.querySelector("svg")?.getScreenCTM();
          if (!transform) return;
          const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse());
          point = { x: local.x / image.width, y: local.y / image.height };
          if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
        }
        setPoints(old => old.length === 1 ? [...old, point] : [point]);
      }}><svg aria-hidden="true" viewBox={`0 0 ${image.width} ${image.height}`}>
      <image href={image.url} width={image.width} height={image.height} />
      {!points.length && <rect x={image.face.x} y={image.face.y} width={image.face.w} height={image.face.h} fill="none" stroke="white" strokeDasharray="3 2" />}
      {points.length === 2 && <line x1={points[0].x * image.width} y1={points[0].y * image.height} x2={points[1].x * image.width} y2={points[1].y * image.height} stroke="white" strokeWidth="2" />}
      {points.map((p, i) => <circle key={i} cx={p.x * image.width} cy={p.y * image.height} r="3" stroke="white" fill="#286357" />)}
      {cursor && <circle cx={cursor.x * image.width} cy={cursor.y * image.height} r="4" fill="none" stroke="white" />}
    </svg></button> : <p role="status">{failed ? en ? "Image unavailable." : "图片读取失败。" : en ? "Loading…" : "读取中…"}</p>}
    <div className="group-photo-actions">
      <button type="button" className="btn" disabled={distance < .05 || distance > 1.02} onClick={() => onSave(distance)}>{en ? "Apply" : "应用校准"}</button>
      <button type="button" className="showcase-tool" onClick={() => onSave()}>{en ? "Use automatic" : "恢复自动"}</button>
      <button type="button" className="showcase-tool" onClick={onClose}>{en ? "Close" : "关闭"}</button>
    </div>
  </div>;
}
