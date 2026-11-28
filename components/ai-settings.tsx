"use client";

import { SettingsSubsection } from "./settings-subsection";
import { AiProxySettings } from "./ai-proxy-settings";

import { UiText, UiElement } from "@/components/ui-text";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAiSettingsRequests } from "./use-ai-settings-requests";
import { StudioConfiguration } from "./studio-configuration";
import { StudioRecovery } from "./studio-recovery";
import { useLanguage } from "./language-provider";
import { DisclosureIcon } from "@/components/disclosure-icon";
import { errorMessage } from "@/lib/feedback-messages";
import { builtInAiProviders, normalizeProvider, normalizeSettings, publicAiSettings } from "@/lib/ai-settings-core";
import type { AiProvider, PublicAiSettings, PublicCustomProviderSettings } from "@/lib/ai-settings";

type PublicSettings = PublicAiSettings & { keyRecoveryRequired?: boolean };

const emptySettings: PublicSettings = publicAiSettings(normalizeSettings());
type SettingsSection = "recognition" | "studio" | "proxy";
type BuiltInProvider = Exclude<AiProvider, "custom">;
const emptyApiKeys: Record<BuiltInProvider, string> = { openai: "", minimax: "", deepseek: "" };

function loadedPublicSettings(value: Partial<PublicSettings>): PublicSettings {
  return {
    provider: value.provider ?? emptySettings.provider,
    activeCustomId: value.activeCustomId ?? "",
    keyRecoveryRequired: Boolean(value.keyRecoveryRequired),
    studio: { ...emptySettings.studio, ...value.studio },
    proxy: { ...emptySettings.proxy, ...value.proxy },
    openai: { ...emptySettings.openai, ...value.openai },
    minimax: { ...emptySettings.minimax, ...value.minimax },
    deepseek: { ...emptySettings.deepseek, ...value.deepseek },
    customProviders: Array.isArray(value.customProviders) ? value.customProviders : []
  };
}

function providerName(provider: AiProvider): string {
  if (provider === "custom") return "未命名配置";
  return builtInAiProviders[provider].name;
}

