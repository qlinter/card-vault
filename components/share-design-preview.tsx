"use client";

import { useMemo, useState } from "react";
import type { ShareCardDraft, SharePickerCard } from "@/components/share-card-picker";
import type { ShareThemeValues } from "@/components/share-theme-generator";
import { normalizeImagePath } from "@/lib/image-path";
import { renderPreviewDocument } from "@/lib/share-export-render";
import type { ExportData } from "@/lib/share-export-types";
import type { SharePresentation } from "@/lib/share-presentation";
import type { ShareSectionDraft } from "@/lib/share-sections";
import { shareThemeBackgroundPath, type ShareThemeId } from "@/lib/share-themes";

type ShareDesignPreviewProps = {
  theme: ShareThemeId;
  presentation: SharePresentation;
  values: ShareThemeValues;
  sections: ShareSectionDraft[];
  cards: SharePickerCard[];
  drafts: Record<string, ShareCardDraft>;
  coverImagePath: string;
  backgroundImagePath: string;
};

export function ShareDesignPreview({
  theme,
  presentation,
  values,
  sections,
  cards,
  drafts,
  coverImagePath,
  backgroundImagePath
}: ShareDesignPreviewProps) {
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const document = useMemo(() => {
    const exportCards = cards.map((card) => {
      const draft = drafts[card.id];
      return {
        id: card.id,
        playerName: card.playerName,
        cardTitle: card.cardTitle,
        displayTitle: draft?.displayTitle || card.cardTitle,
        description: draft?.displayDescription || card.publicDescription || "",
        sport: card.sport,
        team: card.team,
        year: card.year,
        brand: card.brand,
        productLine: card.productLine,
        subsetName: card.subsetName,
        parallel: card.parallel,
        cardNumber: card.cardNumber,
        serialNumber: card.serialNumber,
        serialRange: card.serialRange,
        isRookie: false,
        isAutograph: false,
        autoType: null,
        isPatch: false,
        patchType: null,
        gradingCompany: card.gradingCompany,
        grade: card.grade,
        certNumber: card.certNumber,
        href: `#card-${card.id}`,
        images: card.imagePath ? [normalizeImagePath(card.imagePath)] : []
      };
    });
    const data: ExportData = {
      title: values.title || "未命名展馆",
      theme,
      presentation,
      subtitle: values.subtitle || null,
      description: values.description || null,
      themeNarrative: values.themeNarrative || null,
      themeHighlights: values.themeHighlights || null,
      groupNotes: values.groupNotes || null,
      coverImage: coverImagePath ? normalizeImagePath(coverImagePath) : exportCards.find((card) => card.images.length > 0)?.images[0] ?? null,
      backgroundImage: backgroundImagePath ? normalizeImagePath(backgroundImagePath) : shareThemeBackgroundPath(theme),
      generatedAt: new Date(0).toISOString(),
      mode: "static",
      sections: sections.map((section) => ({ ...section })),
      cards: exportCards
    };
    return renderPreviewDocument(data);
  }, [backgroundImagePath, cards, coverImagePath, drafts, presentation, sections, theme, values]);

  return (
    <aside className={`share-live-preview is-${previewMode}`}>
      <div className="share-live-preview-head">
        <div>
          <strong>实时预览</strong>
          <span className="muted">与静态导出共用渲染器</span>
        </div>
        <div className="share-preview-modes" role="group" aria-label="预览设备">
          <button
            type="button"
            className={previewMode === "desktop" ? "active" : ""}
            aria-pressed={previewMode === "desktop"}
            onClick={() => setPreviewMode("desktop")}
          >
            桌面
          </button>
          <button
            type="button"
            className={previewMode === "mobile" ? "active" : ""}
            aria-pressed={previewMode === "mobile"}
            onClick={() => setPreviewMode("mobile")}
          >
            手机
          </button>
        </div>
      </div>
      <iframe title="分享展馆实时预览" srcDoc={document} sandbox="allow-scripts" />
    </aside>
  );
}
