import type { ActiveAiSettings } from "./ai-settings.ts";
import {
  getChatCompletionsHeaders,
  getChatCompletionsModel,
  getChatCompletionsUrl,
  isAzureReasoningDeployment
} from "./ai-settings.ts";
import { responseToText, safeText } from "./ai-response-parsing.ts";
import { errorMessage } from "./feedback-messages.ts";

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

function isUnsupportedParameter(detail: string, parameter: string): boolean {
  const text = safeText(detail).toLowerCase();
  const parameterName = parameter.toLowerCase();
  return (
    text.includes(parameterName) &&
    (text.includes("unsupported parameter") || text.includes("not supported") || text.includes("does not support"))
  );
}

export async function requestAiChat(settings: ActiveAiSettings, request: AiChatRequest): Promise<unknown> {
  const url = getChatCompletionsUrl(settings);
  const headers = getChatCompletionsHeaders(settings);
  const model = getChatCompletionsModel(settings);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 60000);

  const requestInit = (
    tokenField: "max_completion_tokens" | "max_tokens",
    includeTemperature: boolean
  ) => ({
    method: "POST",
    headers,
    signal: controller.signal,
    body: JSON.stringify({
      ...(model ? { model } : {}),
      messages: request.messages,
      [tokenField]: request.maxTokens,
      ...(!includeTemperature || request.temperature === undefined ? {} : { temperature: request.temperature })
    })
  });

  try {
    let tokenField: "max_completion_tokens" | "max_tokens" = "max_completion_tokens";
    let includeTemperature = request.temperature !== undefined && !isAzureReasoningDeployment(settings);
    let response: Response | null = null;
    let detail = "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(url, requestInit(tokenField, includeTemperature));
      detail = response.ok ? "" : await response.text();
      if (response.ok) {
        break;
      }
      if (includeTemperature && isUnsupportedParameter(detail, "temperature")) {
        includeTemperature = false;
        continue;
      }
      if (tokenField === "max_completion_tokens" && isUnsupportedParameter(detail, "max_completion_tokens")) {
        tokenField = "max_tokens";
        continue;
      }
      break;
    }

    if (!response?.ok) {
      throw new AiUpstreamError(
        `${aiProviderName(settings.provider)} ${request.operation}失败：${response?.status ?? "未知状态"} ${detail.slice(0, 320)}`
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

    const message = errorMessage(error, "未知网络错误");
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
