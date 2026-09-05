"use client";

import Link from "next/link";
import type { DragEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { PortfolioSnapshot } from "@/lib/portfolio-analysis";
import type { PortfolioQualityCard } from "@/lib/portfolio-quality";
import type {
  PortfolioCostPosition,
  PortfolioFinancialHistoryPoint,
  PortfolioSoldReview,
  PortfolioValuationChange
} from "@/lib/portfolio-insights";
import {
  defaultPortfolioLayout,
  movePortfolioSection,
  normalizePortfolioLayout,
  reorderPortfolioSections,
  type PortfolioFullSectionId,
  type PortfolioHalfSectionId,
  type PortfolioLayout
} from "@/lib/portfolio-layout";
import { formatPercentage } from "@/lib/percentage-format";
import {
  formatPortfolioCountPercent as countPercent,
  formatPortfolioDate as shortDate,
  formatPortfolioMoney as money,
  formatSignedPortfolioMoney as signedMoney
} from "@/lib/portfolio-presentation";
import { PortfolioQualitySection } from "./portfolio-center-quality";
import { PortfolioStructureSection, PortfolioValuationSources } from "./portfolio-center-structure";
import { PortfolioActivityTrendSection, PortfolioFinancialHistorySection } from "./portfolio-center-trends";
import styles from "./portfolio-center.module.css";
import { FinancialReportNote } from "./financial-report-note";

type PortfolioCenterProps = {
  snapshot: PortfolioSnapshot;
  qualityCards: PortfolioQualityCard[];
  valuationChanges: PortfolioValuationChange[];
  financialHistory: PortfolioFinancialHistoryPoint[];
  highCostPositions: PortfolioCostPosition[];
  soldReviews: PortfolioSoldReview[];
  returnTo: string;
  asOfMonth: string;
};

const portfolioLayoutStorageKey = "card-vault:portfolio-layout:v1";

type SortablePortfolioItemProps = {
  id: PortfolioFullSectionId | PortfolioHalfSectionId;
  activeId: string | null;
  axis: "vertical" | "grid";
  order: number;
  children: ReactNode;
  onDragStart: (id: PortfolioFullSectionId | PortfolioHalfSectionId) => void;
  onDragEnd: () => void;
  onDrop: (id: PortfolioFullSectionId | PortfolioHalfSectionId, after: boolean) => void;
  onMove: (id: PortfolioFullSectionId | PortfolioHalfSectionId, direction: -1 | 1) => void;
};

function SortablePortfolioItem({ id, activeId, axis, order, children, onDragStart, onDragEnd, onDrop, onMove }: SortablePortfolioItemProps) {
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const after = axis === "vertical"
      ? event.clientY > bounds.top + bounds.height / 2
      : event.clientY > bounds.top + bounds.height * 0.7
        || (event.clientY >= bounds.top + bounds.height * 0.3 && event.clientX > bounds.left + bounds.width / 2);
    onDrop(id, after);
  }

  return (
    <div
      className={`${styles.sortableItem}${activeId === id ? ` ${styles.sortableItemDragging}` : ""}`}
      style={{ order }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
    >
      <button
        type="button"
        className={styles.portfolioDragHandle}
        draggable
        aria-label="拖拽调整栏目顺序"
        title="拖拽调整栏目顺序"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/portfolio-section", id);
          onDragStart(id);
        }}
        onDragEnd={onDragEnd}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            onMove(id, -1);
          } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            onMove(id, 1);
          }
        }}
      >⠿</button>
      {children}
    </div>
  );
}

function EmptyPortfolio({ returnTo }: { returnTo: string }) {
  return (
    <section className={`${styles.emptyPortfolio} panel`}>
      <h2>还没有可汇总的收藏</h2>
      <p>录入第一张卡片后，这里会自动生成财务摘要、结构分布和数据质量清单。</p>
      <Link className="btn btn-primary" href={`/cards/new?returnTo=${encodeURIComponent(returnTo)}`}>新增卡片</Link>
    </section>
  );
}

