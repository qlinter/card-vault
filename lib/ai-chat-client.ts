import type { ActiveAiSettings } from "./ai-settings.ts";
import {
  getChatCompletionsHeaders,
  getChatCompletionsModel,
  getChatCompletionsUrl
} from "./ai-settings.ts";
import { responseToText, safeText } from "./ai-response-parsing.ts";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

type AiChatRequest = {
  messages: AiChatMessage[];
  maxTokens: number;
  temperature?: number;
  operation: string;
  timeoutMs?: number;
};

export class AiUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUpstreamError";
  }
}

export function aiProviderName(provider: string): string {
  return provider === "minimax" ? "MiniMax" : "Azure OpenAI";
}

function isUnsupportedTokenParameter(detail: string, tokenField: string): boolean {
  const text = safeText(detail);
  return text.includes("Unsupported parameter") && text.includes(tokenField);
}

export async function requestAiChat(settings: ActiveAiSettings, request: AiChatRequest): Promise<unknown> {
  const url = getChatCompletionsUrl(settings);
  const headers = getChatCompletionsHeaders(settings);
  const model = getChatCompletionsModel(settings);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 60000);

  const requestInit = (tokenField: "max_completion_tokens" | "max_tokens") => ({
    method: "POST",
    headers,
    signal: controller.signal,
    body: JSON.stringify({
      ...(model ? { model } : {}),
      messages: request.messages,
      [tokenField]: request.maxTokens,
      ...(request.temperature === undefined ? {} : { temperature: request.temperature })
    })
  });

  try {
    let response = await fetch(url, requestInit("max_completion_tokens"));
    let detail = response.ok ? "" : await response.text();

    if (!response.ok && isUnsupportedTokenParameter(detail, "max_completion_tokens")) {
      response = await fetch(url, requestInit("max_tokens"));
      detail = response.ok ? "" : await response.text();
    }

    if (!response.ok) {
      throw new AiUpstreamError(
        `${aiProviderName(settings.provider)} ${request.operation}失败：${response.status} ${detail.slice(0, 320)}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AiUpstreamError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new AiUpstreamError(`${aiProviderName(settings.provider)} ${request.operation}超时，请稍后重试。`);
    }

    const message = error instanceof Error ? error.message : "未知网络错误";
    const detail = message === "Failed to fetch"
      ? "无法连接 AI 服务，请检查网络、Endpoint 和代理设置"
      : message;
    throw new AiUpstreamError(`${aiProviderName(settings.provider)} ${request.operation}失败：${detail}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAiChatText(
  settings: ActiveAiSettings,
  request: AiChatRequest
): Promise<string> {
  const content = responseToText(await requestAiChat(settings, request));
  if (!safeText(content)) {
    throw new AiUpstreamError(`${aiProviderName(settings.provider)} 没有返回可用${request.operation}结果。`);
  }

  return content;
}
