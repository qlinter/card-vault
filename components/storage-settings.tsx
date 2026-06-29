"use client";

import { useState } from "react";

type StorageSettingsProps = {
  currentPath: string;
};

export function StorageSettings({ currentPath }: StorageSettingsProps) {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleChooseDirectory() {
    if (!window.cardVaultDesktop) {
      setMessage("当前运行环境不支持修改存储路径。");
      return;
    }

    setIsPending(true);
    setMessage(null);

    try {
      const result = await window.cardVaultDesktop.chooseStorageDirectory();

      if (result.cancelled) {
        setMessage("已取消修改存储路径。");
        return;
      }

      if (!result.changed) {
        setMessage("已选择当前路径，无需变更。");
        return;
      }

      setMessage(`新路径已保存到 ${result.path}，应用正在重启。`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "请稍后重试。";
      setMessage(`修改存储路径失败：${detail}`);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="panel" style={{ marginBottom: "1rem" }}>
      <div className="title-row" style={{ marginBottom: "0.4rem" }}>
        <div>
          <strong>存储路径</strong>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            {currentPath}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleChooseDirectory} disabled={isPending}>
          {isPending ? "处理中..." : "更改路径"}
        </button>
      </div>
      {message ? (
        <p className="muted" style={{ margin: 0 }}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
