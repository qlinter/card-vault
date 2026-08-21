import { useEffect, useState } from "react";
import type { OperationProgressValue } from "@/components/operation-progress";

type DesktopStorageProgress = {
  operation: string;
  percent: number;
  message: string;
  done?: boolean;
};

export function useDesktopStorageProgress(operations: readonly string[]) {
  const [progress, setProgress] = useState<OperationProgressValue | null>(null);
  const [activeStorageOperation, setActiveStorageOperation] = useState<string | null>(null);
  const operationKey = operations.join("|");

  useEffect(() => {
    const api = window.cardVaultDesktop;
    if (!api) return;

    return api.onStorageProgress((nextProgress: DesktopStorageProgress) => {
      setActiveStorageOperation(nextProgress.done ? null : nextProgress.operation);
      if (operations.includes(nextProgress.operation)) {
        setProgress(nextProgress.done ? null : { percent: nextProgress.percent, message: nextProgress.message });
      }
    });
    // operationKey intentionally represents the caller's operation list without
    // resubscribing when an equivalent inline array is recreated during render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationKey]);

  return { progress, setProgress, activeStorageOperation };
}