function activeCustom(settings: PublicSettings): PublicCustomProviderSettings | undefined {
  return settings.customProviders.find((item) => item.id === settings.activeCustomId) ?? settings.customProviders[0];
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
  const { locale, t } = useLanguage();
  const [settings, setSettings] = useState<PublicSettings>(emptySettings);
  const [studioKey, setStudioKey] = useState("");
  const [clearStudioKey, setClearStudioKey] = useState(false);
  const [savedSettings, setSavedSettings] = useState<PublicSettings | null>(null);
  const [saveRevision, setSaveRevision] = useState(0);
  const [apiKeys, setApiKeys] = useState(emptyApiKeys);
  const [proxyPassword, setProxyPassword] = useState("");
  const [clearProxyPassword, setClearProxyPassword] = useState(false);
  const [customApiKeys, setCustomApiKeys] = useState<Record<string, string>>({});
  const [clearCustomApiKeys, setClearCustomApiKeys] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [saving, setSaving] = useState<SettingsSection | null>(null);
  const loaded = savedSettings !== null;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveMessages, setSaveMessages] = useState<Partial<Record<SettingsSection, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const providerSelect = useRef<HTMLSelectElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const cancelDeleteButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (pendingDeleteId) cancelDeleteButton.current?.focus(); }, [pendingDeleteId]);

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
          const saved = loadedPublicSettings(nextSettings);
          setSavedSettings(saved);
          setSettings(saved);
        }
      } catch (error) {
        if (!cancelled) setLoadError("读取 AI 设置失败：" + errorMessage(error, "请重新启动 Card Vault 后重试。"));
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const savedStudioKey = savedSettings?.studio.keySource === "openai"
    ? savedSettings.openai.hasApiKey : Boolean(savedSettings?.studio.hasApiKey);
  const loadMessage = loadError ?? (savedSettings?.keyRecoveryRequired
    ? "检测到已保存的 AI 凭据无法由当前设备解密，请重新输入 API Key 或代理密码并保存；其他设置已保留。" : null);
  const currentCustom = activeCustom(settings);
  const providerContext = JSON.stringify(settings.provider === "custom"
    ? ["custom", currentCustom?.id, currentCustom?.endpoint, currentCustom?.modelsEndpoint, currentCustom?.apiKeyHeader, currentCustom?.apiKeyPrefix, customApiKeys[currentCustom?.id || ""], clearCustomApiKeys[currentCustom?.id || ""]]
    : [settings.provider, settings[settings.provider].endpoint, apiKeys[settings.provider]]);
  const modelListContext = JSON.stringify([providerContext, settings.proxy, proxyPassword, clearProxyPassword]);
  const requestContext = JSON.stringify([modelListContext, settings.provider === "custom" ? currentCustom?.model : settings[settings.provider].model]);

  function recognitionDraft() {
    const builtInDraft = (provider: BuiltInProvider) => ({
      endpoint: settings[provider].endpoint,
      apiKey: apiKeys[provider] || undefined,
      model: settings[provider].model
    });
    return {
      provider: settings.provider,
      activeCustomId: settings.activeCustomId,
      openai: builtInDraft("openai"),
      minimax: builtInDraft("minimax"),
      deepseek: builtInDraft("deepseek"),
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

  function proxyDraft() {
    const { mode, protocol, host, port, username, noProxy } = settings.proxy;
    return { mode, protocol, host, port, username, noProxy, password: clearProxyPassword ? "" : proxyPassword || undefined };
  }

  function handleProviderChange(value: string) {
    setPendingDeleteId(null);
    setMessage(null);
    if (value.startsWith("custom:")) {
      const activeCustomId = value.slice("custom:".length);
      setSettings((current) => ({ ...current, provider: "custom", activeCustomId }));
      return;
    }
    setSettings((current) => ({ ...current, provider: normalizeProvider(value) }));
  }

  function addCustomProvider() {
    setPendingDeleteId(null);
    setSettings((current) => {
      const id = createCustomId(new Set(current.customProviders.map((item) => item.id)));
      const next: PublicCustomProviderSettings = {
        id,
        name: `${locale === "en" ? "Custom configuration" : "自定义配置"} ${current.customProviders.length + 1}`,
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
    setMessage(null);
  }

  function deleteCurrentCustomProvider() {
    if (settings.provider !== "custom" || !currentCustom || pendingDeleteId !== currentCustom.id) return;
    const deletedId = currentCustom.id;
    setPendingDeleteId(null);
    providerSelect.current?.focus();
    setSettings((current) => {
      const customProviders = current.customProviders.filter((item) => item.id !== deletedId);
      const nextActive = customProviders[0];
      return {
        ...current,
        provider: nextActive ? "custom" : "openai",
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
    setMessage("自定义配置已从当前草稿移除，请点击“保存设置”确认删除。");
  }

  function cancelDelete() {
    setPendingDeleteId(null);
    deleteButton.current?.focus();
  }

  function handleDeleteKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelDelete();
    }
  }

  function updateCurrentCustom(patch: Partial<PublicCustomProviderSettings>) {
    if (!currentCustom) return;
    setSettings((current) => ({
      ...current,
      customProviders: current.customProviders.map((item) => item.id === currentCustom.id ? { ...item, ...patch } : item)
    }));
  }

  async function handleSave(section: SettingsSection) {
    if (!window.cardVaultDesktop || !loaded || saving) return;
    setSaving(section);
    setSaveMessages(current => ({ ...current, [section]: "" }));
    try {
      const draft = section === "studio"
        ? { studio: { model: settings.studio.model, keySource: settings.studio.keySource, apiKey: clearStudioKey ? "" : studioKey || undefined } }
        : section === "proxy" ? { proxy: proxyDraft() } : recognitionDraft();
      const saved = loadedPublicSettings(await window.cardVaultDesktop.saveAiSettings(draft));
      setSavedSettings(saved);
      if (section === "studio") {
        setSettings(current => ({ ...current, studio: saved.studio }));
        setStudioKey("");
        setClearStudioKey(false);
        setSaveRevision(revision => revision + 1);
      } else if (section === "proxy") {
        setSettings(current => ({ ...current, proxy: saved.proxy }));
        setProxyPassword("");
        setClearProxyPassword(false);
      } else {
        setSettings(current => ({ ...saved, studio: current.studio, proxy: current.proxy }));
        setApiKeys(emptyApiKeys);
        setCustomApiKeys({});
        setClearCustomApiKeys({});
        setPendingDeleteId(null);
        setMessage(null);
      }
      setSaveMessages(current => ({ ...current, [section]: "AI 设置已保存。" }));
    } catch (error) {
      const feedback = "保存失败：" + errorMessage(error, "请稍后重试。");
      setSaveMessages(current => ({ ...current, [section]: feedback }));
    } finally {
      setSaving(null);
    }
  }

  function saveButton(section: SettingsSection) {
    return <button type="button" className="btn btn-secondary" data-save-section={section}
      disabled={!isDesktop || !loaded || saving !== null} onClick={() => handleSave(section)}>
      <UiText text={saving === section ? "保存中..." : "保存设置"} />
    </button>;
  }

  function saveFeedback(section: SettingsSection) {
    return saveMessages[section] && <p className="muted" role="status"><UiText text={saveMessages[section]} /></p>;
  }

  const { modelOptions, isTesting, isLoadingModels, testRoute, textTestPassed, handleTest, handleLoadModels } = useAiSettingsRequests({
    modelListContext,
    requestContext,
    buildDraftPayload: () => ({ ...recognitionDraft(), proxy: proxyDraft() }),
    providerName: settings.provider === "custom" ? currentCustom?.name || "未命名配置" : providerName(settings.provider),
    testFailureMessage: settings.provider === "custom"
      ? "请检查当前自定义配置的 Endpoint、Model 和 API Key。"
      : `请检查 ${providerName(settings.provider)} Endpoint、API Key 和 Model。`,
    onMessage: setMessage
  });

  function handleModelOptionChange(value: string) {
    if (settings.provider === "custom") {
      updateCurrentCustom({ model: value });
      return;
    }
    const provider = settings.provider;
    setSettings((current) => ({ ...current, [provider]: { ...current[provider], model: value } }));
  }

  const builtInProvider = settings.provider === "custom" ? null : settings.provider;
  const builtInSettings = builtInProvider ? settings[builtInProvider] : null;
  const selectedSettings = builtInSettings ?? currentCustom;
  const modelsReadable = Boolean(selectedSettings?.endpoint && (!builtInProvider || selectedSettings.hasApiKey || apiKeys[builtInProvider].trim()));
  const testable = modelsReadable && Boolean(selectedSettings?.model);
  const selectedProviderValue = settings.provider === "custom" ? `custom:${currentCustom?.id || ""}` : settings.provider;
  const selectedModel = selectedSettings?.model || "";

  return (
    <section id="ai-settings" className="panel settings-section ai-settings-panel">
      <UiElement as="button" uiAttributes={["aria-label"]} type="button" className="ai-settings-toggle"
        onClick={() => { setPendingDeleteId(null); setIsOpen(value => !value); }} aria-expanded={isOpen} aria-label={isOpen ? "收起 AI" : "展开 AI"}>
        <span><strong>AI</strong></span><DisclosureIcon expanded={isOpen} />
      </UiElement>

      {isOpen ? <fieldset className="ai-settings-fields" disabled={saving !== null || !loaded} onChangeCapture={event => {
        const row = (event.target as HTMLElement).closest("section");
        const section = row?.querySelector<HTMLButtonElement>("[data-save-section]")?.dataset.saveSection as SettingsSection | undefined;
        if (section && saveMessages[section]) setSaveMessages(current => ({ ...current, [section]: "" }));
      }}>
        <SettingsSubsection title={locale === "en" ? "Recognition and analysis" : "识别与分析"}>
          <div className="ai-provider-picker">
            <label className="field"><span><UiText text="当前服务" /></span>
              <select ref={providerSelect} title={settings.provider === "custom" ? currentCustom?.name : providerName(settings.provider)} value={selectedProviderValue} onChange={event => handleProviderChange(event.target.value)} disabled={!isDesktop}>
                {Object.entries(builtInAiProviders).map(([id, provider]) => <option key={id} value={id}>{provider.name}</option>)}
                {settings.customProviders.map(item => <option key={item.id} value={"custom:" + item.id}>{item.name || <UiText text="未命名配置" />}</option>)}
              </select>
            </label>
            <div className="ai-provider-actions">
              <button type="button" className="btn btn-secondary" onClick={addCustomProvider} disabled={!isDesktop}><UiText text="新增自定义 AI" /></button>
              {settings.provider === "custom" && currentCustom ? <button ref={deleteButton} type="button" className="btn btn-secondary" onClick={() => setPendingDeleteId(currentCustom.id)} disabled={!isDesktop}><UiText text="删除当前配置" /></button> : null}
            </div>
          </div>

          {settings.provider === "custom" && currentCustom && pendingDeleteId === currentCustom.id ? <div className="ai-delete-confirmation" role="group" aria-label={t("删除自定义配置确认")}>
            <p>{t("确认删除自定义配置“{0}”吗？保存设置后删除生效。").replace("{0}", currentCustom.name)}</p>
            <div className="ai-provider-actions">
              <button type="button" className="btn btn-secondary" onClick={deleteCurrentCustomProvider} onKeyDown={handleDeleteKey}><UiText text="确认删除" /></button>
              <button ref={cancelDeleteButton} type="button" className="btn btn-secondary btn-quiet" onClick={cancelDelete} onKeyDown={handleDeleteKey}><UiText text="取消" /></button>
            </div>
          </div> : null}

          <div className="form-grid ai-common-fields">
            {settings.provider === "custom" && currentCustom ? <label className="field full"><span><UiText text="显示名称 *" /></span><UiElement as="input" uiAttributes={["placeholder"]} value={currentCustom.name} onChange={event => updateCurrentCustom({ name: event.target.value })} placeholder="例如 OpenRouter、DeepSeek 或本地模型" disabled={!isDesktop} /></label> : null}
            {builtInProvider && builtInSettings ? <label className="field full"><span>Endpoint</span><UiElement as="input" uiAttributes={["placeholder"]} value={builtInSettings.endpoint} onChange={event => setSettings(current => ({ ...current, [builtInProvider]: { ...current[builtInProvider], endpoint: event.target.value } }))} placeholder={emptySettings[builtInProvider].endpoint} disabled={!isDesktop} /></label>
              : currentCustom ? <label className="field full"><span>Endpoint</span><input value={currentCustom.endpoint} onChange={event => updateCurrentCustom({ endpoint: event.target.value })} placeholder="https://example.com/v1/chat/completions" disabled={!isDesktop} /></label> : null}
            {builtInProvider && builtInSettings ? <>
              <label className="field"><span>Model</span><UiElement as="input" uiAttributes={["placeholder"]} value={builtInSettings.model} onChange={event => setSettings(current => ({ ...current, [builtInProvider]: { ...current[builtInProvider], model: event.target.value } }))} placeholder={emptySettings[builtInProvider].model} disabled={!isDesktop} /></label>
              <label className="field"><span>API Key</span><UiElement as="input" uiAttributes={["placeholder"]} value={apiKeys[builtInProvider]} type="password" onChange={event => setApiKeys(current => ({ ...current, [builtInProvider]: event.target.value }))} placeholder={builtInSettings.hasApiKey ? "已保存；留空则不修改" : "请输入 API Key"} disabled={!isDesktop} /></label>
            </> : currentCustom ? <>
              <label className="field"><span>Model *</span><UiElement as="input" uiAttributes={["placeholder"]} value={currentCustom.model} onChange={event => updateCurrentCustom({ model: event.target.value })} placeholder="服务商提供的模型 ID" disabled={!isDesktop} /></label>
              <label className="field"><span>API Key</span><UiElement as="input" uiAttributes={["placeholder"]} value={customApiKeys[currentCustom.id] || ""} type="password"
                onChange={event => { setCustomApiKeys(current => ({ ...current, [currentCustom.id]: event.target.value })); setClearCustomApiKeys(current => ({ ...current, [currentCustom.id]: false })); }}
                placeholder={currentCustom.hasApiKey ? "已保存；留空则不修改" : "本地无鉴权服务可留空"} disabled={!isDesktop} /></label>
            </> : null}
            {modelOptions.length > 0 ? <label className="field full"><span><UiText text="选择模型" /></span>
              <select title={selectedModel} value={selectedModel} onChange={event => handleModelOptionChange(event.target.value)}><option value=""><UiText text="请选择" /></option>{modelOptions.map(model => <option key={model} value={model}>{model}</option>)}</select>
            </label> : null}
            {settings.provider === "custom" && currentCustom ? <>
                {currentCustom.hasApiKey ? <label className="field ai-key-status-field"><span><UiText text="已保存密钥" /></span><span><input type="checkbox" checked={Boolean(clearCustomApiKeys[currentCustom.id])}
                  onChange={event => { setClearCustomApiKeys(current => ({ ...current, [currentCustom.id]: event.target.checked })); if (event.target.checked) setCustomApiKeys(current => ({ ...current, [currentCustom.id]: "" })); }} disabled={!isDesktop} /> <UiText text="保存时清除 API Key" /></span></label> : null}
                <label className="field full"><span><UiText text="模型列表 Endpoint（可选）" /></span><UiElement as="input" uiAttributes={["placeholder"]} value={currentCustom.modelsEndpoint} onChange={event => updateCurrentCustom({ modelsEndpoint: event.target.value })} placeholder="留空时从 /chat/completions 自动推断 /models" disabled={!isDesktop} /></label>
              </> : settings.provider === "custom" ? <p className="muted full"><UiText text="尚未创建自定义配置，请点击“新增自定义 AI”。" /></p> : null}
          </div>
          <div className="ai-actions">
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={isTesting || !testable}>{isTesting ? <UiText text="测试中..." /> : <UiText text="测试连接" />}</button>
            <button type="button" className="btn btn-secondary" onClick={handleLoadModels} disabled={isLoadingModels || !modelsReadable}>{isLoadingModels ? <UiText text="读取中..." /> : <UiText text="读取模型" />}</button>
            {saveButton("recognition")}
          </div>
          {testRoute ? <p className="muted ai-route-result"><UiText text={{ direct: "直连设置", bypass: "绕过规则", manual: "手动代理", environment: "环境代理", system: "系统规则" }[testRoute.source]} /> · <UiText text={testRoute.connection === "direct" ? "直连" : "经代理连接"} />{testRoute.protocol ? ` (${testRoute.protocol.toUpperCase()})` : ""}</p> : null}
          {textTestPassed ? <p className="muted ai-capability-result"><UiText text="文本连接通过；图片识别能力需另行确认。" /></p> : null}
          {message && <p className="muted" role="status"><UiText text={message} /></p>}
          {saveFeedback("recognition")}
        </SettingsSubsection>
        <StudioRecovery hasKey={savedStudioKey}>
          <StudioConfiguration key={saveRevision} saveButton={saveButton("studio")}
            value={settings.studio} onChange={patch => setSettings(current => ({ ...current, studio: { ...current.studio, ...patch } }))}
            secret={studioKey} onSecret={value => { setStudioKey(value); setClearStudioKey(false); }}
            clear={clearStudioKey} onClear={value => { setClearStudioKey(value); if (value) setStudioKey(""); }}
            disabled={!isDesktop} />
          {saveFeedback("studio")}
        </StudioRecovery>
        <AiProxySettings value={settings.proxy} onChange={patch => setSettings(current => ({ ...current, proxy: { ...current.proxy, ...patch } }))} password={proxyPassword} onPassword={setProxyPassword} clearPassword={clearProxyPassword} onClearPassword={setClearProxyPassword} disabled={!isDesktop}>
          <div className="ai-actions">{saveButton("proxy")}</div>
          {saveFeedback("proxy")}
        </AiProxySettings>
        {isDesktop === false ? <p className="muted" style={{ margin: "0.65rem 0 0" }}><UiText text="当前不是桌面端环境，界面内保存不可用；开发态可通过 .env.local 配置 AI 服务商。" /></p> : null}
      </fieldset> : null}
      {loadMessage ? <p className="muted" role="status" style={{ margin: "0.65rem 0 0" }}><UiText text={loadMessage} /></p> : null}
    </section>
  );
}
