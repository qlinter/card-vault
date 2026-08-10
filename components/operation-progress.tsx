export type OperationProgressValue = {
  percent: number;
  message: string;
};

type OperationProgressProps = {
  progress: OperationProgressValue | null;
};

export function OperationProgress({ progress }: OperationProgressProps) {
  if (!progress) {
    return null;
  }

  const percent = Math.max(0, Math.min(100, Math.round(progress.percent)));
  return (
    <div className="operation-progress" aria-live="polite">
      <div className="operation-progress-copy">
        <span>{progress.message}</span>
        <strong>{percent}%</strong>
      </div>
      <div
        className="operation-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={progress.message}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
