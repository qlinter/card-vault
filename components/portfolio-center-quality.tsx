import { UiText, UiElement } from "@/components/ui-text";
import Link from "next/link";
import type { PortfolioSnapshot } from "@/lib/portfolio-analysis";
import { portfolioQualityMetrics, type PortfolioQualityCard } from "@/lib/portfolio-quality";
import styles from "./portfolio-center.module.css";

export function PortfolioQualitySection({ snapshot, qualityCards, returnTo }: {
  snapshot: PortfolioSnapshot;
  qualityCards: PortfolioQualityCard[];
  returnTo: string;
}) {
  const issueCounts = new Map(snapshot.attentionItems.map((item) => [item.type, item.count]));
  return <section className={styles.section}>
    <header className={styles.sectionHeader}><div><h2><UiText text={"数据待完善"} /></h2></div></header>
    <div className={styles.qualitySummary}>
      {portfolioQualityMetrics.map((metric) => <UiElement as="button" uiMessages={{"aria-label": {text:"{0}：{1}",values:[metric.label,metric.definition],translateValues:[0,1]}}} type="button" className={styles.qualityMetric} key={metric.type} >
        <strong>{issueCounts.get(metric.type) ?? 0}</strong><UiText text={metric.label} /><small className={styles.qualityDefinition} role="tooltip"><UiText text={metric.definition} /></small>
      </UiElement>)}
    </div>
    <div className={styles.qualityList}>
      {qualityCards.slice(0, 8).map((card) => <Link key={card.id} href={`/cards/${card.id}?returnTo=${encodeURIComponent(returnTo)}`}>
        <div><strong>{card.playerName}</strong><small>{card.cardTitle}</small></div><span><UiText text={card.issues.join(" · ")} /></span>
      </Link>)}
      {qualityCards.length === 0 ? <p className={styles.qualityComplete}><UiText text={"当前卡片没有待处理的数据质量问题。"} /></p> : null}
    </div>
  </section>;
}
