"use client";

import { AiProxySettings } from "./ai-proxy-settings";

import { UiText, UiElement } from "@/components/ui-text";
import { useEffect, useState } from "react";
import { useAiSettingsRequests } from "./use-ai-settings-requests";
import { useLanguage } from "./language-provider";
import { DisclosureIcon } from "@/components/disclosure-icon";
import { errorMessage } from "@/lib/feedback-messages";
import { builtInAiProviders, normalizeProvider, normalizeSettings, publicAiSettings } from "@/lib/ai-settings-core";
import type { AiProvider, PublicAiSettings, PublicCustomProviderSettings } from "@/lib/ai-settings";

type PublicSettings = PublicAiSettings & { keyRecoveryRequired?: boolean };

const emptySettings: PublicSettings = publicAiSettings(normalizeSettings());
type BuiltInProvider = Exclude<AiProvider, "custom">;
const emptyApiKeys: Record<BuiltInProvider, string> = { openai: "", minimax: "", deepseek: "" };

function loadedPublicSettings(value: Partial<PublicSettings>): PublicSettings {
  return {
    provider: value.provider ?? emptySettings.provider,
    activeCustomId: value.activeCustomId ?? "",
    keyRecoveryRequired: Boolean(value.keyRecoveryRequired),
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
  const [apiKeys, setApiKeys] = useState(emptyApiKeys);
  const [proxyPassword, setProxyPassword] = useState("");
  const [clearProxyPassword, setClearProxyPassword] = useState(false);
  const [customApiKeys, setCustomApiKeys] = useState<Record<string, string>>({});
  const [clearCustomApiKeys, setClearCustomApiKeys] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
          const loadedSettings = loadedPublicSettings(nextSettings);
          setSettings(loadedSettings);
          if (loadedSettings.keyRecoveryRequired) {
            setMessage("检测到已保存的 AI 凭据无法由当前设备解密，请重新输入 API Key 或代理密码并保存；其他设置已保留。");
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
  const providerContext = JSON.stringify(settings.provider === "custom"
    ? ["custom", currentCustom?.id, currentCustom?.endpoint, currentCustom?.modelsEndpoint, currentCustom?.apiKeyHeader, currentCustom?.apiKeyPrefix, customApiKeys[currentCustom?.id || ""], clearCustomApiKeys[currentCustom?.id || ""]]
    : [settings.provider, settings[settings.provider].endpoint, apiKeys[settings.provider]]);
  const modelListContext = JSON.stringify([providerContext, settings.proxy, proxyPassword, clearProxyPassword]);
  const requestContext = JSON.stringify([modelListContext, settings.provider === "custom" ? currentCustom?.model : settings[settings.provider].model]);

  function buildDraftPayload() {
    const builtInDraft = (provider: BuiltInProvider) => ({
      endpoint: settings[provider].endpoint,
      apiKey: apiKeys[provider] || undefined,
      model: settings[provider].model
    });
    return {
      proxy: { mode: settings.proxy.mode, protocol: settings.proxy.protocol, host: settings.proxy.host, port: settings.proxy.port, username: settings.proxy.username, noProxy: settings.proxy.noProxy, password: clearProxyPassword ? "" : proxyPassword || undefined },
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

  function handleProviderChange(value: string) {
    setMessage(null);
    if (value.startsWith("custom:")) {
      const activeCustomId = value.slice("custom:".length);
      setSettings((current) => ({ ...current, provider: "custom", activeCustomId }));
      return;
    }
    setSettings((current) => ({ ...current, provider: normalizeProvider(value) }));
  }

  function addCustomProvider() {
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
    if (!currentCustom || !window.confirm(t("确认删除自定义配置“{0}”吗？保存设置后删除生效。").replace("{0}", currentCustom.name))) return;
    const deletedId = currentCustom.id;
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
      setSettings(loadedPublicSettings(saved));
      setProxyPassword("");
      setClearProxyPassword(false);
      setApiKeys(emptyApiKeys);
      setCustomApiKeys({});
      setClearCustomApiKeys({});
      setMessage(saved.keyRecoveryRequired ? "AI 设置已保存；无法解密的原凭据已保留，请重新输入需要使用的 API Key 或代理密码。" : "AI 设置已保存。");
    } catch (error) {
      setMessage("保存失败：" + errorMessage(error, "请稍后重试。"));
    } finally {
      setIsSaving(false);
    }
  }

  const { modelOptions, isTesting, isLoadingModels, testRoute, textTestPassed, handleTest, handleLoadModels } = useAiSettingsRequests({
    modelListContext,
    requestContext,
    buildDraftPayload,
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
    <section className="panel settings-section ai-settings-panel">
      <UiElement as="button" uiAttributes={["aria-label"]} type="button" className="ai-settings-toggle"
        onClick={() => setIsOpen(value => !value)} aria-expanded={isOpen} aria-label={isOpen ? "收起 AI" : "展开 AI"}>
        <span><strong>AI</strong></span><DisclosureIcon expanded={isOpen} />
      </UiElement>

      {isOpen ? <fieldset className="ai-settings-fields" disabled={isSaving}>
        <div className="ai-provider-picker">
          <label className="field"><span><UiText text="当前服务" /></span>
            <select title={settings.provider === "custom" ? currentCustom?.name : providerName(settings.provider)} value={selectedProviderValue} onChange={event => handleProviderChange(event.target.value)} disabled={!isDesktop}>
              {Object.entries(builtInAiProviders).map(([id, provider]) => <option key={id} value={id}>{provider.name}</option>)}
              {settings.customProviders.map(item => <option key={item.id} value={"custom:" + item.id}>{item.name || <UiText text="未命名配置" />}</option>)}
            </select>
          </label>
          <div className="ai-provider-actions">
            <button type="button" className="btn btn-secondary" onClick={addCustomProvider} disabled={!isDesktop}><UiText text="新增自定义 AI" /></button>
            {settings.provider === "custom" && currentCustom ? <button type="button" className="btn btn-secondary" onClick={deleteCurrentCustomProvider} disabled={!isDesktop}><UiText text="删除当前配置" /></button> : null}
          </div>
        </div>

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
        <AiProxySettings value={settings.proxy} onChange={patch => setSettings(current => ({ ...current, proxy: { ...current.proxy, ...patch } }))} password={proxyPassword} onPassword={setProxyPassword} clearPassword={clearProxyPassword} onClearPassword={setClearProxyPassword} disabled={!isDesktop} />
        <div className="ai-actions">
          <button type="button" className="btn btn-secondary" onClick={handleSave} disabled={isDesktop !== true || isSaving}>{isSaving ? <UiText text="保存中..." /> : <UiText text="保存设置" />}</button>
          <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={isTesting || !testable}>{isTesting ? <UiText text="测试中..." /> : <UiText text="测试连接" />}</button>
          <button type="button" className="btn btn-secondary" onClick={handleLoadModels} disabled={isLoadingModels || !modelsReadable}>{isLoadingModels ? <UiText text="读取中..." /> : <UiText text="读取模型" />}</button>
        </div>
        {isDesktop === false ? <p className="muted" style={{ margin: "0.65rem 0 0" }}><UiText text="当前不是桌面端环境，界面内保存不可用；开发态可通过 .env.local 配置 AI 服务商。" /></p> : null}
      </fieldset> : null}
      {message ? <p className="muted" role="status" style={{ margin: "0.65rem 0 0" }}><UiText text={message} /></p> : null}
      {testRoute ? <p className="muted ai-route-result"><UiText text={{ direct: "直连设置", bypass: "绕过规则", manual: "手动代理", environment: "环境代理", system: "系统规则" }[testRoute.source]} /> · <UiText text={testRoute.connection === "direct" ? "直连" : "经代理连接"} />{testRoute.protocol ? ` (${testRoute.protocol.toUpperCase()})` : ""}</p> : null}
      {textTestPassed ? <p className="muted ai-capability-result"><UiText text="文本连接通过；图片识别能力需另行确认。" /></p> : null}
    </section>
  );
}
