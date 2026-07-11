"use client";

import { useEffect, useState } from "react";

type BackupDesktopApi = NonNullable<Window["cardVaultDesktop"]> & {
  getBackupSettings: () => Promise<{ path: string }>;
  chooseBackupDirectory: () => Promise<{ path: string; cancelled: boolean }>;
  backupDataFolder: () => Promise<{ backupRoot: string; datePath: string; backupPath: string }>;
};

function getBackupDesktopApi(): BackupDesktopApi | undefined {
  return window.cardVaultDesktop as BackupDesktopApi | undefined;
}

export function BackupSettings() {
  const [backupPath, setBackupPath] = useState("\u6b63\u5728\u8bfb\u53d6...");
  const [isChoosing, setIsChoosing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      const desktopApi = getBackupDesktopApi();
      if (!desktopApi) {
        setBackupPath("\u5f53\u524d\u8fd0\u884c\u73af\u5883\u4e0d\u652f\u6301\u672c\u5730\u5907\u4efd\u3002");
        return;
      }

      try {
        const settings = await desktopApi.getBackupSettings();
        if (mounted) {
          setBackupPath(settings.path);
        }
      } catch {
        if (mounted) {
          setBackupPath("\u8bfb\u53d6\u5907\u4efd\u8def\u5f84\u5931\u8d25\u3002");
        }
      }
    }

    loadSettings();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleChooseDirectory() {
    const desktopApi = getBackupDesktopApi();
    if (!desktopApi) {
      setMessage("\u5f53\u524d\u8fd0\u884c\u73af\u5883\u4e0d\u652f\u6301\u4fee\u6539\u5907\u4efd\u8def\u5f84\u3002");
      return;
    }

    setIsChoosing(true);
    setMessage(null);

    try {
      const result = await desktopApi.chooseBackupDirectory();
      setBackupPath(result.path);
      setMessage(result.cancelled ? "\u5df2\u53d6\u6d88\u4fee\u6539\u5907\u4efd\u8def\u5f84\u3002" : "\u5907\u4efd\u8def\u5f84\u5df2\u66f4\u65b0\u3002");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002";
      setMessage("\u4fee\u6539\u5907\u4efd\u8def\u5f84\u5931\u8d25\uff1a" + detail);
    } finally {
      setIsChoosing(false);
    }
  }

  async function handleBackup() {
    const desktopApi = getBackupDesktopApi();
    if (!desktopApi) {
      setMessage("\u5f53\u524d\u8fd0\u884c\u73af\u5883\u4e0d\u652f\u6301\u672c\u5730\u5907\u4efd\u3002");
      return;
    }

    setIsBackingUp(true);
    setMessage(null);

    try {
      const result = await desktopApi.backupDataFolder();
      setBackupPath(result.backupRoot);
      setMessage("\u5907\u4efd\u5b8c\u6210\uff1a" + result.backupPath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002";
      setMessage("\u5907\u4efd\u5931\u8d25\uff1a" + detail);
    } finally {
      setIsBackingUp(false);
    }
  }

  return (
    <section className="panel settings-section">
      <div className="title-row" style={{ marginBottom: "0.4rem" }}>
        <div>
          <h2>{"\u5907\u4efd"}</h2>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {"\u5c06\u5f53\u524d data \u6587\u4ef6\u5939\u5168\u91cf\u5907\u4efd\u5230\u6307\u5b9a\u76ee\u5f55\u4e0b\u7684 \u5e74-\u6708-\u65e5 \u6587\u4ef6\u5939\u3002"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-secondary" onClick={handleChooseDirectory} disabled={isChoosing || isBackingUp}>
            {isChoosing ? "\u9009\u62e9\u4e2d..." : "\u8bbe\u7f6e\u5907\u4efd\u8def\u5f84"}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleBackup} disabled={isChoosing || isBackingUp}>
            {isBackingUp ? "\u5907\u4efd\u4e2d..." : "\u4e00\u952e\u5907\u4efd"}
          </button>
        </div>
      </div>
      <p className="muted" style={{ margin: "0.35rem 0 0" }}>
        <strong>{"\u5907\u4efd\u8def\u5f84\uff1a"}</strong>{backupPath}
      </p>
      {message ? (
        <p className="muted" style={{ margin: "0.5rem 0 0" }}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
