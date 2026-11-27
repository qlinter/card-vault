"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { groupStyles, groupStageLimit, type Box, type GroupPhotoStyle } from "@/lib/group-photo-geometry";
import { renderGroupPhoto, type PhotoSource } from "@/lib/group-photo-render";
import { PhotoAiError, requestStagePlate } from "@/lib/group-photo-ai-client";
import type { StudioStagePlan } from "@/lib/group-photo-stage-plan";
import { searchTerms } from "@/lib/search-terms";
import { GroupCropEditor } from "./group-crop-editor";
import { useLanguage } from "./language-provider";
import { ShowcaseImage } from "./showcase-image";
import { ShowcaseIcon } from "./showcase-icon";

type Candidate = { id: string; name: string; title: string; searchText: string; visibility: string; graded: boolean; studio: string | null; thumb: string | null; revision:string; version: string | null; crop: Box | null };

export function GroupPhotoEditor({ cards }: { cards: Candidate[] }) {
  const en = useLanguage().locale === "en";
  const [ordered, setOrdered] = useState(cards);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(100);
  const [selected, setSelected] = useState(() => new Set(cards.map(card => card.id)));
  const [template, setTemplate] = useState<GroupPhotoStyle | "auto">("auto");
  const [title, setTitle] = useState("");
  const [calibrating, setCalibrating] = useState<{ id: string; source: PhotoSource; version: string; revision:string } | null>(null);
  const [preview, setPreview] = useState<{ url: string; width: number; height: number; faceLong: number; refined: boolean } | null>(null);
  const [task, setTask] = useState<"local" | "stage" | null>(null);
  const [error, setError] = useState<{text:string; ai:boolean} | null>(null);
  const busy = task !== null;
  const cachedPlate = useRef<{digest:string; png:Blob} | null>(null);
  const [processed, setProcessed] = useState(0);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => { current.current?.abort(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  function stop() { current.current?.abort(); setTask(null); }
  function invalidate() { stop(); setPreview(null); setError(null); }
  const chosen = ordered.filter(card => selected.has(card.id)), count = chosen.length;
  const terms = searchTerms(query), searching = terms.length > 0;
  const visible = searching ? ordered.filter(card => terms.every(term => card.searchText.includes(term))) : ordered;
  const visibleChosen = searching ? visible.filter(card => selected.has(card.id)) : chosen;
  const style = template === "auto" ? count <= groupStageLimit ? "stage" : "wall" : template;
  const limit = groupStyles[style], mosaic = style === "mosaic";
  const missing = chosen.filter(card => !card.studio);
  const restricted = chosen.filter(card => card.visibility !== "public").length;
  const problem = !count ? en ? "Select at least one card." : "请至少选择一张卡牌。"
    : count < limit.min ? en ? `${limit.en} needs at least ${limit.min} cards.` : `${limit.zh}至少需要 ${limit.min} 张卡牌。`
    : count > limit.max ? en ? `${limit.en} supports up to ${limit.max} cards. Adjust the selection or composition.` : `${limit.zh}最多 ${limit.max} 张，请调整选卡或构图。`
    : missing.length ? en ? `${missing.length} selected cards need an accepted studio image.` : `有 ${missing.length} 张缺少已采用的 AI 展馆图，请先补图或移出选择。` : "";
  function sourceFor(card: Candidate): PhotoSource {
    if (!card.studio) throw new Error(card.name);
    return { url: card.studio,
      graded: card.graded, name: card.name, crop: card.crop ?? undefined };
  }
  function move(card: Candidate, delta: number) {
    const next = [...ordered], other = visibleChosen[visibleChosen.indexOf(card) + delta];
    if (!other) return;
    const a = next.indexOf(card), b = next.indexOf(other);
    [next[a], next[b]] = [next[b], next[a]]; invalidate(); setOrdered(next);
  }
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    invalidate(); setSelected(next);
  }
  function selectVisible(action: "add" | "remove" | "only") {
    const next = action === "only" ? new Set<string>() : new Set(selected);
    for (const card of visible) {
      if (action === "remove") next.delete(card.id);
      else next.add(card.id);
    }
    invalidate(); setSelected(next);
  }
  async function refineStage(photo: Blob, plan: StudioStagePlan, signal: AbortSignal) {
    const digest = JSON.stringify(plan) + Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await photo.arrayBuffer()))).join(",");
    if (!preview?.refined && cachedPlate.current?.digest === digest) return cachedPlate.current.png;
    const png = await requestStagePlate(photo,plan,signal);
    signal.throwIfAborted();
    cachedPlate.current = {digest,png};
    return png;
  }
  async function generate(mode: "local" | "stage") {
    if (busy || problem) return;
    const controller = new AbortController(); current.current = controller; setProcessed(0); setTask(mode); setError(null); setCalibrating(null);
    try {
      const { png, width, height, faceLong } = await renderGroupPhoto(chosen.map(card => sourceFor(card)), style, title.trim(), controller.signal, done => {
        if (!controller.signal.aborted && (done === count || done % Math.max(1, Math.ceil(count / 100)) === 0)) setProcessed(done);
      }, mode === "stage" ? refineStage : undefined);
      if (!controller.signal.aborted) setPreview({ url: URL.createObjectURL(png), width, height, faceLong, refined:mode === "stage" });
    } catch (err) {
      if (!controller.signal.aborted) {
        const name = err instanceof Error && chosen.some(card => card.name === err.message) ? err.message : "";
        if (err instanceof PhotoAiError) {
          setError({text:err.describe(en),ai:true});
        } else setError({text:(en ? "Could not render the photo. Check the source image and try again. " : "合成失败，请检查图片后重试。") + name,ai:false});
      }
    } finally { if (!controller.signal.aborted) setTask(null); }
  }
  return <div className="group-photo-editor">
    <section className="group-photo-selection">
      <div className="group-photo-heading"><h2>{en ? "Cards" : "合影选卡"} <small>{en ? "Selected" : "已选"} {count} / {cards.length}</small></h2>
        <div>{searching && <button className="showcase-tool" disabled={!visible.length || (visibleChosen.length === count && visibleChosen.length === visible.length)} onClick={() => selectVisible("only")}>{en ? "Only matches" : "仅选结果"}</button>}
          <button className="showcase-tool" disabled={visibleChosen.length === visible.length} onClick={() => selectVisible("add")}>{searching ? en ? "Add matches" : "加入结果" : en ? "Select all" : "全选"}</button>
          <button className="showcase-tool" disabled={!visibleChosen.length} onClick={() => selectVisible("remove")}>{searching ? en ? "Remove matches" : "移除结果" : en ? "Clear" : "清空"}</button></div>
      </div>
      <div className="group-photo-search">
        <label><ShowcaseIcon name="search" /><input type="search" aria-label={en ? "Search cards" : "搜索卡牌"} placeholder={en ? "Player, card, team, series…" : "搜索球员、卡名、球队、系列…"} value={query} onChange={e => { setQuery(e.target.value); setShown(100); }} /></label>
        {searching && <small role="status">{en ? `${visible.length} found` : `${visible.length} 张匹配`}</small>}
      </div>
      {searching && !visible.length && <p className="group-photo-empty">{en ? "No matching cards. Try a different keyword." : "没有匹配的卡牌，试试其他关键词。"}</p>}
      <ul className="group-photo-list">
        {visible.slice(0, shown).map(card => <li key={card.id}>
          <label className="group-card-label">
            <input type="checkbox" checked={selected.has(card.id)} onChange={() => toggle(card.id)} />
            <span className="group-card-thumb"><ShowcaseImage src={card.thumb ?? undefined} alt="" /></span>
            <span><strong>{card.name}</strong><span>{card.title}</span>
              {card.visibility !== "public" && <small>{card.visibility === "private" ? en ? "Private" : "私密" : en ? "Unlisted" : "仅链接可见"}</small>}</span>
          </label>
          {selected.has(card.id) && <div className="group-card-tools">
            {card.crop && <small>{en ? "Calibrated" : "已较准"}</small>}
            {card.studio ? <button className="showcase-tool" disabled={busy} onClick={() => setCalibrating({id:card.id, source:sourceFor(card), version:card.version!, revision:card.revision})}>{en ? "Calibrate page" : "较准页面"}</button>
              : <Link className="showcase-tool" href={`/cards/${encodeURIComponent(card.id)}/edit#studio-image`}>{en ? "Generate studio image" : "去补展馆图"}</Link>}
            <button aria-label={en ? "Move up" : "上移"} className="showcase-tool" disabled={card === visibleChosen[0]} onClick={() => move(card, -1)}>↑</button>
            <button aria-label={en ? "Move down" : "下移"} className="showcase-tool" disabled={card === visibleChosen.at(-1)} onClick={() => move(card, 1)}>↓</button>
          </div>}
        </li>)}
      </ul>
      {shown < visible.length && <button className="showcase-tool" onClick={() => setShown(shown + 100)}>{en ? "Show more" : "显示更多"} · {shown} / {visible.length}</button>}
    </section>
    <section className="group-photo-output">
      <div className="group-photo-fields"><label>{en ? "Composition" : "构图"}<select value={template} onChange={e => { invalidate(); setCalibrating(null); setTemplate(e.target.value as typeof template); }}>
        <option value="auto">{en ? "Automatic" : "自动"}</option>
        {Object.entries(groupStyles).map(([key, item]) => <option key={key} value={key}>{en ? item.en : item.zh} · {item.min}–{item.max} {en ? "cards" : "张"}</option>)}</select></label>
        {mosaic ? <p className="group-mosaic-note">{en ? "All faces are vertical. Landscape faces turn 90° clockwise." : "卡面统一竖排，横版卡顺时针旋转 90°。"}</p>
          : <label>{en ? "Title (optional)" : "标题（选填）"}<input value={title} maxLength={80} onChange={e => { invalidate(); setTitle(e.target.value); }} /></label>}</div>
      {calibrating ? <GroupCropEditor key={JSON.stringify([calibrating.id, calibrating.version, calibrating.revision])} id={calibrating.id} version={calibrating.version} revision={calibrating.revision} source={calibrating.source} en={en}
        onReload={async () => {
          const {id} = calibrating;
          const response = await fetch("/api/studio/crop?id=" + encodeURIComponent(id), {cache:"no-store"});
          if (!response.ok) throw new Error("Crop unavailable");
          const asset: Pick<Candidate, "crop" | "revision" | "version" | "studio" | "thumb"> = await response.json();
          invalidate();
          setOrdered(previous => previous.map(card => card.id === id ? {...card, ...asset} : card));
          setCalibrating(current => current !== calibrating ? current : asset.studio && asset.version
            ? {...calibrating, revision:asset.revision, version:asset.version, source:{...calibrating.source, url:asset.studio, crop:asset.crop ?? undefined}}
            : null);
        }}
        onClose={() => setCalibrating(null)} onSaved={(box, revision) => {
          const id = calibrating.id;
          invalidate();
          setOrdered(previous => previous.map(card => card.id === id ? {...card, crop:box, revision} : card));
          setCalibrating(current => current?.id === id ? null : current);
        }} /> : <div className="group-photo-preview">
        {preview ? <img src={preview.url} alt={en ? "Group photo preview" : "合影预览"} /> : <span>{busy ? en ? "Rendering…" : "合成中…" : en ? "Photo preview" : "合影预览"}</span>}
      </div>}
      <div className="group-photo-actions">
        <button className="btn" disabled={busy || !!calibrating || Boolean(problem)} onClick={() => generate("local")}>{task === "local" ? en ? "Rendering…" : "合成中…" : en ? "Generate preview" : "生成预览"}</button>
        {!mosaic && <button className="btn btn-secondary" disabled={busy || !!calibrating || !!problem} onClick={() => generate("stage")}>{task === "stage" ? en ? "Refining…" : "精修中…" : preview?.refined ? en ? "Generate new set" : "重新生成展台" : en ? "AI studio lighting" : "AI 展台精修"}</button>}
        {busy && <>{mosaic && <span role="status">{processed} / {count}</span>}<button className="showcase-tool" onClick={stop}>{en ? "Cancel" : "取消"}</button></>}
        {missing.length > 0 && <button className="showcase-tool" onClick={() => { invalidate(); setSelected(new Set(chosen.filter(card => card.studio).map(card => card.id))); }}>{en ? "Deselect missing images" : "移出缺图卡牌"}</button>}
        {preview && <a className="btn" href={preview.url} download={(mosaic ? "Card Vault Mosaic" : title.trim().replace(/[<>:"/\\|?*]/g, "") || "Card Vault") + ".png"}>{en ? "Download PNG" : "下载 PNG"}</a>}
      </div>
      <div aria-live="polite" className="group-photo-status">{error?.text || problem}
        {!mosaic && <p>{en ? "AI uses the first selected studio photo as the set reference." : "AI 展台精修使用已选第一张展馆图作为摄影参考。"}</p>}
        {error?.ai && <Link className="showcase-tool" href="/settings?section=ai#studio-photos">{en ? "Image AI settings" : "图片 AI 设置"}</Link>}
        {preview && <p>{preview.refined && (en ? "AI studio lighting · " : "AI 展台精修 · ")}{preview.width} × {preview.height} px · {en ? "Card face long edge" : "卡面长边"} {preview.faceLong} px</p>}
        {restricted > 0 && <p>{en ? `Selection includes ${restricted} private or unlisted cards.` : `已选卡牌中含 ${restricted} 张私密或仅链接可见的卡牌。`}</p>}
      </div>
    </section>
  </div>;
}
