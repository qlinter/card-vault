"use client";

import { useRef, useState } from "react";
import { UiText } from "./ui-text";
import { useLanguage } from "./language-provider";
import { ShowcaseIcon } from "./showcase-icon";

export function CardImageExport({ cardId, showcase = false }: { cardId: string; showcase?: boolean }) {
  const { t } = useLanguage();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(cardId)}/images/export`);
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const encoded = response.headers.get("content-disposition")?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = encoded ? decodeURIComponent(encoded) : "card-images.zip";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <div className="card-image-export">
    <button type="button" className={showcase ? "showcase-tool" : "btn btn-secondary"} title={t("导出原始图片，多张图片将打包为 ZIP")} onClick={download} disabled={pending} aria-busy={pending} aria-label={t(pending ? "正在导出..." : "导出图片")}>
      <ShowcaseIcon name="download" />
    </button>
    {failed ? <p className="note-error" role="alert"><UiText text="图片导出失败，请稍后重试。" /></p> : null}
  </div>;
}
