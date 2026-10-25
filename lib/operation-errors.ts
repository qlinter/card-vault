import { errorMessage } from "./feedback-messages.ts";

export type OperationErrorCode = "invalid_input" | "not_found" | "conflict" | "data_changed";
export const operationMessages = {
  dataChanged: "收藏数据正在连续变化，请稍后刷新。",
  ambiguousImport: "匹配到多张卡片，请映射明确的卡片 ID。",
  importChanged: "匹配期间卡片发生变化，请重新建立预演。",
  missingImportCard: "指定的卡片 ID 不存在，请检查后重新预演。"
} as const;

export class OperationError extends Error {
  readonly code: OperationErrorCode;
  constructor(code: OperationErrorCode, message: string) { super(message); this.code = code; this.name = "OperationError"; }
}

export function operationFailure(error: unknown, fallback: string) {
  const code = error instanceof OperationError ? error.code : "invalid_input";
  return { status: code === "not_found" ? 404 : code === "conflict" || code === "data_changed" ? 409 : 400,
    body: { error: errorMessage(error, fallback), code } };
}
