"use client";

import { useMemo } from "react";
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
  backgroundImagePath: string;
};

export function ShareDesignPreview({
  theme,
  presentation,
  values,
  sections,
  cards,
  drafts,
  backgroundImagePath
}: ShareDesignPreviewProps) {
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
      coverImage: exportCards.find((card) => card.images.length > 0)?.images[0] ?? null,
      backgroundImage: backgroundImagePath ? normalizeImagePath(backgroundImagePath) : shareThemeBackgroundPath(theme),
      generatedAt: new Date(0).toISOString(),
      mode: "static",
      sections: sections.map((section) => ({ ...section })),
      cards: exportCards
    };
    return renderPreviewDocument(data);
  }, [backgroundImagePath, cards, drafts, presentation, sections, theme, values]);

  return (
    <aside className="share-live-preview">
      <div className="share-live-preview-head">
        <div>
          <strong>实时预览</strong>
          <span className="muted">与静态导出共用渲染器</span>
        </div>
      </div>
      <iframe title="分享展馆实时预览" srcDoc={document} sandbox="allow-scripts" />
    </aside>
  );
}
