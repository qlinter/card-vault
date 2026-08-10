"use client";

import { useEffect, useState } from "react";

type AiProvider = "azure" | "minimax";

type PublicSettings = {
  provider: AiProvider;
  keyRecoveryRequired?: boolean;
  azure: {
    endpoint: string;
    deployment: string;
    apiVersion: string;
    hasApiKey: boolean;
  };
  minimax: {
    endpoint: string;
    model: string;
    hasApiKey: boolean;
  };
};

const emptySettings: PublicSettings = {
  provider: "azure",
  keyRecoveryRequired: false,
  azure: {
    endpoint: "",
    deployment: "",
    apiVersion: "2024-02-15-preview",
    hasApiKey: false
  },
  minimax: {
    endpoint: "https://api.minimax.io/v1/chat/completions",
    model: "MiniMax-VL-01",
    hasApiKey: false
  }
};

function providerName(provider: AiProvider): string {
  return provider === "minimax" ? "MiniMax" : "Azure OpenAI";
}

function isConfigured(settings: PublicSettings): boolean {
  return settings.provider === "minimax"
    ? Boolean(settings.minimax.endpoint && settings.minimax.model && settings.minimax.hasApiKey)
    : Boolean(settings.azure.endpoint && settings.azure.deployment && settings.azure.hasApiKey);
}

function canTest(settings: PublicSettings, azureApiKey: string, minimaxApiKey: string): boolean {
  return settings.provider === "minimax"
    ? Boolean(settings.minimax.endpoint && settings.minimax.model && (settings.minimax.hasApiKey || minimaxApiKey.trim()))
    : Boolean(settings.azure.endpoint && settings.azure.deployment && (settings.azure.hasApiKey || azureApiKey.trim()));
}

type AiSettingsProps = {
  defaultOpen?: boolean;
};

