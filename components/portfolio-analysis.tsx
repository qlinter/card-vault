"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PortfolioAnalysis, PortfolioSnapshot } from "@/lib/portfolio-analysis";
import styles from "./portfolio-analysis.module.css";

type AnalysisResponse = {
  analysis?: PortfolioAnalysis;
  provider?: string;
  error?: string;
};

type PortfolioAnalysisProps = {
  snapshot: PortfolioSnapshot;
};

function formatCurrency(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function coverage(count: number, total: number) {
  return total > 0 ? `${Math.round((count / total) * 100)}%` : "--";
}

function formatReturn(value: number | null) {
  if (value === null) return "--";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string | null) {
  if (!value) return "暂无";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export function PortfolioAnalysisButton({ snapshot }: PortfolioAnalysisProps) {
  const snapshotFingerprint = JSON.stringify(snapshot);
  const requestId = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    requestId.current += 1;
    setOpen(false);
    setLoading(false);
    setAnalysis(null);
    setProvider("");
    setError(null);
  }, [snapshotFingerprint]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  async function generateAnalysis() {
    const activeRequestId = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/portfolio-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot })
      });
      const data = (await response.json()) as AnalysisResponse;
      if (!response.ok || !data.analysis) {
        throw new Error(data.error || "AI 没有返回可用的组合分析结果。");
      }

      if (activeRequestId !== requestId.current) return;
      setAnalysis(data.analysis);
      setProvider(data.provider || "统一 AI");
    } catch (requestError) {
      if (activeRequestId !== requestId.current) return;
      setError(requestError instanceof Error ? requestError.message : "组合分析失败，请稍后重试。");
    } finally {
      if (activeRequestId === requestId.current) {
        setLoading(false);
      }
    }
  }

  function handleOpen() {
    setOpen(true);
    if (!analysis && !loading && snapshot.cardCount > 0) {
      void generateAnalysis();
    }
  }

  const dimensions = analysis
    ? [
        ["组合结构", analysis.dimensions.structure],
        ["价值效率", analysis.dimensions.valueEfficiency],
        ["收藏品质", analysis.dimensions.collectibleQuality],
        ["流动性与数据", analysis.dimensions.liquidityAndData]
      ]
    : [];
  const scopeText = snapshot.scope.isFiltered
    ? snapshot.scope.criteria.map((criterion) => `${criterion.label}：${criterion.value}`).join(" · ")
    : "全部卡片（未应用筛选）";

  return (
    <>
      <button type="button" className={`btn btn-secondary ${styles.trigger}`} onClick={handleOpen} disabled={snapshot.cardCount === 0}>
        {snapshot.cardCount === 0 ? "暂无卡片" : loading ? "分析中..." : "组合分析"}
      </button>

      {mounted && open ? createPortal(
        <div className={styles.backdrop} role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="portfolio-analysis-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.modalHeader}>
              <div>
                <span className={styles.kicker}>CARD VAULT INTELLIGENCE</span>
                <h2 id="portfolio-analysis-title">组合分析</h2>
                <p>基于当前首页筛选结果中的 {snapshot.cardCount} 张卡片</p>
              </div>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="关闭组合分析">
                ×
              </button>
            </header>

            <div className={styles.snapshotStrip}>
              <span><small>活跃收藏</small><strong>{snapshot.activeCount} 张</strong></span>
              <span><small>已售 / 目标</small><strong>{snapshot.soldCount} / {snapshot.targetCount} 张</strong></span>
              <span><small>估值覆盖</small><strong>{coverage(snapshot.financials.valuationCoverageCount, snapshot.cardCount)}</strong></span>
              <span><small>90 天内估值</small><strong>{snapshot.financials.freshValuationCount} 张</strong></span>
            </div>

            <section className={styles.financialOverview} aria-label="按币种的财务历史摘要">
              {snapshot.financials.currencies.length > 0 ? snapshot.financials.currencies.map((item) => (
                <article key={item.currency}>
                  <header>
                    <strong>{item.currency}</strong>
                    <span>{item.valuedCardCount} 张有最新估值</span>
                  </header>
                  <dl>
                    <div><dt>全部最新估值</dt><dd>{formatCurrency(item.latestValue, item.currency)}</dd></div>
                    <div><dt>活跃成本基础</dt><dd>{formatCurrency(item.activeCostBasis, item.currency)}</dd></div>
                    <div><dt>可比未实现盈亏</dt><dd>{formatCurrency(item.unrealizedDifference, item.currency)}</dd></div>
                    <div><dt>可比收益率</dt><dd>{formatReturn(item.unrealizedReturnRate)}</dd></div>
                    <div><dt>净现金占用</dt><dd>{formatCurrency(item.netCashInvested, item.currency)}</dd></div>
                    <div><dt>可比卡片</dt><dd>{item.comparableCardCount} 张</dd></div>
                  </dl>
                </article>
              )) : <p>当前范围尚无可汇总的财务历史。</p>}
            </section>

            <div className={styles.dataFreshness}>
              <span>最新估值日期：<strong>{formatDate(snapshot.financials.latestValuationAt)}</strong></span>
              <span>超过 180 天：<strong>{snapshot.financials.staleValuationCount} 张</strong></span>
              <span>交易记录覆盖：<strong>{snapshot.financials.transactionCoverageCount}/{snapshot.cardCount}</strong></span>
              {snapshot.financials.valuationSources.length > 0 ? (
                <span>估值来源：<strong>{snapshot.financials.valuationSources.map((item) => `${item.name} ${item.count}`).join(" · ")}</strong></span>
              ) : null}
              {snapshot.financials.excludedComplexPositionCount > 0 ? (
                <span>复杂仓位未计收益：<strong>{snapshot.financials.excludedComplexPositionCount} 张</strong></span>
              ) : null}
            </div>

            <div className={styles.scope}>
              <strong>本次分析范围</strong>
              <span>{scopeText}</span>
            </div>

            {loading ? (
              <div className={styles.loading}>
                <span />
                <strong>正在分析组合结构</strong>
                <p>AI 正在比较组合结构、分币种财务历史、估值时效和整理优先级。</p>
              </div>
            ) : null}

            {!loading && error ? (
              <div className={styles.error}>
                <strong>暂时无法完成分析</strong>
                <p>{error}</p>
                <div>
                  <button type="button" className="btn btn-primary" onClick={() => void generateAnalysis()}>重新分析</button>
                  <a className="btn btn-secondary" href="/settings">前往 AI 设置</a>
                </div>
              </div>
            ) : null}

            {!loading && analysis ? (
              <div className={styles.report}>
                <section className={styles.verdict}>
                  <div className={styles.score}>
                    <strong>{analysis.score}</strong>
                    <span>管理成熟度</span>
                  </div>
                  <div>
                    <span className={styles.positioning}>{analysis.positioning}</span>
                    <p>{analysis.summary}</p>
                  </div>
                </section>

                <section className={styles.dimensions}>
                  {dimensions.map(([title, content]) => (
                    <article key={title}>
                      <h3>{title}</h3>
                      <p>{content}</p>
                    </article>
                  ))}
                </section>

                <section className={styles.listGrid}>
                  <article className={`${styles.list} ${styles.strengths}`}>
                    <h3>组合优势</h3>
                    <ul>{analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
                  </article>
                  <article className={`${styles.list} ${styles.risks}`}>
                    <h3>风险与盲点</h3>
                    <ul>{analysis.risks.map((item) => <li key={item}>{item}</li>)}</ul>
                  </article>
                </section>

                <section className={styles.actions}>
                  <div>
                    <span>下一步</span>
                    <h3>整理行动建议</h3>
                  </div>
                  <ol>{analysis.actions.map((item) => <li key={item}>{item}</li>)}</ol>
                </section>

                <footer className={styles.reportFooter}>
                  <span>由 {provider} 生成，仅发送组合汇总数据，不含图片和私人备注。</span>
                  <span>结果仅供收藏整理参考，不构成投资或交易建议。</span>
                  <button type="button" className="btn btn-secondary" onClick={() => void generateAnalysis()}>重新分析</button>
                </footer>
              </div>
            ) : null}
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}
