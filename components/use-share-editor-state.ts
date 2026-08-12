import { useMemo, useState } from "react";
import type { ShareCardDraft, SharePickerCard } from "@/components/share-card-picker";
import type { ShareThemeCard, ShareThemeValues } from "@/components/share-theme-generator";
import type { SharePresentation } from "@/lib/share-presentation";
import type { ShareSectionDraft } from "@/lib/share-sections";
import type { ShareThemeId } from "@/lib/share-themes";
import { type ShareEditorSnapshot } from "@/lib/share-editor-state";

export type ShareEditorInitialValues = ShareThemeValues & {
  theme: ShareThemeId;
  coverImagePath: string;
  backgroundImagePath: string;
  presentation: SharePresentation;
  sections: ShareSectionDraft[];
};

function initialDrafts(cards: SharePickerCard[]): Record<string, ShareCardDraft> {
  return Object.fromEntries(cards.map((card) => [card.id, { sortOrder: String(card.sortOrder), displayTitle: card.displayTitle, displayDescription: card.displayDescription }]));
}

export function useShareEditorState(cards: SharePickerCard[], aiCards: ShareThemeCard[], initialValues: ShareEditorInitialValues) {
  const initialCoverImagePath = initialValues.coverImagePath.startsWith("/share-covers/") ? initialValues.coverImagePath : "";
  const initialBackgroundImagePath = initialValues.backgroundImagePath.startsWith("/share-backgrounds/") ? initialValues.backgroundImagePath : "";
  const [activeStep, setActiveStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState(() => cards.filter((card) => card.selected).map((card) => card.id));
  const [drafts, setDrafts] = useState(() => initialDrafts(cards));
  const [themeValues, setThemeValues] = useState<ShareThemeValues>(() => ({ title: initialValues.title, subtitle: initialValues.subtitle, description: initialValues.description, themeNarrative: initialValues.themeNarrative, themeHighlights: initialValues.themeHighlights, groupNotes: initialValues.groupNotes }));
  const [theme, setTheme] = useState<ShareThemeId>(initialValues.theme);
  const [presentation, setPresentation] = useState<SharePresentation>(initialValues.presentation);
  const [sections, setSections] = useState<ShareSectionDraft[]>(initialValues.sections);
  const [coverMode, setCoverMode] = useState<"auto" | "custom">(initialCoverImagePath ? "custom" : "auto");
  const [message, setMessage] = useState("");

  const currentSnapshot = useMemo<ShareEditorSnapshot>(() => ({ selectedIds, drafts, themeValues, theme, presentation, sections, coverMode }), [coverMode, drafts, presentation, sections, selectedIds, theme, themeValues]);
  const initialSnapshot = useMemo<ShareEditorSnapshot>(() => ({
    selectedIds: cards.filter((card) => card.selected).map((card) => card.id),
    drafts: initialDrafts(cards),
    themeValues: { title: initialValues.title, subtitle: initialValues.subtitle, description: initialValues.description, themeNarrative: initialValues.themeNarrative, themeHighlights: initialValues.themeHighlights, groupNotes: initialValues.groupNotes },
    theme: initialValues.theme,
    presentation: initialValues.presentation,
    sections: initialValues.sections,
    coverMode: initialCoverImagePath ? "custom" : "auto"
  }), [cards, initialCoverImagePath, initialValues]);

  const selectedAiCards = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return aiCards.filter((card) => selectedSet.has(card.id));
  }, [aiCards, selectedIds]);
  const selectedCards = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    const selectedOrder = new Map(selectedIds.map((id, index) => [id, index]));
    return cards.filter((card) => selectedSet.has(card.id)).sort((a, b) => {
      const aOrder = Number.parseInt(drafts[a.id]?.sortOrder ?? `${a.sortOrder}`, 10);
      const bOrder = Number.parseInt(drafts[b.id]?.sortOrder ?? `${b.sortOrder}`, 10);
      const aRank = Number.isFinite(aOrder) && aOrder > 0 ? aOrder : selectedOrder.get(a.id) ?? 0;
      const bRank = Number.isFinite(bOrder) && bOrder > 0 ? bOrder : selectedOrder.get(b.id) ?? 0;
      return aRank - bRank;
    });
  }, [cards, drafts, selectedIds]);

  return {
    activeStep, setActiveStep, selectedIds, setSelectedIds, drafts, setDrafts, themeValues, setThemeValues, theme, setTheme,
    presentation, setPresentation, sections, setSections, coverMode, setCoverMode, message, setMessage,
    currentSnapshot, initialSnapshot, selectedAiCards, selectedCards,
    selectedCardLabels: selectedCards.map((card) => `${card.playerName} - ${card.cardTitle}`),
    initialCoverImagePath, initialBackgroundImagePath
  };
}