export function AiSettings({ defaultOpen = false }: AiSettingsProps) {
  const [settings, setSettings] = useState<PublicSettings>(emptySettings);
  const [azureApiKey, setAzureApiKey] = useState("");
  const [minimaxApiKey, setMiniMaxApiKey] = useState("");
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
            keyRecoveryRequired: Boolean(nextSettings.keyRecoveryRequired),
            azure: { ...emptySettings.azure, ...nextSettings.azure },
            minimax: { ...emptySettings.minimax, ...nextSettings.minimax }
          };
          setSettings(loadedSettings);
          if (loadedSettings.keyRecoveryRequired) {
            setMessage("检测到旧 API Key 无法由当前 Windows 环境解密，请重新输入 API Key 并保存；其他设置已保留。");
          }
        }
      } catch (error) {
        if (!cancelled) {
          const detail = error instanceof Error ? error.message : "请重新启动 Card Vault 后重试。";
          setMessage("读取 AI 设置失败：" + detail);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function buildDraftPayload() {
    return {
      provider: settings.provider,
      azure: {
        endpoint: settings.azure.endpoint,
        apiKey: azureApiKey || undefined,
        deployment: settings.azure.deployment,
        apiVersion: settings.azure.apiVersion
      },
      minimax: {
        endpoint: settings.minimax.endpoint,
        apiKey: minimaxApiKey || undefined,
        model: settings.minimax.model
      }
    };
  }

  function updateProvider(provider: AiProvider) {
    setSettings((current) => ({ ...current, provider }));
    setModelOptions([]);
    setMessage(null);
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

      setSettings({
        provider: saved.provider,
        keyRecoveryRequired: false,
        azure: { ...emptySettings.azure, ...saved.azure },
        minimax: { ...emptySettings.minimax, ...saved.minimax }
      });
      setAzureApiKey("");
      setMiniMaxApiKey("");
      setMessage(providerName(saved.provider) + " 设置已加密保存并立即生效，无需重启 Card Vault。");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "请稍后重试。";
      setMessage("保存失败：" + detail);
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

      if (!response.ok || !data.ok) {
        throw new Error(data.error || providerName(settings.provider) + " 连接测试失败。");
      }

      setMessage(providerName(settings.provider) + " 连接测试通过。");
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : settings.provider === "minimax"
            ? "请检查 MiniMax Endpoint、API Key 和 Model。"
            : "请检查 Azure Endpoint、API Key、Deployment 和 API Version。";
      setMessage(detail);
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

      if (!response.ok) {
        throw new Error(data.error || "读取模型失败。");
      }

      const models = data.models ?? [];
      setModelOptions(models);
      setMessage(models.length > 0 ? "已读取 " + models.length + " 个模型。" : "没有读取到可用模型。");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "请检查当前服务商的 Endpoint 和 API Key。";
      setMessage(detail);
    } finally {
      setIsLoadingModels(false);
    }
  }

  function handleModelOptionChange(value: string) {
    if (settings.provider === "minimax") {
      setSettings((current) => ({
        ...current,
        minimax: { ...current.minimax, model: value }
      }));
      return;
    }

    setSettings((current) => ({
      ...current,
      azure: { ...current.azure, deployment: value }
    }));
  }

  const configured = isConfigured(settings);
  const testable = canTest(settings, azureApiKey, minimaxApiKey);
  const modelsReadable =
    settings.provider === "minimax"
      ? Boolean(settings.minimax.endpoint && (settings.minimax.hasApiKey || minimaxApiKey.trim()))
      : Boolean(settings.azure.endpoint && (settings.azure.hasApiKey || azureApiKey.trim()));

  return (
    <section className="panel settings-section ai-settings-panel">
      <button type="button" className="ai-settings-toggle" onClick={() => setIsOpen((value) => !value)}>
        <span>
          <strong>{"AI 设置"}</strong>
          <span className="muted">{configured ? "已配置 " + providerName(settings.provider) : "未配置"}</span>
        </span>
        <span>{isOpen ? "收起" : "展开"}</span>
      </button>

      {isOpen ? (
        <>
          <p className="muted" style={{ margin: "0.75rem 0" }}>
            {"配置 AI 识图、分享文案和组合分析共用的服务商、模型与连接信息。"}
          </p>

          <div className="form-grid">
            <label className="field">
              <span>{"服务商"}</span>
              <select value={settings.provider} onChange={(event) => updateProvider(event.target.value as AiProvider)} disabled={!isDesktop}>
                <option value="azure">Azure OpenAI</option>
                <option value="minimax">MiniMax</option>
              </select>
            </label>

            {settings.provider === "azure" ? (
              <>
                <label className="field">
                  <span>Azure Endpoint</span>
                  <input
                    value={settings.azure.endpoint}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        azure: { ...current.azure, endpoint: event.target.value }
                      }))
                    }
                    placeholder="https://your-resource.openai.azure.com"
                    disabled={!isDesktop}
                  />
                </label>

                <label className="field">
                  <span>Deployment</span>
                  <input
                    value={settings.azure.deployment}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        azure: { ...current.azure, deployment: event.target.value }
                      }))
                    }
                    placeholder="gpt-4o 或你的部署名称"
                    disabled={!isDesktop}
                  />
                </label>

                <label className="field">
                  <span>API Version</span>
                  <input
                    value={settings.azure.apiVersion}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        azure: { ...current.azure, apiVersion: event.target.value }
                      }))
                    }
                    disabled={!isDesktop}
                  />
                </label>

                <label className="field">
                  <span>Azure API Key</span>
                  <input
                    value={azureApiKey}
                    type="password"
                    onChange={(event) => setAzureApiKey(event.target.value)}
                    placeholder={settings.azure.hasApiKey ? "已保存；留空则不修改" : "请输入 API Key"}
                    disabled={!isDesktop}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="field">
                  <span>MiniMax Endpoint</span>
                  <input
                    value={settings.minimax.endpoint}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        minimax: { ...current.minimax, endpoint: event.target.value }
                      }))
                    }
                    placeholder="https://api.minimax.io/v1/chat/completions"
                    disabled={!isDesktop}
                  />
                </label>

                <label className="field">
                  <span>Model</span>
                  <input
                    value={settings.minimax.model}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        minimax: { ...current.minimax, model: event.target.value }
                      }))
                    }
                    placeholder="MiniMax-VL-01"
                    disabled={!isDesktop}
                  />
                </label>

                <label className="field">
                  <span>MiniMax API Key</span>
                  <input
                    value={minimaxApiKey}
                    type="password"
                    onChange={(event) => setMiniMaxApiKey(event.target.value)}
                    placeholder={settings.minimax.hasApiKey ? "已保存；留空则不修改" : "请输入 API Key"}
                    disabled={!isDesktop}
                  />
                </label>
              </>
            )}

            {modelOptions.length > 0 ? (
              <label className="field">
                <span>{settings.provider === "minimax" ? "选择模型" : "选择 Deployment"}</span>
                <select value={settings.provider === "minimax" ? settings.minimax.model : settings.azure.deployment} onChange={(event) => handleModelOptionChange(event.target.value)}>
                  <option value="">{"请选择"}</option>
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="ai-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isDesktop !== true || isSaving}>
              {isSaving ? "保存中..." : "保存设置"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={isTesting || !testable}>
              {isTesting ? "测试中..." : "测试连接"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleLoadModels} disabled={isLoadingModels || !modelsReadable}>
              {isLoadingModels ? "读取中..." : "读取模型"}
            </button>
          </div>

          {isDesktop === false ? (
            <p className="muted" style={{ margin: "0.65rem 0 0" }}>
              {"当前不是桌面端环境，界面内保存不可用；开发态可通过 .env.local 配置 AI 服务商。"}
            </p>
          ) : null}
        </>
      ) : null}

      {message ? (
        <p className="muted" style={{ margin: "0.65rem 0 0" }}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
