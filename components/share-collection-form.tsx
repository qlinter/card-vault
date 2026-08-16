import { Card, CardImage, ShareCollection, ShareCollectionItem, ShareSection } from "@prisma/client";
import { SharePickerCard } from "@/components/share-card-picker";
import { ShareCollectionWizard } from "@/components/share-collection-wizard";
import { ShareThemeCard } from "@/components/share-theme-generator";
import { normalizeShareTheme } from "@/lib/share-themes";
import { parseSharePresentation } from "@/lib/share-presentation";
import { fallbackShareSections, type ShareSectionDraft } from "@/lib/share-sections";

type CardOption = Card & { images: CardImage[] };
type ShareWithItems =
  | (ShareCollection & {
      items: Array<ShareCollectionItem & { card: CardOption }>;
      sections: ShareSection[];
    })
  | null;

type ShareCollectionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cards: CardOption[];
  share?: ShareWithItems;
  error?: string;
};

function value(input: string | null | undefined, fallback = ""): string {
  return input ?? fallback;
}

function shareItemMap(share?: ShareWithItems): Map<string, ShareCollectionItem & { card: CardOption }> {
  return new Map((share?.items ?? []).map((item) => [item.cardId, item]));
}

function cardCatalogFields(card: CardOption) {
  return {
    id: card.id,
    playerName: card.playerName,
    cardTitle: card.cardTitle,
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
    gradingCompany: card.gradingCompany,
    grade: card.grade,
    certNumber: card.certNumber,
    publicDescription: card.publicDescription
  };
}

function cardSummary(card: CardOption): ShareThemeCard {
  return {
    ...cardCatalogFields(card),
    isRookie: card.isRookie,
    isAutograph: card.isAutograph,
    autoType: card.autoType,
    isPatch: card.isPatch,
    patchType: card.patchType
  };
}

function toPickerCard(card: CardOption, item: (ShareCollectionItem & { card: CardOption }) | undefined): SharePickerCard {
  return {
    ...cardCatalogFields(card),
    visibility: card.visibility,
    tags: card.tags,
    imagePath: card.images[0]?.path ?? null,
    selected: Boolean(item),
    sortOrder: item?.sortOrder ?? 0,
    displayTitle: item?.displayTitle ?? "",
    displayDescription: item?.displayDescription ?? ""
  };
}

export function ShareCollectionForm({ action, cards, share, error }: ShareCollectionFormProps) {
  const selected = shareItemMap(share);
  const sortedCards = [...cards].sort((a, b) => {
    const aItem = selected.get(a.id);
    const bItem = selected.get(b.id);
    if (aItem && bItem) {
      return aItem.sortOrder - bItem.sortOrder;
    }
    if (aItem) {
      return -1;
    }
    if (bItem) {
      return 1;
    }
    return a.playerName.localeCompare(b.playerName);
  });
  const pickerCards = sortedCards.map((card) => toPickerCard(card, selected.get(card.id)));
  const presentation = parseSharePresentation(share?.presentationConfig);
  const sectionItems = new Map<string, string[]>();
  for (const item of share?.items ?? []) {
    if (item.sectionId) {
      sectionItems.set(item.sectionId, [...(sectionItems.get(item.sectionId) ?? []), item.cardId]);
    }
  }
  const storedSections: ShareSectionDraft[] = (share?.sections ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    description: value(section.description),
    layout: section.layout === "rail" || section.layout === "grid" ? section.layout : "editorial",
    cardIds: sectionItems.get(section.id) ?? []
  }));
  const initialSections = storedSections.length > 0
    ? storedSections
    : fallbackShareSections({
        themeNarrative: share?.themeNarrative,
        themeHighlights: share?.themeHighlights,
        groupNotes: share?.groupNotes,
        cardIds: share?.items.map((item) => item.cardId) ?? []
      });

  return (
    <ShareCollectionWizard
      action={action}
      draftId={share?.id ?? "new"}
      cards={pickerCards}
      aiCards={cards.map(cardSummary)}
      initialValues={{
        title: value(share?.title, "我的球星卡展馆"),
        theme: normalizeShareTheme(share?.theme),
        subtitle: value(share?.subtitle),
        description: value(share?.description),
        themeNarrative: value(share?.themeNarrative),
        themeHighlights: value(share?.themeHighlights),
        groupNotes: value(share?.groupNotes),
        coverImagePath: value(share?.coverImagePath),
        backgroundImagePath: value(share?.backgroundImagePath),
        presentation,
        sections: initialSections
      }}
      error={error}
    />
  );
}
