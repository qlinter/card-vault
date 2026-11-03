"use client";

import { UiText } from "@/components/ui-text";
import { useEffect, useState } from "react";
import { OperationProgress } from "@/components/operation-progress";
import { useDesktopStorageProgress } from "@/components/use-desktop-storage-progress";
import { errorMessage } from "@/lib/feedback-messages";

function desktopApi() {
  return window.cardVaultDesktop;
}

const restoreMessageKey = "card-vault:restore-completed";

export function BackupSettings() {
  const [backupPath, setBackupPath] = useState("正在读取...");
  const [lastBackup, setLastBackup] = useState<Awaited<ReturnType<NonNullable<Window["cardVaultDesktop"]>["getBackupSettings"]>>["lastBackup"]>(null);
  const [busyAction, setBusyAction] = useState<"choose" | "backup" | "restore" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { progress, setProgress, activeStorageOperation } = useDesktopStorageProgress(["backup", "restore"]);

  useEffect(() => {
    let mounted = true;
    const restoredMessage = window.sessionStorage.getItem(restoreMessageKey);
    if (restoredMessage) {
      window.sessionStorage.removeItem(restoreMessageKey);
      setMessage(restoredMessage);
    }
    async function loadSettings() {
      const api = desktopApi();
      if (!api) {
        setBackupPath("当前运行环境不支持本地备份。");
        return;
      }
      try {
        const settings = await api.getBackupSettings();
        if (mounted) {
          setBackupPath(settings.path);
          setLastBackup(settings.lastBackup);
        }
      } catch {
        if (mounted) {
          setBackupPath("读取备份路径失败。");
        }
      }
    }
    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleChooseDirectory() {
    const api = desktopApi();
    if (!api) {
      setMessage("当前运行环境不支持修改备份路径。");
      return;
    }
    setBusyAction("choose");
    setMessage(null);
    try {
      const result = await api.chooseBackupDirectory();
      setBackupPath(result.path);
      setMessage(result.cancelled ? "已取消修改备份路径。" : "备份路径已更新。");
    } catch (error) {
      setMessage(`修改备份路径失败：${errorMessage(error, "请稍后重试。")}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBackup() {
    const api = desktopApi();
    if (!api) {
      setMessage("当前运行环境不支持本地备份。");
      return;
    }
    setBusyAction("backup");
    setProgress({ percent: 0, message: "正在准备备份..." });
    setMessage(null);
    try {
      const result = await api.backupDataFolder();
      setBackupPath(result.backupRoot);
      setMessage(`备份完成：${result.backupPath}${result.metadataWarning ? ` · ${result.metadataWarning}` : ""}`);
      setLastBackup((await api.getBackupSettings()).lastBackup);
    } catch (error) {
      setMessage(`备份失败：${errorMessage(error, "请稍后重试。")}`);
    } finally {
      setBusyAction(null);
      setProgress(null);
    }
  }

  async function handleRestore() {
    const api = desktopApi();
    if (!api) {
      setMessage("当前运行环境不支持备份恢复。");
      return;
    }
    setBusyAction("restore");
    setProgress({ percent: 0, message: "正在准备恢复..." });
    setMessage(null);
    try {
      const result = await api.restoreDataFolder();
      if (result.cancelled) {
        setMessage("已取消恢复。");
        setBusyAction(null);
        setProgress(null);
      } else {
        window.sessionStorage.setItem(restoreMessageKey, "恢复完成，当前页面已加载备份中的数据。");
        setMessage("恢复完成，正在刷新当前页面...");
        window.location.reload();
      }
    } catch (error) {
      setMessage(`恢复失败：${errorMessage(error, "请稍后重试。")}`);
      setBusyAction(null);
      setProgress(null);
    }
  }

  const busy = busyAction !== null || activeStorageOperation !== null;

  return (
    <section className="panel settings-section backup-settings">
      <div className="title-row" style={{ marginBottom: "0.4rem" }}>
        <div>
          <h2><UiText text={"备份与恢复"} /></h2>
        </div>
        <div className="backup-actions">
          <button type="button" className="btn btn-secondary" onClick={handleChooseDirectory} disabled={busy}>
            {busyAction === "choose" ? <UiText text={"选择中..."} /> : <UiText text={"设置备份路径"} />}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleBackup} disabled={busy}>
            {busyAction === "backup" ? <UiText text={"备份中..."} /> : <UiText text={"一键备份"} />}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleRestore} disabled={busy}>
            {busyAction === "restore" ? <UiText text={"恢复中..."} /> : <UiText text={"备份恢复"} />}
          </button>
        </div>
      </div>
      <p className="settings-path">
        <UiText text={"备份路径："} />{["正在读取...", "当前运行环境不支持本地备份。", "读取备份路径失败。"].includes(backupPath) ? <UiText text={backupPath} /> : backupPath}
      </p>
      {lastBackup ? <p className="muted" role="status">
          <UiText text="最近成功备份：{0}，{1}MB，{2} 张图片。" values={[new Date(lastBackup.createdAt).toLocaleString(), (lastBackup.bytes / 1024 / 1024).toFixed(1), lastBackup.imageCount]} />
          {!lastBackup.available ? <UiText text="备份文件当前不可用，请检查路径或重新备份。" /> : Date.now() - new Date(lastBackup.createdAt).getTime() > 7 * 86400000 ? <UiText text="距上次备份已超过 7 天，建议重新备份。" /> : <UiText text="创建时已完成完整性校验。" />}
      </p> : null}
      <OperationProgress progress={progress} />
      {message ? <p className="muted backup-message"><UiText text={message} /></p> : null}
    </section>
  );
}
