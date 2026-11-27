"use client";
import { studioImageService } from "@/lib/ai-settings-core";
import { useState } from "react";
import { useLanguage } from "./language-provider";
import type { PublicAiSettings } from "@/lib/ai-settings";

type Fields = PublicAiSettings["studio"];
type Props = {
  value: Fields; onChange: (patch: Partial<Fields>) => void;
  secret: string; onSecret: (key: string) => void;
  clear: boolean; onClear: (clear: boolean) => void; disabled: boolean;
};

export function StudioConfiguration({ value, onChange, secret, onSecret, clear, onClear, disabled }: Props) {
  const en = useLanguage().locale === "en";
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function check() {
    setChecking(true); setFeedback("");
    try {
      const response = await fetch("/api/studio/connection", { method: "POST" });
      const { result, model } = await response.json();
      const labels: Record<string, string> = en
        ? { ready: "Model accessible", key: "Save an API key first", access: "Check your key and model access", missing: "Model unavailable", limit: "Request limit reached" }
        : { ready: "模型可访问", key: "请先保存密钥", access: "请检查密钥及模型权限", missing: "模型不可用", limit: "请求受限，请稍后重试" };
      setFeedback((labels[result] ?? (en ? "Connection failed" : "连接失败")) + (model ? " · " + model : ""));
    } catch { setFeedback(en ? "Connection failed" : "连接失败"); }
    finally { setChecking(false); }
  }
  return <div className="studio-configuration">
    <div className="form-grid">
      <label className="field"><span>{en ? "Image service" : "生图服务"}</span><select value={studioImageService.id} disabled><option value={studioImageService.id}>{studioImageService.name}</option></select></label>
      <label className="field"><span>{en ? "Image model" : "图片模型"}</span><input value={value.model} disabled={disabled} placeholder={studioImageService.defaultModel} onChange={e => onChange({ model: e.target.value })} /></label>
      <label className="field"><span>{en ? "Key source" : "密钥来源"}</span><select value={value.keySource} disabled={disabled} onChange={e => onChange({ keySource: e.target.value === "independent" ? "independent" : "openai" })}>
        <option value="openai">{en ? `Use ${studioImageService.name} key` : `沿用 ${studioImageService.name} 密钥`}</option>
        <option value="independent">{en ? "Independent key" : "使用独立密钥"}</option>
      </select></label>
      {value.keySource === "independent" && <label className="field"><span>{en ? "Image API key" : "生图专用密钥"}</span><input type="password" autoComplete="new-password" value={secret} disabled={disabled}
        placeholder={value.hasApiKey ? (en ? "Saved; leave blank to keep" : "已保存；留空则不修改") : "API Key"} onChange={e => onSecret(e.target.value)} /></label>}
      {value.keySource === "independent" && value.hasApiKey && <label className="field full"><span><input type="checkbox" checked={clear} disabled={disabled} onChange={e => onClear(e.target.checked)} /> {en ? "Clear independent key on save" : "保存时清除独立密钥"}</span></label>}
    </div>
    <button type="button" className="btn btn-secondary" disabled={checking} onClick={check}>{en ? "Check saved model access" : "检查已保存模型"}</button>
    {feedback && <p aria-live="polite">{feedback}</p>}
  </div>;
}
