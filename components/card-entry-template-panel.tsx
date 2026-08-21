"use client";

import { useEffect, useRef, useState } from "react";
import {
  cardEntryTemplateFields,
  type CardEntryTemplateSummary
} from "@/lib/card-entry-template-domain";
import { readCardFormValues } from "@/lib/card-entry-domain";
import { closestCardForm, setCardFormText } from "@/lib/card-form-controls";

type TemplateResponse = {
  template?: CardEntryTemplateSummary;
  templates?: CardEntryTemplateSummary[];
  error?: string;
};

function applyTemplateToForm(
  form: HTMLFormElement,
  template: CardEntryTemplateSummary
) {
  for (const field of cardEntryTemplateFields) {
    setCardFormText(form, field, template.values[field]);
  }
}

export function CardEntryTemplatePanel() {
  const panelRef = useRef<HTMLDetailsElement>(null);
  const [templates, setTemplates] = useState<CardEntryTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/card-entry/templates")
      .then(async (response) => {
        const data = await response.json() as TemplateResponse;
        if (!response.ok) throw new Error(data.error || "读取模板失败。");
        if (active) setTemplates(data.templates ?? []);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "读取模板失败。");
      });
    return () => { active = false; };
  }, []);

  function selectTemplate(id: string) {
    setSelectedId(id);
    setName(templates.find((template) => template.id === id)?.name ?? "");
    setMessage("");
  }

  async function request(url: string, init: RequestInit): Promise<CardEntryTemplateSummary | undefined> {
    const response = await fetch(url, init);
    const data = await response.json() as TemplateResponse;
    if (!response.ok) throw new Error(data.error || "模板操作失败。");
    return data.template;
  }

  async function createTemplate() {
    const form = closestCardForm(panelRef.current);
    if (!form) return;
    setPending(true);
    try {
      const template = await request("/api/card-entry/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, values: readCardFormValues(new FormData(form)) })
      });
      if (!template) throw new Error("创建模板失败。");
      setTemplates((current) => [template, ...current]);
      setSelectedId(template.id);
      setName(template.name);
      setMessage("模板已创建。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建模板失败。");
    } finally {
      setPending(false);
    }
  }

  async function updateTemplate() {
    const form = closestCardForm(panelRef.current);
    if (!form || !selectedId) return;
    setPending(true);
    try {
      const template = await request(`/api/card-entry/templates/${encodeURIComponent(selectedId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, values: readCardFormValues(new FormData(form)) })
      });
      if (!template) throw new Error("更新模板失败。");
      setTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
      setName(template.name);
      setMessage("模板名称和公共字段已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新模板失败。");
    } finally {
      setPending(false);
    }
  }

  async function applyTemplate() {
    const form = closestCardForm(panelRef.current);
    const selected = templates.find((template) => template.id === selectedId);
    if (!form || !selected) return;
    setPending(true);
    try {
      const updated = await request(
        `/api/card-entry/templates/${encodeURIComponent(selected.id)}/use`,
        { method: "POST" }
      );
      applyTemplateToForm(form, updated ?? selected);
      if (updated) {
        setTemplates((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      }
      setMessage("模板公共字段已应用。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "应用模板失败。");
    } finally {
      setPending(false);
    }
  }

  async function deleteTemplate() {
    if (!selectedId || !window.confirm("确定删除这个录入模板吗？")) return;
    setPending(true);
    try {
      await request(`/api/card-entry/templates/${encodeURIComponent(selectedId)}`, {
        method: "DELETE"
      });
      setTemplates((current) => current.filter((item) => item.id !== selectedId));
      setSelectedId("");
      setName("");
      setMessage("模板已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除模板失败。");
    } finally {
      setPending(false);
    }
  }

  return (
    <details ref={panelRef} className="entry-template-panel">
      <summary>模板 <span>{templates.length}</span></summary>
      <div className="entry-template-controls">
        <label className="field">
          <span>已有模板</span>
          <select value={selectedId} onChange={(event) => selectTemplate(event.target.value)}>
            <option value="">选择模板</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>模板名称</span>
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </label>
      </div>
      <div className="entry-template-actions">
        <button type="button" className="btn btn-primary" disabled={pending || !selectedId} onClick={applyTemplate}>应用</button>
        <button type="button" className="btn btn-secondary" disabled={pending || !name.trim()} onClick={createTemplate}>保存为新模板</button>
        <button type="button" className="btn btn-secondary" disabled={pending || !selectedId || !name.trim()} onClick={updateTemplate}>更新模板</button>
        <button type="button" className="btn btn-secondary" disabled={pending || !selectedId} onClick={deleteTemplate}>删除</button>
      </div>
      {message ? <p className="muted" aria-live="polite">{message}</p> : null}
    </details>
  );
}
