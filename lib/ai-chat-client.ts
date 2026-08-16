import type { ActiveAiSettings } from "./ai-settings.ts";
import {
  getChatCompletionsHeaders,
  getChatCompletionsModel,
  getChatCompletionsUrl,
  isAzureReasoningDeployment
} from "./ai-settings.ts";
import { responseFinishReason, responseToText, safeText } from "./ai-response-parsing.ts";
import { errorMessage } from "./feedback-messages.ts";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: unknown;
};

export type AiChatRequest = {
  messages: AiChatMessage[];
  maxTokens: number;
  temperature?: number;
  operation: string;
  timeoutMs?: number;
  responseFormat?: "json_object";
};

export type AiChatTextResult = {
  text: string;
  finishReason: string | null;
};

export class AiUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUpstreamError";
  }
}

export function aiProviderName(provider: string, customName?: string): string {
  if (provider === "custom") return safeText(customName) || "自定义 AI";
  return provider === "minimax" ? "MiniMax" : "Azure OpenAI";
}

function activeProviderName(settings: ActiveAiSettings): string {
  return aiProviderName(settings.provider, settings.provider === "custom" ? settings.name : undefined);
}

function isUnsupportedParameter(detail: string, parameter: string): boolean {
  const text = safeText(detail).toLowerCase();
  const parameterName = parameter.toLowerCase();
  return (
    text.includes(parameterName) &&
    (text.includes("unsupported parameter") || text.includes("not supported") || text.includes("does not support"))
  );
}

const transientStatuses = new Set([408, 409, 429, 500, 502, 503, 504]);

function retryDelay(response: Response | null, retryIndex: number): number {
  const retryAfter = response?.headers.get("retry-after")?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(3000, Math.max(0, seconds * 1000));
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(3000, Math.max(0, date - Date.now()));
  }
  return retryIndex === 0 ? 200 : 700;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function requestAiChat(settings: ActiveAiSettings, request: AiChatRequest): Promise<unknown> {
  const url = getChatCompletionsUrl(settings);
  const headers = getChatCompletionsHeaders(settings);
  const model = getChatCompletionsModel(settings);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 60000);

  const requestInit = (
    tokenField: "max_completion_tokens" | "max_tokens",
    includeTemperature: boolean,
    includeResponseFormat: boolean
  ) => ({
    method: "POST",
    headers,
    signal: controller.signal,
    body: JSON.stringify({
      ...(model ? { model } : {}),
      messages: request.messages,
      [tokenField]: request.maxTokens,
      ...(!includeTemperature || request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(!includeResponseFormat ? {} : { response_format: { type: request.responseFormat } })
    })
  });

  try {
    let tokenField: "max_completion_tokens" | "max_tokens" = "max_completion_tokens";
    let includeTemperature = request.temperature !== undefined && !isAzureReasoningDeployment(settings);
    let includeResponseFormat = request.responseFormat !== undefined;
    let response: Response | null = null;
    let detail = "";
    let transientRetryCount = 0;
    let compatibilityRetryCount = 0;

    while (transientRetryCount <= 2 && compatibilityRetryCount <= 3) {
      try {
        response = await fetch(url, requestInit(tokenField, includeTemperature, includeResponseFormat));
        detail = response.ok ? "" : await response.text();
        if (response.ok) break;
        if (includeTemperature && isUnsupportedParameter(detail, "temperature")) {
          includeTemperature = false;
          compatibilityRetryCount += 1;
          continue;
        }
        if (tokenField === "max_completion_tokens" && isUnsupportedParameter(detail, "max_completion_tokens")) {
          tokenField = "max_tokens";
          compatibilityRetryCount += 1;
          continue;
        }
        if (includeResponseFormat && isUnsupportedParameter(detail, "response_format")) {
          includeResponseFormat = false;
          compatibilityRetryCount += 1;
          continue;
        }
        if (transientStatuses.has(response.status) && transientRetryCount < 2) {
          await wait(retryDelay(response, transientRetryCount));
          transientRetryCount += 1;
          continue;
        }
        break;
      } catch (error) {
        if (controller.signal.aborted || transientRetryCount >= 2) throw error;
        await wait(retryDelay(null, transientRetryCount));
        transientRetryCount += 1;
      }
    }

    if (!response?.ok) {
      throw new AiUpstreamError(
        `${activeProviderName(settings)} ${request.operation}失败：${response?.status ?? "未知状态"} ${detail.slice(0, 320)}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof AiUpstreamError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new AiUpstreamError(`${activeProviderName(settings)} ${request.operation}超时，请稍后重试。`);
    }

    const message = errorMessage(error, "未知网络错误");
    const detail = message === "Failed to fetch"
      ? "无法连接 AI 服务，请检查网络、Endpoint 和代理设置"
      : message;
    throw new AiUpstreamError(`${activeProviderName(settings)} ${request.operation}失败：${detail}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAiChatText(
  settings: ActiveAiSettings,
  request: AiChatRequest
): Promise<string> {
  return (await requestAiChatTextResult(settings, request)).text;
}

export async function requestAiChatTextResult(
  settings: ActiveAiSettings,
  request: AiChatRequest
): Promise<AiChatTextResult> {
  const response = await requestAiChat(settings, request);
  const content = responseToText(response);
  if (!safeText(content)) {
    throw new AiUpstreamError(`${activeProviderName(settings)} 没有返回可用${request.operation}结果。`);
  }

  return { text: content, finishReason: responseFinishReason(response) };
}
