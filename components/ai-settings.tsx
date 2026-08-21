"use client";

import { useEffect, useState } from "react";
import { DisclosureIcon } from "@/components/disclosure-icon";
import { errorMessage } from "@/lib/feedback-messages";
import type { AiProvider, PublicAiSettings, PublicCustomProviderSettings } from "@/lib/ai-settings";

type PublicSettings = PublicAiSettings & { keyRecoveryRequired?: boolean };

const emptySettings: PublicSettings = {
  provider: "azure",
  activeCustomId: "",
  keyRecoveryRequired: false,
  azure: { endpoint: "", deployment: "", hasApiKey: false },
  minimax: {
    endpoint: "https://api.minimax.io/v1/chat/completions",
    model: "MiniMax-VL-01",
    hasApiKey: false
  },
  customProviders: []
};

function providerName(provider: AiProvider): string {
  if (provider === "custom") return "未命名配置";
  return provider === "minimax" ? "MiniMax" : "Azure OpenAI";
}

function activeCustom(settings: PublicSettings): PublicCustomProviderSettings | undefined {
  return settings.customProviders.find((item) => item.id === settings.activeCustomId) ?? settings.customProviders[0];
}

function canTest(settings: PublicSettings, azureApiKey: string, minimaxApiKey: string): boolean {
  if (settings.provider === "custom") {
    const custom = activeCustom(settings);
    return Boolean(custom?.endpoint && custom.model);
  }
  return settings.provider === "minimax"
    ? Boolean(settings.minimax.endpoint && settings.minimax.model && (settings.minimax.hasApiKey || minimaxApiKey.trim()))
    : Boolean(settings.azure.endpoint && settings.azure.deployment && (settings.azure.hasApiKey || azureApiKey.trim()));
}

function createCustomId(existingIds: Set<string>): string {
  const randomPart = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let id = `custom-${randomPart}`;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `custom-${randomPart}-${suffix}`;
    suffix += 1;
  }
  return id;
}

type AiSettingsProps = { defaultOpen?: boolean };

