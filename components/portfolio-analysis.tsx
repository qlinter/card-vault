"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PortfolioAnalysis, PortfolioSnapshot } from "@/lib/portfolio-analysis";
import { errorMessage } from "@/lib/feedback-messages";
import styles from "./portfolio-analysis.module.css";

type AnalysisResponse = { analysis?: PortfolioAnalysis; provider?: string; error?: string };

function percent(count: number, total: number) { return total > 0 ? `${Math.round(count / total * 100)}%` : "--"; }
function currency(value: number, code: string) { return `${code} ${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function date(value: string | null) { return value ? new Intl.DateTimeFormat("zh-CN").format(new Date(value)) : "暂无"; }

export function PortfolioAnalysisButton({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const fingerprint = JSON.stringify(snapshot);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setAnalysis(null); setError(null); setOpen(false); }, [fingerprint]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function analyze() {
    const id = ++requestId.current;
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/ai/portfolio-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ snapshot }) });
      const data = await response.json() as AnalysisResponse;
      if (!response.ok || !data.analysis) throw new Error(data.error ?? "AI 暂时无法完成分析，请稍后重试。");
      if (id !== requestId.current) return;
      setAnalysis(data.analysis); setProvider(data.provider ?? "统一 AI");
    } catch (requestError) {
      if (id === requestId.current) setError(errorMessage(requestError, "组合分析失败，请稍后重试。"));
    } finally { if (id === requestId.current) setLoading(false); }
  }

  function openReport() { setOpen(true); if (!analysis && !loading && snapshot.cardCount > 0) void analyze(); }
  const scorecard = analysis ? [
    ["组合结构", analysis.scorecard.structure], ["财务效率", analysis.scorecard.financialEfficiency], ["收藏品质", analysis.scorecard.collectibleQuality], ["流动性", analysis.scorecard.liquidity], ["数据完整度", analysis.scorecard.dataCompleteness]
  ] as const : [];
  const sections = analysis ? [
    ["组合结构", analysis.sections.structure], ["财务分析", analysis.sections.financials], ["收藏品质", analysis.sections.collectibleQuality], ["流动性", analysis.sections.liquidity], ["数据质量", analysis.sections.dataQuality]
  ] as const : [];
  const scope = snapshot.scope.isFiltered ? snapshot.scope.criteria.map((item) => `${item.label}=${item.value}`).join(" · ") : "全部卡片（未应用筛选）";

  return <>
    <button type="button" className={`btn btn-secondary ${styles.trigger}`} onClick={openReport} disabled={snapshot.cardCount === 0}>{snapshot.cardCount === 0 ? "暂无卡片" : loading ? "分析中…" : "组合分析"}</button>
    {mounted && open ? createPortal(<div className={styles.backdrop} onMouseDown={() => setOpen(false)} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="portfolio-analysis-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className={styles.modalHeader}><div><span className={styles.kicker}>CARD VAULT INTELLIGENCE</span><h2 id="portfolio-analysis-title">组合分析</h2><p>基于当前首页筛选结果中的 {snapshot.cardCount} 张卡片</p></div><button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="关闭组合分析">×</button></header>
        <div className={styles.snapshotStrip}><span><small>活跃收藏</small><strong>{snapshot.activeCount} 张</strong></span><span><small>已售 / 目标</small><strong>{snapshot.soldCount} / {snapshot.targetCount} 张</strong></span><span><small>估值覆盖</small><strong>{percent(snapshot.financials.valuationCoverageCount, snapshot.cardCount)}</strong></span><span><small>90 天内估值</small><strong>{snapshot.financials.freshValuationCount} 张</strong></span></div>
        <section className={styles.financialOverview} aria-label="财务摘要">{snapshot.financials.currencies.map((item) => <article key={item.currency}><header><strong>{item.currency}</strong><span>{item.valuedCardCount} 张有最新估值</span></header><dl><div><dt>最新估值</dt><dd>{currency(item.latestValue, item.currency)}</dd></div><div><dt>活跃成本基础</dt><dd>{currency(item.activeCostBasis, item.currency)}</dd></div><div><dt>可比未实现盈亏</dt><dd>{currency(item.unrealizedDifference, item.currency)}</dd></div><div><dt>可比回报率</dt><dd>{item.unrealizedReturnRate === null ? "--" : `${item.unrealizedReturnRate > 0 ? "+" : ""}${item.unrealizedReturnRate}%`}</dd></div></dl></article>)}</section>
        <div className={styles.dataFreshness}><span>最新估值日期：<strong>{date(snapshot.financials.latestValuationAt)}</strong></span><span>超过 180 天：<strong>{snapshot.financials.staleValuationCount} 张</strong></span><span>交易记录覆盖：<strong>{snapshot.financials.transactionCoverageCount}/{snapshot.cardCount}</strong></span></div><div className={styles.scope}><strong>本次分析范围</strong><span>{scope}</span></div>
        {loading ? <div className={styles.loading}><span /><strong>正在分析组合结构</strong><p>AI 正在比较结构、财务、收藏品质、流动性和数据完整度。</p></div> : null}
        {!loading && error ? <div className={styles.error}><strong>暂时无法完成分析</strong><p>{error}</p><div><button type="button" className="btn btn-primary" onClick={() => void analyze()}>重新分析</button><a className="btn btn-secondary" href="/settings">前往 AI 设置</a></div></div> : null}
        {!loading && analysis ? <div className={styles.report}><section className={styles.verdict}><div className={styles.score}><strong>{analysis.executiveSummary.overallScore}</strong><span>综合评分</span></div><div><span className={styles.positioning}>{analysis.executiveSummary.positioning}</span><p>{analysis.executiveSummary.summary}</p><small className={styles.confidence}>置信度：{analysis.executiveSummary.confidence} · 数据充分度：{analysis.executiveSummary.dataSufficiency}</small></div></section>
          <section className={styles.scorecard} aria-label="组合分析评分">{scorecard.map(([title, item]) => <article key={title} className={styles.scorecardItem}><div className={styles.scorecardHeading}><h3>{title}</h3><strong>{item.score}</strong></div><p>{item.explanation}</p><small>{item.dataSufficiency} · 证据 {item.evidence.length} 条</small></article>)}</section>
          <section className={styles.sections}>{sections.map(([title, section]) => <article key={title} className={styles.analysisSection}><header><h3>{title}</h3><span>{section.dataSufficiency}</span></header>{section.findings.length ? section.findings.map((finding) => <div key={`${title}-${finding.title}`} className={styles.finding}><div><strong>{finding.title}</strong><span>{finding.confidence}</span></div><p>{finding.content}</p>{finding.evidence.length ? <small>{finding.evidence.map((item) => `${item.label}：${item.value}`).join(" · ")}</small> : null}</div>) : <p className={styles.empty}>当前数据不足以形成具体洞察。</p>}</article>)}</section>
          {analysis.attentionItems.length ? <section className={`${styles.actions} ${styles.attention}`}><div><span>DATA ATTENTION</span><h3>优先补充事项</h3></div><ul>{analysis.attentionItems.map((item) => <li key={`${item.title}-${item.sourcePath}`}><strong>{item.title}</strong>：{item.reason}（影响 {item.affectedCount} 项）</li>)}</ul></section> : null}
          <section className={styles.actions}><div><span>NEXT ACTIONS</span><h3>整理行动建议</h3></div>{analysis.actionItems.length ? <ol>{analysis.actionItems.map((item) => <li key={`${item.priority}-${item.action}`}><strong>{item.action}</strong>：{item.reason}<small>{item.expectedBenefit}</small></li>)}</ol> : <p className={styles.empty}>暂无可执行建议。</p>}</section>
          <footer className={styles.reportFooter}><span>由 {provider} 生成，仅发送组合汇总数据，不包含图片和私人备注。</span><span>结果仅供收藏整理参考，不构成投资或交易建议。</span><button type="button" className="btn btn-secondary" onClick={() => void analyze()}>重新分析</button></footer>
        </div> : null}
      </section>
    </div>, document.body) : null}
  </>;
}
