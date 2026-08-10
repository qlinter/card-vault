"use client";

import { useEffect, useState } from "react";
import { OperationProgress, type OperationProgressValue } from "@/components/operation-progress";

type StorageSettingsProps = {
  currentPath: string;
};

type DesktopApi = NonNullable<Window["cardVaultDesktop"]>;
type DataHealth = Awaited<ReturnType<DesktopApi["checkDataHealth"]>>;
type OrphanFile = DataHealth["orphanFiles"][number];

const orphanTypeLabels: Record<string, string> = {
  cardImage: "卡片图片",
  shareCover: "分享封面",
  shareBackground: "分享背景"
};

function desktopApi() {
  return window.cardVaultDesktop;
}

function orphanTypeLabel(file: OrphanFile) {
  return orphanTypeLabels[file.type] || "媒体文件";
}

export function StorageSettings({ currentPath }: StorageSettingsProps) {
  const [displayedPath, setDisplayedPath] = useState(currentPath);
  const [busyAction, setBusyAction] = useState<"storage" | "health" | "cleanup" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [health, setHealth] = useState<DataHealth | null>(null);
  const [revealingPath, setRevealingPath] = useState<string | null>(null);
  const [progress, setProgress] = useState<OperationProgressValue | null>(null);
  const [activeStorageOperation, setActiveStorageOperation] = useState<string | null>(null);

  useEffect(() => {
    setDisplayedPath(currentPath);
  }, [currentPath]);

  useEffect(() => {
    const api = desktopApi();
    if (!api) return;
    return api.onStorageProgress((nextProgress) => {
      setActiveStorageOperation(nextProgress.done ? null : nextProgress.operation);
      if (["migrate", "health", "cleanup"].includes(nextProgress.operation)) {
        setProgress(nextProgress.done ? null : { percent: nextProgress.percent, message: nextProgress.message });
      }
    });
  }, []);

  async function handleChooseDirectory() {
    const api = desktopApi();
    if (!api) {
      setMessage("当前运行环境不支持修改存储路径。");
      return;
    }

    setBusyAction("storage");
    setProgress({ percent: 0, message: "正在准备存储路径迁移..." });
    setMessage(null);
    try {
      const result = await api.chooseStorageDirectory();
      if (!result.cancelled) {
        setDisplayedPath(result.path);
      }
      if (result.cancelled) {
        setMessage("已取消修改存储路径。");
      } else if (!result.changed) {
        setMessage("已选择当前路径，无需变更。");
      } else {
        setHealth(null);
        setMessage(`新路径已保存到 ${result.path}，应用正在重启。`);
      }
    } catch (error) {
      setMessage(`修改存储路径失败：${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setBusyAction(null);
      setProgress(null);
    }
  }

  async function handleHealthCheck() {
    const api = desktopApi();
    if (!api) {
      setMessage("当前运行环境不支持数据健康检查。");
      return;
    }

    setBusyAction("health");
    setProgress({ percent: 0, message: "正在准备健康检查..." });
    setMessage(null);
    try {
      const result = await api.checkDataHealth();
      setHealth(result);
      setMessage(result.ok ? "数据健康检查通过。" : "数据健康检查发现问题，请查看下方结果。");
    } catch (error) {
      setMessage(`数据健康检查失败：${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setBusyAction(null);
      setProgress(null);
    }
  }

  async function handleCleanup() {
    const api = desktopApi();
    if (!api) {
      setMessage("当前运行环境不支持清理未引用文件。");
      return;
    }

    setBusyAction("cleanup");
    setProgress({ percent: 0, message: "正在准备清理前复核..." });
    setMessage(null);
    try {
      const result = await api.cleanOrphanFiles();
      setHealth(result.health);
      if (result.cancelled) {
        setMessage("已取消清理，未删除任何文件。");
      } else if (result.failedFiles.length > 0) {
        setMessage(`已清理 ${result.deletedFiles.length} 个文件，另有 ${result.failedFiles.length} 个文件清理失败。`);
      } else {
        setMessage(`清理完成，共删除 ${result.deletedFiles.length} 个未引用文件。`);
      }
    } catch (error) {
      setMessage(`清理失败：${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setBusyAction(null);
      setProgress(null);
    }
  }

  async function handleRevealOrphanFile(file: OrphanFile) {
    const api = desktopApi();
    if (!api) {
      setMessage("当前运行环境不支持在文件夹中查看文件。");
      return;
    }

    setRevealingPath(file.path);
    setMessage(null);
    try {
      await api.showOrphanFileInFolder(file);
    } catch (error) {
      setMessage(`无法在文件夹中定位该文件：${error instanceof Error ? error.message : "请重新检查数据健康。"}`);
    } finally {
      setRevealingPath(null);
    }
  }

  const busy = busyAction !== null || revealingPath !== null || activeStorageOperation !== null;

  return (
    <section className="panel settings-section">
      <div className="title-row" style={{ marginBottom: "0.4rem" }}>
        <div>
          <h2>存储数据</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            设置数据库、卡片图片、分享封面和导出文件的本地保存位置，并检查当前存储数据是否完整。
          </p>
        </div>
        <div className="storage-actions">
          <button type="button" className="btn btn-secondary" onClick={handleChooseDirectory} disabled={busy}>
            {busyAction === "storage" ? "处理中..." : "更改存储路径"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleHealthCheck} disabled={busy}>
            {busyAction === "health" ? "检查中..." : "检查数据健康"}
          </button>
        </div>
      </div>
      <p className="muted" style={{ margin: "0.35rem 0 0" }}>
        <strong>当前路径：</strong>{displayedPath}
      </p>
      <OperationProgress progress={progress} />
      {health ? (
        <div className={health.ok ? "note-ok health-result" : "note-error health-result"}>
          <strong>{health.ok ? "数据状态正常" : "数据需要处理"}</strong>
          <p>
            数据库：{health.integrity}；卡片 {health.counts.cards} 张；图片记录 {health.counts.images} 条；分享集 {health.counts.shares} 个。
          </p>
          <p>
            缺失文件 {health.missingFiles.length} 个；未被数据库引用的文件 {health.orphanFiles.length} 个。
          </p>
          {health.issues.map((issue) => <p key={issue}>{issue}</p>)}
          {health.orphanFiles.length > 0 ? (
            <div className="orphan-cleanup-panel">
              <details>
                <summary>查看未引用文件明细（{health.orphanFiles.length} 个）</summary>
                <p className="muted">这些文件位于当前数据目录中，但没有被任何卡片或分享集引用。</p>
                <ul className="orphan-file-list">
                  {health.orphanFiles.map((file) => (
                    <li key={`${file.type}:${file.path}`}>
                      <span>{orphanTypeLabel(file)}</span>
                      <code>{file.path}</code>
                      <button
                        type="button"
                        className="orphan-reveal-button"
                        onClick={() => void handleRevealOrphanFile(file)}
                        disabled={busy}
                      >
                        {revealingPath === file.path ? "正在打开..." : "在文件夹中查看"}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
              <button type="button" className="btn btn-danger" onClick={handleCleanup} disabled={busy}>
                {busyAction === "cleanup" ? "清理中..." : `清理 ${health.orphanFiles.length} 个未引用文件`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="muted backup-message">{message}</p> : null}
    </section>
  );
}
