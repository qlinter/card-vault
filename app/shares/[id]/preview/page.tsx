import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeImagePath } from "@/lib/image-path";
import { prisma } from "@/lib/prisma";
import { toPublicExportCard } from "@/lib/share-export-data";
import { renderPreviewDocument } from "@/lib/share-export-render";
import type { ExportData } from "@/lib/share-export-types";
import { parseSharePresentation, sanitizeSharePresentationCards } from "@/lib/share-presentation";
import { sharePreviewSandboxPolicy } from "@/lib/share-preview-policy";
import { normalizeShareSectionLayout } from "@/lib/share-sections";
import { normalizeShareTheme, shareThemeBackgroundPath } from "@/lib/share-themes";

type PreviewSharePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PreviewSharePage({ params }: PreviewSharePageProps) {
  const { id } = await params;
  const share = await prisma.shareCollection.findUnique({
    where: { id },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      items: {
        include: { card: { include: { images: { orderBy: { createdAt: "asc" } } } } },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!share) {
    notFound();
  }

  const fallbackCoverImage = share.items.find((item) => item.card.images.length > 0)?.card.images[0] ?? null;
  const fallbackCover = fallbackCoverImage?.path ?? null;
  const coverImagePath = share.coverImagePath?.startsWith("/share-covers/") ? share.coverImagePath : fallbackCover;
  const theme = normalizeShareTheme(share.theme);
  const customBackground = share.backgroundImagePath?.startsWith("/share-backgrounds/")
    ? normalizeImagePath(share.backgroundImagePath)
    : null;
  const cards = share.items.map((item) =>
    toPublicExportCard({
      item,
      href: `#card-${item.cardId}`,
      images: item.card.images.map((image) => ({
        src: normalizeImagePath(image.path),
        thumbnailSrc: normalizeImagePath(image.path),
        width: 0,
        height: 0,
        rotation: image.rotation,
        sourceRotation: image.rotation
      }))
    })
  );
  const data: ExportData = {
    title: share.title,
    theme,
    presentation: sanitizeSharePresentationCards(parseSharePresentation(share.presentationConfig), share.items.map((item) => item.cardId)),
    subtitle: share.subtitle,
    description: share.description,
    themeNarrative: share.themeNarrative,
    themeHighlights: share.themeHighlights,
    groupNotes: share.groupNotes,
    coverImage: coverImagePath ? normalizeImagePath(coverImagePath) : null,
    coverRotation: share.coverImagePath?.startsWith("/share-covers/") ? 0 : fallbackCoverImage?.rotation ?? 0,
    backgroundImage: customBackground ?? shareThemeBackgroundPath(theme),
    generatedAt: new Date().toISOString(),
    mode: "static",
    sections: share.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description ?? "",
      layout: normalizeShareSectionLayout(section.layout),
      cardIds: share.items.filter((item) => item.sectionId === section.id).map((item) => item.cardId)
    })),
    cards
  };

  return (
    <div className="page share-unified-preview-page">
      <div className="title-row">
        <div>
          <h1 className="h1">{share.title}</h1>
        </div>
        <div className="title-actions">
          <Link className="btn btn-secondary" href="/shares">
            返回分享
          </Link>
          <Link className="btn btn-secondary" href={`/shares/${share.id}/edit`}>
            编辑
          </Link>
          <Link className="btn btn-primary" href={`/shares/${share.id}/export`}>
            导出
          </Link>
        </div>
      </div>
      <div className="share-preview-frame-shell">
        <iframe title={`${share.title} 展馆预览`} srcDoc={renderPreviewDocument(data)} sandbox={sharePreviewSandboxPolicy} />
      </div>
    </div>
  );
}
