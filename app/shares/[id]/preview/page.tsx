import Link from "next/link";
import { ShowcaseGallery } from "@/components/showcase-gallery";
import { normalizeImagePath } from "@/lib/image-path";
import { prisma } from "@/lib/prisma";
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

  const coverItem =
    share.items.find((item) => item.card.images.some((image) => image.path === share.coverImagePath)) ??
    share.items.find((item) => item.card.images.length > 0);
  const coverImage = coverItem?.card.images.find((image) => image.path === share.coverImagePath) ?? coverItem?.card.images[0];

  return (
    <div className="share-preview-page">
      <main className="share-preview-shell">
        <nav className="share-preview-nav">
          <Link href={`/shares/${share.id}/edit`}>编辑</Link>
          <Link href={`/shares/${share.id}/export`}>导出</Link>
        </nav>

        <section className="share-preview-hero">
          <div>
            <p className="showcase-kicker">Card Vault Share</p>
            <h1>{share.title}</h1>
            {share.subtitle ? <p className="share-preview-subtitle">{share.subtitle}</p> : null}
            {share.description ? <p className="share-preview-copy">{share.description}</p> : null}
            <div className="share-preview-stats">
              <span>{share.items.length} 张卡片</span>
              <span>{new Set(share.items.map((item) => item.card.playerName)).size} 位球员或组合</span>
            </div>
          </div>
          {coverImage ? <img src={normalizeImagePath(coverImage.path)} alt={coverItem?.card.cardTitle ?? share.title} /> : null}
        </section>

        {share.themeNarrative || share.themeHighlights || share.groupNotes ? (
          <section className="share-preview-story">
            {share.themeNarrative ? <article><h2>展馆叙事</h2><p>{share.themeNarrative}</p></article> : null}
            {share.themeHighlights ? <article><h2>收藏亮点</h2><p>{share.themeHighlights}</p></article> : null}
            {share.groupNotes ? <article><h2>主题分组</h2><p>{share.groupNotes}</p></article> : null}
          </section>
        ) : null}

        <section className="share-preview-grid">
          {share.items.map((item) => (
            <article className="share-preview-card" key={item.id}>
              {item.card.images[0] ? (
                <img src={normalizeImagePath(item.card.images[0].path)} alt={item.card.cardTitle} />
              ) : (
                <div className="share-card-placeholder" />
              )}
              <div>
                <h2>{item.card.playerName}</h2>
                <p>{item.displayTitle || item.card.cardTitle}</p>
                <p className="muted">{[item.card.year, item.card.brand, item.card.productLine, item.card.grade].filter(Boolean).join(" / ")}</p>
              </div>
            </article>
          ))}
        </section>

        {share.items[0] ? (
          <section className="share-preview-detail">
            <div className="panel">
              <ShowcaseGallery cardTitle={share.items[0].card.cardTitle} images={share.items[0].card.images} />
            </div>
            <div className="panel">
              <h2>{share.items[0].card.playerName}</h2>
              <p className="share-preview-subtitle">{share.items[0].displayTitle || share.items[0].card.cardTitle}</p>
              <p className="share-preview-copy">{share.items[0].displayDescription || share.items[0].card.publicDescription}</p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
