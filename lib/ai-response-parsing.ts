export function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function stripThinkingText(value: unknown): string {
  let text = safeText(value);
  if (!text) {
    return "";
  }

  text = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<思考>[\s\S]*?<\/思考>/g, "");

  const finalMarkers = ["最终答案：", "最终答案:", "最终输出：", "最终输出:", "最终文案：", "最终文案:", "最终结果：", "最终结果:"];
  for (const marker of finalMarkers) {
    const index = text.lastIndexOf(marker);
    if (index >= 0) {
      text = text.slice(index + marker.length);
      break;
    }
  }

  text = text.replace(
    /(^|\n)\s*(思考过程|推理过程|分析过程|思路|Reasoning|Thought process)\s*[:：][\s\S]*?(?=\n\s*(最终答案|最终输出|最终文案|最终结果|结果|JSON|标题|title|description|themeNarrative)\s*[:：]|\n\s*\{|\s*$)/gi,
    "\n"
  );

  return text.trim();
}

export function cleanGeneratedText(value: unknown): string {
  return stripThinkingText(value)
    .replace(/^\s*(最终答案|最终输出|最终文案|最终结果|结果)\s*[:：]\s*/i, "")
    .trim();
}

export function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          return contentToText(record.text) || contentToText(record.content) || contentToText(record.output_text);
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;
    return contentToText(record.text) || contentToText(record.content) || contentToText(record.output_text);
  }

  return "";
}

export function responseToText(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }

  const record = data as Record<string, unknown>;
  for (const candidate of [record.reply, record.output_text, record.text, record.content, record.output]) {
    const text = cleanGeneratedText(contentToText(candidate));
    if (text) {
      return text;
    }
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") {
      continue;
    }

    const choiceRecord = choice as Record<string, unknown>;
    const message = choiceRecord.message && typeof choiceRecord.message === "object" ? (choiceRecord.message as Record<string, unknown>) : null;
    const text = cleanGeneratedText(
      contentToText(message?.content) ||
        contentToText(choiceRecord.text) ||
        contentToText(choiceRecord.content) ||
        contentToText(choiceRecord.delta)
    );

    if (text) {
      return text;
    }
  }

  return "";
}

export function findJsonSlice(value: unknown): string | null {
  const withoutFence = safeText(value)
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < withoutFence.length; index += 1) {
    const char = withoutFence[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return withoutFence.slice(start, index + 1);
      }
    }
  }

  return null;
}

export function extractJsonRecord(value: unknown): Record<string, unknown> {
  const rawText = safeText(value);
  const candidates = [rawText, stripThinkingText(rawText)];

  for (const text of candidates) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed === "string") {
        return extractJsonRecord(parsed);
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Continue with embedded JSON extraction.
    }

    const jsonSlice = findJsonSlice(text);
    if (jsonSlice) {
      try {
        const parsed = JSON.parse(jsonSlice) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Continue with next candidate.
      }
    }
  }

  throw new Error("AI 返回内容不是有效 JSON。");
}
