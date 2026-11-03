"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { AiSettingsDraft } from "@/lib/ai-settings";
import type { AiRouteDiagnostic } from "@/lib/ai-fetch";
import { errorMessage } from "@/lib/feedback-messages";

async function postSettings<T>(path: string, draft: AiSettingsDraft, signal: AbortSignal) {
  const response = await fetch(path, {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft)
  });
  const data = await response.json() as T;
  signal.throwIfAborted();
  return { response, data };
}

/** Both requests belong to the current provider, credentials, proxy and model. */
export function useAiSettingsRequests({ modelListContext, requestContext, buildDraftPayload, providerName, testFailureMessage, onMessage }: {
  modelListContext: string;
  requestContext: string;
  buildDraftPayload: () => AiSettingsDraft;
  providerName: string;
  testFailureMessage: string;
  onMessage: (message: string | null) => void;
}) {
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [testRoute, setTestRoute] = useState<AiRouteDiagnostic | null>(null);
  const [textTestPassed, setTextTestPassed] = useState(false);
  const requests = useRef<{ models?: AbortController; test?: AbortController }>({});

  useLayoutEffect(() => { setModelOptions([]); }, [modelListContext]);
  useLayoutEffect(() => {
    const activeRequests = requests.current;
    setIsLoadingModels(false);
    setIsTesting(false);
    setTestRoute(null);
    setTextTestPassed(false);
    return () => { activeRequests.models?.abort(); activeRequests.test?.abort(); };
  }, [requestContext]);

  function begin(kind: "test" | "models") {
    requests.current[kind]?.abort();
    const controller = new AbortController();
    requests.current[kind] = controller;
    onMessage(null);
    return controller;
  }

  async function handleTest() {
    const controller = begin("test");
    setTestRoute(null);
    setTextTestPassed(false);
    setIsTesting(true);
    try {
      const { response, data } = await postSettings<{ ok?: boolean; error?: string; route?: AiRouteDiagnostic }>("/api/ai/test-settings", buildDraftPayload(), controller.signal);
      setTestRoute(data.route ?? null);
      if (!response.ok || !data.ok) throw new Error(data.error || providerName + " 连接测试失败。");
      onMessage(providerName + " 连接测试通过。");
      setTextTestPassed(true);
    } catch (error) {
      if (!controller.signal.aborted) onMessage(errorMessage(error, testFailureMessage));
    } finally {
      if (requests.current.test === controller) setIsTesting(false);
    }
  }

  async function handleLoadModels() {
    const controller = begin("models");
    setIsLoadingModels(true);
    try {
      const { response, data } = await postSettings<{ models?: string[]; error?: string }>("/api/ai/models", buildDraftPayload(), controller.signal);
      if (!response.ok) throw new Error(data.error || "读取模型失败。");
      const models = data.models ?? [];
      setModelOptions(models);
      onMessage(models.length > 0 ? `已读取 ${models.length} 个模型。` : "没有读取到可用模型。");
    } catch (error) {
      if (!controller.signal.aborted) onMessage(errorMessage(error, "请检查当前服务商的 Endpoint 和 API Key。"));
    } finally {
      if (requests.current.models === controller) setIsLoadingModels(false);
    }
  }

  return { modelOptions, isTesting, isLoadingModels, testRoute, textTestPassed, handleTest, handleLoadModels };
}
