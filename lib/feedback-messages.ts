export type FeedbackMessageMap = Readonly<Record<string, string>>;

export const commonSuccessMessages = {
  created: "添加成功",
  added: "添加成功",
  updated: "修改成功",
  deleted: "删除成功"
} as const;

export const cardSuccessMessages = {
  ...commonSuccessMessages,
  "history-added": "财务记录已添加",
  "history-updated": "财务记录已纠错",
  "history-deleted": "财务记录已删除"
} as const;

export const shareListSuccessMessages = {
  deleted: "分享集已删除。"
} as const;

export const shareEditSuccessMessages = {
  created: "分享集已创建。",
  updated: "分享集已保存。"
} as const;

export function resolveSuccessMessage(
  value: string | undefined,
  messages: FeedbackMessageMap,
  options: { passthroughUnknown?: boolean } = {}
): string | null {
  if (!value) return null;
  return messages[value] ?? (options.passthroughUnknown ? value : null);
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