function ValuationChanges({ changes }: { changes: PortfolioValuationChange[] }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div><h2>估值变化</h2></div>
      </header>
      <div className={styles.valuationChangeGrid}>
        {changes.map((change) => (
          <article key={change.days}>
            <header><strong>{change.days} 天</strong><span>基准 {shortDate(change.baselineAt)}</span></header>
            {change.currencies.length > 0 ? change.currencies.map((item) => (
              <div key={item.currency}>
                <span>{item.currency}</span>
                <strong className={item.changeAmount >= 0 ? styles.positive : styles.negative}>{signedMoney(item.changeAmount, item.currency)}</strong>
                <small>
                  {item.baselineValue > 0 ? `${money(item.baselineValue, item.currency)} → ` : "基准暂无 → "}
                  {money(item.currentValue, item.currency)}
                  {item.changeRate === null ? "" : ` · ${formatPercentage(item.changeRate, { fractionDigits: 2, signed: true })}`}
                </small>
              </div>
            )) : <p className={styles.emptyText}>暂无可比较估值。</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export function PortfolioCenter({ snapshot, qualityCards, valuationChanges, financialHistory, highCostPositions, soldReviews, returnTo, asOfMonth }: PortfolioCenterProps) {
  const availableCurrencies = snapshot.financials.currencies.map((item) => item.currency);
  const [layout, setLayout] = useState<PortfolioLayout>(defaultPortfolioLayout);
  const [draggedFullSection, setDraggedFullSection] = useState<PortfolioFullSectionId | null>(null);
  const [draggedHalfSection, setDraggedHalfSection] = useState<PortfolioHalfSectionId | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(portfolioLayoutStorageKey);
      if (stored) setLayout(normalizePortfolioLayout(JSON.parse(stored)));
    } catch {
      // 无效或不可用的本地布局不应影响组合页面使用。
    }
  }, []);

  function updateLayout(updater: (current: PortfolioLayout) => PortfolioLayout) {
    setLayout((current) => {
      const next = updater(current);
      try {
        window.localStorage.setItem(portfolioLayoutStorageKey, JSON.stringify(next));
      } catch {
        // 浏览器禁用本地存储时，排序仍在当前会话内生效。
      }
      return next;
    });
  }

  function dropFullSection(targetId: PortfolioFullSectionId | PortfolioHalfSectionId, after: boolean) {
    if (!draggedFullSection) return;
    updateLayout((current) => {
      const target = targetId as PortfolioFullSectionId;
      return current.full.includes(target) ? {
        ...current,
        full: reorderPortfolioSections(current.full, draggedFullSection, target, after ? "after" : "before")
      } : current;
    });
    setDraggedFullSection(null);
  }

  function dropHalfSection(targetId: PortfolioFullSectionId | PortfolioHalfSectionId, after: boolean) {
    if (!draggedHalfSection) return;
    updateLayout((current) => {
      const target = targetId as PortfolioHalfSectionId;
      return current.half.includes(target) ? {
        ...current,
        half: reorderPortfolioSections(current.half, draggedHalfSection, target, after ? "after" : "before")
      } : current;
    });
    setDraggedHalfSection(null);
  }

  function moveFullSection(id: PortfolioFullSectionId | PortfolioHalfSectionId, direction: -1 | 1) {
    updateLayout((current) => ({
      ...current,
      full: movePortfolioSection(current.full, id as PortfolioFullSectionId, direction)
    }));
  }

  function moveHalfSection(id: PortfolioFullSectionId | PortfolioHalfSectionId, direction: -1 | 1) {
    updateLayout((current) => ({
      ...current,
      half: movePortfolioSection(current.half, id as PortfolioHalfSectionId, direction)
    }));
  }

  if (snapshot.cardCount === 0) {
    return <EmptyPortfolio returnTo={returnTo} />;
  }

  const currencies = snapshot.financials.currencies;

  return (
    <>
      <section className={styles.overviewGrid} aria-label="组合概览">
        <article><span>全部卡片</span><strong>{snapshot.cardCount}</strong><small>{snapshot.playerCount} 个卡片主体</small></article>
        <article><span>当前持有</span><strong>{snapshot.activeCount}</strong><small>已售 {snapshot.soldCount} · 目标 {snapshot.targetCount}</small></article>
        <article><span>估值覆盖</span><strong>{countPercent(snapshot.financials.valuationCoverageCount, snapshot.cardCount)}</strong><small>{snapshot.financials.valuationCoverageCount}/{snapshot.cardCount} 张</small></article>
        <article><span>最新估值</span><strong className={styles.dateValue}>{shortDate(snapshot.financials.latestValuationAt)}</strong><small>90 天内 {snapshot.financials.freshValuationCount} 张</small></article>
      </section>

      <div className={styles.sortableFullLayout}>
      <SortablePortfolioItem
        id="financial-position"
        order={layout.full.indexOf("financial-position")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <div><h2>持仓财务</h2></div>
        </header>
        <div className={styles.currencyGrid}>
          {currencies.map((item) => (
            <article key={item.currency} className={styles.currencyCard}>
              <header><strong>{item.currency}</strong><span>{item.activeValuedCardCount} 张持仓有估值</span></header>
              <div className={styles.primaryValue}><span>持仓估值</span><strong>{money(item.activeLatestValue, item.currency)}</strong></div>
              <dl>
                <div><dt>累计买入金额</dt><dd>{money(item.purchaseAmount, item.currency)}</dd></div>
                <div><dt>累计费用</dt><dd>{money(item.expenseAmount, item.currency)}</dd></div>
                <div><dt>净现金投入</dt><dd>{signedMoney(item.netCashInvested, item.currency)}</dd></div>
                <div><dt>累计出售金额</dt><dd>{money(item.salesAmount, item.currency)}</dd></div>
                <div><dt>剩余成本</dt><dd>{money(item.activeCostBasis, item.currency)}</dd></div>
                <div><dt>已实现盈亏</dt><dd className={(item.realizedProfit ?? 0) >= 0 ? styles.positive : styles.negative}>{signedMoney(item.realizedProfit, item.currency)}</dd></div>
                <div><dt>总盈亏</dt><dd className={(item.totalProfit ?? 0) >= 0 ? styles.positive : styles.negative}>{signedMoney(item.totalProfit, item.currency)}</dd></div>
                <div><dt>未实现盈亏</dt><dd className={(item.unrealizedDifference ?? 0) >= 0 ? styles.positive : styles.negative}>{signedMoney(item.unrealizedDifference, item.currency)}</dd></div>
                <div><dt>未实现回报率</dt><dd className={(item.unrealizedReturnRate ?? 0) >= 0 ? styles.positive : styles.negative}>{formatPercentage(item.unrealizedReturnRate, { fractionDigits: 2, signed: true })}</dd></div>
              </dl>
            </article>
          ))}
          {currencies.length === 0 ? <div className={styles.chartEmpty}>暂无财务记录。</div> : null}
        </div>
        <FinancialReportNote accounting={snapshot.accounting} showBasis={false} showRates={false} />
      </section>
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="financial-history"
        order={layout.full.indexOf("financial-history")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
      <PortfolioFinancialHistorySection
        points={financialHistory}
        currencies={availableCurrencies}
      />
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="valuation-change"
        order={layout.full.indexOf("valuation-change")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
        <ValuationChanges changes={valuationChanges} />
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="valuation-sources"
        order={layout.full.indexOf("valuation-sources")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
        <PortfolioValuationSources snapshot={snapshot} />
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="activity-trend"
        order={layout.full.indexOf("activity-trend")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
      <PortfolioActivityTrendSection
        snapshot={snapshot}
        currencies={availableCurrencies}
        asOfMonth={asOfMonth}
      />
      </SortablePortfolioItem>

      <SortablePortfolioItem
        id="collection-structure"
        order={layout.full.indexOf("collection-structure")}
        axis="vertical"
        activeId={draggedFullSection}
        onDragStart={(id) => setDraggedFullSection(id as PortfolioFullSectionId)}
        onDragEnd={() => setDraggedFullSection(null)}
        onDrop={dropFullSection}
        onMove={moveFullSection}
      >
      <PortfolioStructureSection snapshot={snapshot} currencies={availableCurrencies} />
      </SortablePortfolioItem>
      </div>

      <div className={styles.sortableHalfGrid}>
        <SortablePortfolioItem
          id="high-value"
          order={layout.half.indexOf("high-value")}
          axis="grid"
          activeId={draggedHalfSection}
          onDragStart={(id) => setDraggedHalfSection(id as PortfolioHalfSectionId)}
          onDragEnd={() => setDraggedHalfSection(null)}
          onDrop={dropHalfSection}
          onMove={moveHalfSection}
        >
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div><h2>高价值持仓</h2></div>
          </header>
          <div className={styles.positionList}>
            {snapshot.topPositions.filter((item) => item.latestValue > 0).slice(0, 8).map((item, index) => (
              <Link href={`/?q=${encodeURIComponent(item.cardTitle || item.playerName)}&sort=valueCnyDesc`} key={`${item.playerName}-${item.cardTitle}-${item.currency}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.playerName}</strong><small>{item.cardTitle || [item.year, item.brand, item.productLine].filter(Boolean).join(" · ")}</small></div>
                <div><strong>{money(item.latestValue, item.currency)}</strong><small>{item.valuationAgeDays > 180 ? "估值待更新" : `${item.valuationAgeDays} 天前估值`}</small></div>
              </Link>
            ))}
            {snapshot.topPositions.every((item) => item.latestValue <= 0) ? <p className={styles.emptyText}>暂无已估值持仓。</p> : null}
          </div>
        </section>
        </SortablePortfolioItem>

        <SortablePortfolioItem
          id="data-quality"
          order={layout.half.indexOf("data-quality")}
          axis="grid"
          activeId={draggedHalfSection}
          onDragStart={(id) => setDraggedHalfSection(id as PortfolioHalfSectionId)}
          onDragEnd={() => setDraggedHalfSection(null)}
          onDrop={dropHalfSection}
          onMove={moveHalfSection}
        >
        <PortfolioQualitySection snapshot={snapshot} qualityCards={qualityCards} returnTo={returnTo} />
        </SortablePortfolioItem>

        <SortablePortfolioItem
          id="high-cost"
          order={layout.half.indexOf("high-cost")}
          axis="grid"
          activeId={draggedHalfSection}
          onDragStart={(id) => setDraggedHalfSection(id as PortfolioHalfSectionId)}
          onDragEnd={() => setDraggedHalfSection(null)}
          onDrop={dropHalfSection}
          onMove={moveHalfSection}
        >
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div><h2>高成本持仓</h2></div>
          </header>
          <div className={styles.positionList}>
            {[...new Set(highCostPositions.map((item) => item.currency))].map((currency) => (
              <div className={styles.positionCurrencyGroup} key={currency}>
                {highCostPositions.filter((item) => item.currency === currency).slice(0, 8).map((item, index) => (
                  <Link href={`/cards/${item.cardId}?returnTo=${encodeURIComponent(returnTo)}`} key={`${item.cardId}-${item.currency}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div><strong>{item.playerName}</strong><small>{item.cardTitle} · {item.quantity} 张</small></div>
                    <div><strong>{money(item.remainingCost, item.currency)}</strong><small>单张均价 {money(item.averageCost, item.currency)}</small></div>
                  </Link>
                ))}
              </div>
            ))}
            {highCostPositions.length === 0 ? <p className={styles.emptyText}>暂无可核算的持仓成本。</p> : null}
          </div>
        </section>
        </SortablePortfolioItem>

        <SortablePortfolioItem
          id="sold-review"
          order={layout.half.indexOf("sold-review")}
          axis="grid"
          activeId={draggedHalfSection}
          onDragStart={(id) => setDraggedHalfSection(id as PortfolioHalfSectionId)}
          onDragEnd={() => setDraggedHalfSection(null)}
          onDrop={dropHalfSection}
          onMove={moveHalfSection}
        >
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <div><h2>已售卡片复盘</h2></div>
          </header>
          <div className={styles.positionList}>
            {[...new Set(soldReviews.map((item) => item.currency))].map((currency) => (
              <div className={styles.positionCurrencyGroup} key={currency}>
                <h3>{currency}</h3>
                {soldReviews.filter((item) => item.currency === currency).slice(0, 8).map((item) => (
                  <Link href={`/cards/${item.cardId}?returnTo=${encodeURIComponent(returnTo)}`} key={`${item.cardId}-${item.currency}`}>
                    <span>{item.soldAt ? shortDate(item.soldAt) : "待补"}</span>
                    <div><strong>{item.playerName}</strong><small>{item.cardTitle} · {item.soldQuantity} 张</small></div>
                    <div>
                      <strong className={(item.realizedProfit ?? 0) >= 0 ? styles.positive : styles.negative}>{item.needsSaleRecord ? "缺少出售记录" : signedMoney(item.realizedProfit, item.currency)}</strong>
                      <small>回报率 {formatPercentage(item.realizedReturnRate, { fractionDigits: 2, signed: true })}</small>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
            {soldReviews.length === 0 ? <p className={styles.emptyText}>暂无已售卡片。</p> : null}
          </div>
        </section>
        </SortablePortfolioItem>
      </div>
    </>
  );
}
