import Link from "next/link";
import type { CSSProperties } from "react";
import { SharePreviewCards, SharePreviewItem } from "@/components/share-preview-cards";
import { normalizeImagePath } from "@/lib/image-path";
import { prisma } from "@/lib/prisma";
import { normalizeShareTheme, shareThemeBackgroundPath } from "@/lib/share-themes";
import { notFound } from "next/navigation";

type PreviewSharePageProps = {
  params: Promise<{ id: string }>;
};

export default async function PreviewSharePage({ params }: PreviewSharePageProps) {
  const { id } = await params;
  const share = await prisma.shareCollection.findUnique({
    where: { id },
    include: {
      items: {
        include: { card: { include: { images: { orderBy: { createdAt: "asc" } } } } },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!share) {
    notFound();
  }

  const fallbackCover = share.items.find((item) => item.card.images.length > 0)?.card.images[0]?.path ?? null;
  const coverImagePath = share.coverImagePath?.startsWith("/share-covers/") ? share.coverImagePath : fallbackCover;
  const theme = normalizeShareTheme(share.theme);
  const customBackgroundImagePath = share.backgroundImagePath?.startsWith("/share-backgrounds/")
    ? normalizeImagePath(share.backgroundImagePath)
    : null;
  const backgroundImagePath = customBackgroundImagePath ?? shareThemeBackgroundPath(theme);
  const backgroundStyle = backgroundImagePath ? ({ "--share-bg-image": `url("${backgroundImagePath}")` } as CSSProperties) : undefined;
  const previewItems: SharePreviewItem[] = share.items.map((item) => ({
    id: item.id,
    playerName: item.card.playerName,
    cardTitle: item.card.cardTitle,
    displayTitle: item.displayTitle || item.card.cardTitle,
    displayDescription: item.displayDescription || item.card.publicDescription || "",
    meta: [item.card.year, item.card.brand, item.card.productLine, item.card.grade].filter(Boolean).join(" / "),
    images: item.card.images.map((image) => ({ id: image.id, path: image.path }))
  }));

  return (
    <div className={`share-preview-page theme-${theme}${backgroundImagePath ? " has-custom-bg" : ""}`} style={backgroundStyle}>
      <main className="share-preview-shell">
        <nav className="share-preview-nav">
          <Link href={`/shares/${share.id}/edit`}>编辑</Link>
          <Link href={`/shares/${share.id}/export`}>导出</Link>
        </nav>

        <section className="share-preview-hero">
          <div>
            <p className="showcase-kicker">Card Vault 展馆</p>
            <h1>{share.title}</h1>
            {share.subtitle ? <p className="share-preview-subtitle">{share.subtitle}</p> : null}
            {share.description ? <p className="share-preview-copy">{share.description}</p> : null}
            <div className="share-preview-stats">
              <span>{share.items.length} 张卡片</span>
              <span>{new Set(share.items.map((item) => item.card.playerName)).size} 位球员或组合</span>
            </div>
          </div>
          {coverImagePath ? <img src={normalizeImagePath(coverImagePath)} alt={share.title} /> : null}
        </section>

        {share.themeNarrative || share.themeHighlights || share.groupNotes ? (
          <section className="share-preview-story">
            {share.themeNarrative ? (
              <article>
                <h2>展馆叙事</h2>
                <p>{share.themeNarrative}</p>
              </article>
            ) : null}
            {share.themeHighlights ? (
              <article>
                <h2>收藏亮点</h2>
                <p>{share.themeHighlights}</p>
              </article>
            ) : null}
            {share.groupNotes ? (
              <article>
                <h2>主题分组</h2>
                <p>{share.groupNotes}</p>
              </article>
            ) : null}
          </section>
        ) : null}

        <SharePreviewCards items={previewItems} />
      </main>
    </div>
  );
}
