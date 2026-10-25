import type { CollectionTask } from "./collection-tasks.ts";

export function isFollowUpTask(kind: CollectionTask["kind"]): boolean {
  return kind === "grading" || kind === "listed";
}

// Automatic data gaps belong to the quality list. Keep previously handled
// reminders accessible without duplicating its open data issues.
export function includeFollowUpTask(kind: CollectionTask["kind"], state: string, handled = false): boolean {
  return isFollowUpTask(kind) || (handled && state !== "open");
}
