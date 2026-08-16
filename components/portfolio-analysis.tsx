"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { portfolioAnalysisDimensions, type PortfolioAnalysis, type PortfolioFilterInput, type PortfolioScope, type PortfolioSnapshot } from "@/lib/portfolio-analysis";
import { errorMessage } from "@/lib/feedback-messages";
import styles from "./portfolio-analysis.module.css";

type AnalysisResponse = { analysis?: PortfolioAnalysis; snapshot?: PortfolioSnapshot; provider?: string; fallback?: boolean; warning?: string; error?: string };

function percent(count: number, total: number) { return total > 0 ? `${Math.round(count / total * 100)}%` : "--"; }
function currency(value: number, code: string) { return `${code} ${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("zh-CN").format(new Date(value)) : "暂无"; }

type PortfolioAnalysisButtonProps = {
  cardCount: number;
  query: PortfolioFilterInput;
  scope: PortfolioScope;
};

export function PortfolioAnalysisButton({ cardCount, query, scope }: PortfolioAnalysisButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [provider, setProvider] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const fingerprint = JSON.stringify(query);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setAnalysis(null); setSnapshot(null); setWarning(null); setError(null); setOpen(false); }, [fingerprint]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function analyze() {
    const id = ++requestId.current;
    setLoading(true); setWarning(null); setError(null);
    try {
      const response = await fetch("/api/ai/portfolio-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      const data = await response.json() as AnalysisResponse;
      if (data.snapshot && id === requestId.current) setSnapshot(data.snapshot);
      if (!response.ok || !data.analysis || !data.snapshot) throw new Error(data.error ?? "AI 暂时无法完成分析，请稍后重试。");
      if (id !== requestId.current) return;
      setAnalysis(data.analysis); setSnapshot(data.snapshot); setProvider(data.provider ?? "统一 AI"); setWarning(data.warning ?? null);
    } catch (requestError) {
      if (id === requestId.current) setError(errorMessage(requestError, "组合分析失败，请稍后重试。"));
    } finally { if (id === requestId.current) setLoading(false); }
  }

  function openReport() { setOpen(true); if (!analysis && !loading && cardCount > 0) void analyze(); }
  const dimensions = analysis ? portfolioAnalysisDimensions.map((dimension) => ({
    ...dimension,
    score: analysis.scorecard[dimension.scorecardKey],
    detail: analysis.sections[dimension.sectionKey]
  })) : [];
  const scopeText = scope.isFiltered ? scope.criteria.map((item) => `${item.label}=${item.value}`).join(" · ") : "全部卡片（未应用筛选）";
  const displayCardCount = snapshot?.cardCount ?? cardCount;

  return <>
    <button type="button" className={`btn btn-secondary ${styles.trigger}`} onClick={openReport} disabled={cardCount === 0}>{cardCount === 0 ? "暂无卡片" : loading ? "分析中…" : "组合分析"}</button>
    {mounted && open ? createPortal(<div className={styles.backdrop} onMouseDown={() => setOpen(false)} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="portfolio-analysis-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.modalHeader}><div><span className={styles.kicker}>CARD VAULT INTELLIGENCE</span><h2 id="portfolio-analysis-title">组合分析</h2><p>基于当前首页筛选结果中的 {displayCardCount} 张卡片</p></div><button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="关闭组合分析">×</button></header>
        {snapshot ? <><div className={styles.snapshotStrip}><span><small>活跃收藏</small><strong>{snapshot.activeCount} 张</strong></span><span><small>已售 / 目标</small><strong>{snapshot.soldCount} / {snapshot.targetCount} 张</strong></span><span><small>估值覆盖</small><strong>{percent(snapshot.financials.valuationCoverageCount, snapshot.cardCount)}</strong></span><span><small>90 天内估值</small><strong>{snapshot.financials.freshValuationCount} 张</strong></span></div>
        <section className={styles.financialOverview} aria-label="财务摘要">{snapshot.financials.currencies.map((item) => <article key={item.currency}><header><strong>{item.currency}</strong><span>{item.valuedCardCount} 张有最新估值</span></header><dl><div><dt>最新估值</dt><dd>{currency(item.latestValue, item.currency)}</dd></div><div><dt>活跃成本基础</dt><dd>{currency(item.activeCostBasis, item.currency)}</dd></div><div><dt>可比未实现盈亏</dt><dd>{currency(item.unrealizedDifference, item.currency)}</dd></div><div><dt>可比回报率</dt><dd>{item.unrealizedReturnRate === null ? "--" : `${item.unrealizedReturnRate > 0 ? "+" : ""}${item.unrealizedReturnRate}%`}</dd></div></dl></article>)}</section>
        <div className={styles.dataFreshness}><span>最新估值日期：<strong>{date(snapshot.financials.latestValuationAt)}</strong></span><span>超过 180 天：<strong>{snapshot.financials.staleValuationCount} 张</strong></span><span>交易记录覆盖：<strong>{snapshot.financials.transactionCoverageCount}/{snapshot.cardCount}</strong></span></div></> : null}<div className={styles.scope}><strong>本次分析范围</strong><span>{scopeText}</span></div>
        {loading ? <div className={styles.loading}><span /><strong>正在生成五维组合概览</strong><p>AI 正在分析组合结构、财务记录、收藏特征、估值时效和档案完整度。</p></div> : null}
        {!loading && error ? <div className={styles.error}><strong>暂时无法完成分析</strong><p>{error}</p><div><button type="button" className="btn btn-primary" onClick={() => void analyze()}>重新分析</button><a className="btn btn-secondary" href="/settings">前往 AI 设置</a></div></div> : null}
        {!loading && analysis ? <div className={styles.report}>{warning ? <div className={styles.fallbackNotice} role="status"><strong>已启用稳定性兜底</strong><span>{warning}</span></div> : null}<section className={styles.verdict}><div className={styles.score}><strong>{analysis.executiveSummary.overallScore}</strong><span>综合评分</span></div><div><span className={styles.positioning}>{analysis.executiveSummary.positioning}</span><p>{analysis.executiveSummary.summary}</p><small className={styles.confidence}>置信度：{analysis.executiveSummary.confidence} · 数据充分度：{analysis.executiveSummary.dataSufficiency}</small></div></section>
          <section className={styles.dimensions} aria-label="五维组合概览"><header className={styles.dimensionsIntro}><span>FIVE-DIMENSION OVERVIEW</span><h3>五维组合概览</h3><p>每个维度合并展示评分、判断依据和关键结论，避免评分与分析重复分组。</p></header>{dimensions.map((dimension) => <article key={dimension.id} className={styles.dimension}><header className={styles.dimensionHeader}><div><h3>{dimension.label}</h3><span>{dimension.subtitle}</span></div><div className={styles.dimensionScore}><strong>{dimension.score.score}</strong><span>数据充分度：{dimension.detail.dataSufficiency}</span></div></header><p className={styles.dimensionSummary}>{dimension.score.explanation}</p>{dimension.score.evidence.length ? <div className={styles.dimensionEvidence}>{dimension.score.evidence.map((item) => <span key={`${dimension.id}-${item.sourcePath}-${item.label}`}>{item.label}：{item.value}</span>)}</div> : null}<div className={styles.dimensionFindings}>{dimension.detail.findings.map((finding) => <div key={`${dimension.id}-${finding.title}`} className={styles.finding}><div><strong>{finding.title}</strong><span>置信度：{finding.confidence}</span></div><p>{finding.content}</p>{finding.evidence.length ? <small>{finding.evidence.map((item) => `${item.label}：${item.value}`).join(" · ")}</small> : null}</div>)}</div></article>)}</section>
          {analysis.attentionItems.length ? <section className={`${styles.actions} ${styles.attention}`}><div><span>DATA GAPS</span><h3>数据待完善</h3></div><ul>{analysis.attentionItems.map((item) => <li key={`${item.title}-${item.sourcePath}`}><strong>{item.title}</strong>：{item.reason}（影响 {item.affectedCount} 项）</li>)}</ul></section> : null}
          <section className={styles.actions}><div><span>NEXT ACTIONS</span><h3>后续整理建议</h3></div>{analysis.actionItems.length ? <ol>{analysis.actionItems.map((item) => <li key={`${item.priority}-${item.action}`}><strong>{item.action}</strong>：{item.reason}<small>{item.expectedBenefit}</small></li>)}</ol> : <p className={styles.empty}>暂无可执行建议。</p>}</section>
          <footer className={styles.reportFooter}><span>由 {provider} 生成，仅发送组合汇总数据，不包含图片和私人备注。</span><span>结果仅供收藏整理参考，不构成投资或交易建议。</span><button type="button" className="btn btn-secondary" onClick={() => void analyze()}>重新分析</button></footer>
        </div> : null}
      </section>
    </div>, document.body) : null}
  </>;
}
