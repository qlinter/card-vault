"use client";

import { useEffect, useState } from "react";

function desktopApi() {
  return window.cardVaultDesktop;
}

export function BackupSettings() {
  const [backupPath, setBackupPath] = useState("正在读取...");
  const [busyAction, setBusyAction] = useState<"choose" | "backup" | "restore" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
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
      setMessage(`修改备份路径失败：${error instanceof Error ? error.message : "请稍后重试。"}`);
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
    setMessage(null);
    try {
      const result = await api.backupDataFolder();
      setBackupPath(result.backupRoot);
      setMessage(`备份完成：${result.backupPath}`);
    } catch (error) {
      setMessage(`备份失败：${error instanceof Error ? error.message : "请稍后重试。"}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRestore() {
    const api = desktopApi();
    if (!api) {
      setMessage("当前运行环境不支持备份恢复。");
      return;
    }
    setBusyAction("restore");
    setMessage(null);
    try {
      const result = await api.restoreDataFolder();
      if (result.cancelled) {
        setMessage("已取消恢复。");
        setBusyAction(null);
      } else {
        setMessage("恢复完成，Card Vault 正在重新启动。");
      }
    } catch (error) {
      setMessage(`恢复失败：${error instanceof Error ? error.message : "请稍后重试。"}`);
      setBusyAction(null);
    }
  }

  const busy = busyAction !== null;

  return (
    <section className="panel settings-section">
      <div className="title-row" style={{ marginBottom: "0.4rem" }}>
        <div>
          <h2>备份与恢复</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            备份会生成 SQLite 一致性快照；恢复前会再次备份当前数据。
          </p>
        </div>
        <div className="backup-actions">
          <button type="button" className="btn btn-secondary" onClick={handleChooseDirectory} disabled={busy}>
            {busyAction === "choose" ? "选择中..." : "设置备份路径"}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleBackup} disabled={busy}>
            {busyAction === "backup" ? "备份中..." : "一键备份"}
          </button>
          <button type="button" className="btn btn-danger" onClick={handleRestore} disabled={busy}>
            {busyAction === "restore" ? "恢复中..." : "备份恢复"}
          </button>
        </div>
      </div>
      <p className="muted" style={{ margin: "0.35rem 0 0" }}>
        <strong>备份路径：</strong>{backupPath}
      </p>
      {message ? <p className="muted backup-message">{message}</p> : null}
    </section>
  );
}