export function AiSettings({ defaultOpen = false }: AiSettingsProps) {
  const [settings, setSettings] = useState<PublicSettings>(emptySettings);
  const [azureApiKey, setAzureApiKey] = useState("");
  const [minimaxApiKey, setMiniMaxApiKey] = useState("");
  const [customApiKeys, setCustomApiKeys] = useState<Record<string, string>>({});
  const [clearCustomApiKeys, setClearCustomApiKeys] = useState<Record<string, boolean>>({});
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      const desktopApi = window.cardVaultDesktop;
      setIsDesktop(Boolean(desktopApi));
      try {
        const nextSettings = desktopApi
          ? await desktopApi.getAiSettings()
          : ((await fetch("/api/ai/settings").then((response) => response.json())) as PublicSettings);
        if (!cancelled) {
          const loadedSettings: PublicSettings = {
            provider: nextSettings.provider ?? emptySettings.provider,
            activeCustomId: nextSettings.activeCustomId ?? "",
            keyRecoveryRequired: Boolean(nextSettings.keyRecoveryRequired),
            azure: { ...emptySettings.azure, ...nextSettings.azure },
            minimax: { ...emptySettings.minimax, ...nextSettings.minimax },
            customProviders: Array.isArray(nextSettings.customProviders) ? nextSettings.customProviders : []
          };
          setSettings(loadedSettings);
          if (loadedSettings.keyRecoveryRequired) {
            setMessage("检测到旧 API Key 无法由当前 Windows 环境解密，请重新输入 API Key 并保存；其他设置已保留。");
          }
        }
      } catch (error) {
        if (!cancelled) setMessage("读取 AI 设置失败：" + errorMessage(error, "请重新启动 Card Vault 后重试。"));
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentCustom = activeCustom(settings);

  function buildDraftPayload() {
    return {
      provider: settings.provider,
      activeCustomId: settings.activeCustomId,
      azure: {
        endpoint: settings.azure.endpoint,
        apiKey: azureApiKey || undefined,
        deployment: settings.azure.deployment
      },
      minimax: {
        endpoint: settings.minimax.endpoint,
        apiKey: minimaxApiKey || undefined,
        model: settings.minimax.model
      },
      customProviders: settings.customProviders.map((item) => ({
        id: item.id,
        name: item.name,
        endpoint: item.endpoint,
        modelsEndpoint: item.modelsEndpoint,
        apiKey: clearCustomApiKeys[item.id] ? "" : customApiKeys[item.id] || undefined,
        model: item.model,
        apiKeyHeader: item.apiKeyHeader,
        apiKeyPrefix: item.apiKeyPrefix
      }))
    };
  }

  function handleProviderChange(value: string) {
    setModelOptions([]);
    setMessage(null);
    if (value.startsWith("custom:")) {
      const activeCustomId = value.slice("custom:".length);
      setSettings((current) => ({ ...current, provider: "custom", activeCustomId }));
      return;
    }
    setSettings((current) => ({ ...current, provider: value === "minimax" ? "minimax" : "azure" }));
  }

  function addCustomProvider() {
    setSettings((current) => {
      const id = createCustomId(new Set(current.customProviders.map((item) => item.id)));
      const next: PublicCustomProviderSettings = {
        id,
        name: `自定义配置 ${current.customProviders.length + 1}`,
        endpoint: "",
        modelsEndpoint: "",
        model: "",
        apiKeyHeader: "Authorization",
        apiKeyPrefix: "Bearer",
        hasApiKey: false
      };
      return {
        ...current,
        provider: "custom",
        activeCustomId: id,
        customProviders: [...current.customProviders, next]
      };
    });
    setModelOptions([]);
    setMessage("已新增一项自定义配置，请填写名称、Endpoint 和 Model 后保存。");
  }

  function deleteCurrentCustomProvider() {
    if (!currentCustom || !window.confirm(`确认删除自定义配置“${currentCustom.name}”吗？保存设置后删除生效。`)) return;
    const deletedId = currentCustom.id;
    setSettings((current) => {
      const customProviders = current.customProviders.filter((item) => item.id !== deletedId);
      const nextActive = customProviders[0];
      return {
        ...current,
        provider: nextActive ? "custom" : "azure",
        activeCustomId: nextActive?.id ?? "",
        customProviders
      };
    });
    setCustomApiKeys((current) => {
      const next = { ...current };
      delete next[deletedId];
      return next;
    });
    setClearCustomApiKeys((current) => {
      const next = { ...current };
      delete next[deletedId];
      return next;
    });
    setModelOptions([]);
    setMessage("自定义配置已从当前草稿移除，请点击“保存设置”确认删除。");
  }

  function updateCurrentCustom(patch: Partial<PublicCustomProviderSettings>) {
    if (!currentCustom) return;
    setSettings((current) => ({
      ...current,
      customProviders: current.customProviders.map((item) => item.id === currentCustom.id ? { ...item, ...patch } : item)
    }));
  }

  async function handleSave() {
    if (!window.cardVaultDesktop) {
      setMessage("当前环境不支持在界面中保存设置；开发态请使用 .env.local。");
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const saved = await window.cardVaultDesktop.saveAiSettings(buildDraftPayload());
      const loaded: PublicSettings = {
        provider: saved.provider,
        activeCustomId: saved.activeCustomId,
        keyRecoveryRequired: false,
        azure: { ...emptySettings.azure, ...saved.azure },
        minimax: { ...emptySettings.minimax, ...saved.minimax },
        customProviders: saved.customProviders
      };
      setSettings(loaded);
      setAzureApiKey("");
      setMiniMaxApiKey("");
      setCustomApiKeys({});
      setClearCustomApiKeys({});
      const savedCustom = activeCustom(loaded);
      const name = loaded.provider === "custom" ? savedCustom?.name || "未命名配置" : providerName(loaded.provider);
      setMessage(name + " 设置已加密保存并立即生效，无需重启 Card Vault。");
    } catch (error) {
      setMessage("保存失败：" + errorMessage(error, "请稍后重试。"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setIsTesting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ai/test-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDraftPayload())
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      const name = settings.provider === "custom" ? currentCustom?.name || "未命名配置" : providerName(settings.provider);
      if (!response.ok || !data.ok) throw new Error(data.error || name + " 连接测试失败。");
      setMessage(name + " 连接测试通过。");
    } catch (error) {
      const fallback = settings.provider === "custom"
        ? "请检查当前自定义配置的 Endpoint、Model 和 API Key。"
        : settings.provider === "minimax"
          ? "请检查 MiniMax Endpoint、API Key 和 Model。"
          : "请检查 Azure Endpoint、API Key 和 Deployment。";
      setMessage(errorMessage(error, fallback));
    } finally {
      setIsTesting(false);
    }
  }

  async function handleLoadModels() {
    setIsLoadingModels(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildDraftPayload())
      });
      const data = (await response.json()) as { models?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error || "读取模型失败。");
      const models = data.models ?? [];
      setModelOptions(models);
      setMessage(models.length > 0 ? `已读取 ${models.length} 个模型。` : "没有读取到可用模型。");
    } catch (error) {
      setMessage(errorMessage(error, "请检查当前服务商的 Endpoint 和 API Key。"));
    } finally {
      setIsLoadingModels(false);
    }
  }

  function handleModelOptionChange(value: string) {
    if (settings.provider === "custom") {
      updateCurrentCustom({ model: value });
      return;
    }
    if (settings.provider === "minimax") {
      setSettings((current) => ({ ...current, minimax: { ...current.minimax, model: value } }));
      return;
    }
    setSettings((current) => ({ ...current, azure: { ...current.azure, deployment: value } }));
  }

  const testable = canTest(settings, azureApiKey, minimaxApiKey);
  const modelsReadable = settings.provider === "custom"
    ? Boolean(currentCustom?.endpoint)
    : settings.provider === "minimax"
      ? Boolean(settings.minimax.endpoint && (settings.minimax.hasApiKey || minimaxApiKey.trim()))
      : Boolean(settings.azure.endpoint && (settings.azure.hasApiKey || azureApiKey.trim()));
  const selectedProviderValue = settings.provider === "custom" ? `custom:${currentCustom?.id || ""}` : settings.provider;
  const selectedModel = settings.provider === "custom"
    ? currentCustom?.model || ""
    : settings.provider === "minimax"
      ? settings.minimax.model
      : settings.azure.deployment;

  return (
    <section className="panel settings-section ai-settings-panel">
      <button
        type="button"
        className="ai-settings-toggle"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "收起 AI 设置" : "展开 AI 设置"}
      >
        <span>
          <strong>AI 设置</strong>
        </span>
        <DisclosureIcon expanded={isOpen} />
      </button>

      {isOpen ? (
        <>
          <p className="muted" style={{ margin: "0.75rem 0" }}>
            配置 AI 识图、分享文案和组合分析共用的服务商、模型与连接信息。
          </p>

          <div className="form-grid">
            <label className="field">
              <span>当前服务</span>
              <select value={selectedProviderValue} onChange={(event) => handleProviderChange(event.target.value)} disabled={!isDesktop}>
                <option value="azure">Azure OpenAI</option>
                <option value="minimax">MiniMax</option>
                {settings.customProviders.map((item) => (
                  <option key={item.id} value={`custom:${item.id}`}>{item.name || "未命名配置"}</option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>自定义配置</span>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-secondary" onClick={addCustomProvider} disabled={!isDesktop}>新增自定义 AI</button>
                {settings.provider === "custom" && currentCustom ? (
                  <button type="button" className="btn btn-danger" onClick={deleteCurrentCustomProvider} disabled={!isDesktop}>删除当前配置</button>
                ) : null}
              </div>
            </div>

            {settings.provider === "azure" ? (
              <>
                <label className="field">
                  <span>Azure Endpoint</span>
                  <input value={settings.azure.endpoint} onChange={(event) => setSettings((current) => ({ ...current, azure: { ...current.azure, endpoint: event.target.value } }))} placeholder="https://your-resource.openai.azure.com 或 https://your-resource.services.ai.azure.com" disabled={!isDesktop} />
                </label>
                <label className="field">
                  <span>Deployment</span>
                  <input value={settings.azure.deployment} onChange={(event) => setSettings((current) => ({ ...current, azure: { ...current.azure, deployment: event.target.value } }))} placeholder="你的部署名称" disabled={!isDesktop} />
                </label>
                <label className="field">
                  <span>Azure API Key</span>
                  <input value={azureApiKey} type="password" onChange={(event) => setAzureApiKey(event.target.value)} placeholder={settings.azure.hasApiKey ? "已保存；留空则不修改" : "请输入 API Key"} disabled={!isDesktop} />
                </label>
              </>
            ) : settings.provider === "minimax" ? (
              <>
                <label className="field">
                  <span>MiniMax Endpoint</span>
                  <input value={settings.minimax.endpoint} onChange={(event) => setSettings((current) => ({ ...current, minimax: { ...current.minimax, endpoint: event.target.value } }))} placeholder="https://api.minimax.io/v1/chat/completions" disabled={!isDesktop} />
                </label>
                <label className="field">
                  <span>Model</span>
                  <input value={settings.minimax.model} onChange={(event) => setSettings((current) => ({ ...current, minimax: { ...current.minimax, model: event.target.value } }))} placeholder="MiniMax-VL-01" disabled={!isDesktop} />
                </label>
                <label className="field">
                  <span>MiniMax API Key</span>
                  <input value={minimaxApiKey} type="password" onChange={(event) => setMiniMaxApiKey(event.target.value)} placeholder={settings.minimax.hasApiKey ? "已保存；留空则不修改" : "请输入 API Key"} disabled={!isDesktop} />
                </label>
              </>
            ) : currentCustom ? (
              <>
                <label className="field">
                  <span>显示名称 *</span>
                  <input value={currentCustom.name} onChange={(event) => updateCurrentCustom({ name: event.target.value })} placeholder="例如 OpenRouter、DeepSeek 或本地模型" disabled={!isDesktop} />
                </label>
                <label className="field">
                  <span>Chat Completions Endpoint *</span>
                  <input value={currentCustom.endpoint} onChange={(event) => updateCurrentCustom({ endpoint: event.target.value })} placeholder="https://example.com/v1/chat/completions" disabled={!isDesktop} />
                </label>
                <label className="field">
                  <span>Model *</span>
                  <input value={currentCustom.model} onChange={(event) => updateCurrentCustom({ model: event.target.value })} placeholder="服务商提供的模型 ID" disabled={!isDesktop} />
                </label>
                <label className="field">
                  <span>API Key（可选）</span>
                  <input
                    value={customApiKeys[currentCustom.id] || ""}
                    type="password"
                    onChange={(event) => {
                      setCustomApiKeys((current) => ({ ...current, [currentCustom.id]: event.target.value }));
                      setClearCustomApiKeys((current) => ({ ...current, [currentCustom.id]: false }));
                    }}
                    placeholder={currentCustom.hasApiKey ? "已保存；留空则不修改" : "本地无鉴权服务可留空"}
                    disabled={!isDesktop}
                  />
                </label>
                {currentCustom.hasApiKey ? (
                  <label className="field">
                    <span>已保存密钥</span>
                    <span>
                      <input
                        type="checkbox"
                        checked={Boolean(clearCustomApiKeys[currentCustom.id])}
                        onChange={(event) => {
                          setClearCustomApiKeys((current) => ({ ...current, [currentCustom.id]: event.target.checked }));
                          if (event.target.checked) setCustomApiKeys((current) => ({ ...current, [currentCustom.id]: "" }));
                        }}
                        disabled={!isDesktop}
                      />{" "}
                      保存时清除 API Key
                    </span>
                  </label>
                ) : null}
                <label className="field full">
                  <span>模型列表 Endpoint（可选）</span>
                  <input value={currentCustom.modelsEndpoint} onChange={(event) => updateCurrentCustom({ modelsEndpoint: event.target.value })} placeholder="留空时从 /chat/completions 自动推断 /models" disabled={!isDesktop} />
                </label>
                <p className="muted full" style={{ margin: 0 }}>
                  适用于 OpenAI Chat Completions 兼容服务；API Key 默认使用 Authorization: Bearer 发送。用于识图时，请选择支持图片输入的多模态模型。
                </p>
              </>
            ) : (
              <p className="muted full">尚未创建自定义配置，请点击“新增自定义 AI”。</p>
            )}

            {modelOptions.length > 0 ? (
              <label className="field">
                <span>{settings.provider === "azure" ? "选择 Deployment" : "选择模型"}</span>
                <select value={selectedModel} onChange={(event) => handleModelOptionChange(event.target.value)}>
                  <option value="">请选择</option>
                  {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
              </label>
            ) : null}
          </div>

          <div className="ai-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isDesktop !== true || isSaving}>{isSaving ? "保存中..." : "保存设置"}</button>
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={isTesting || !testable}>{isTesting ? "测试中..." : "测试连接"}</button>
            <button type="button" className="btn btn-secondary" onClick={handleLoadModels} disabled={isLoadingModels || !modelsReadable}>{isLoadingModels ? "读取中..." : "读取模型"}</button>
          </div>

          {isDesktop === false ? <p className="muted" style={{ margin: "0.65rem 0 0" }}>当前不是桌面端环境，界面内保存不可用；开发态可通过 .env.local 配置 AI 服务商。</p> : null}
        </>
      ) : null}

      {message ? <p className="muted" style={{ margin: "0.65rem 0 0" }}>{message}</p> : null}
    </section>
  );
}
