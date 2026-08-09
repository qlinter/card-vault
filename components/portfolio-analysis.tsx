"use client";

import { useEffect, useState } from "react";
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

function formatCurrency(value: number) {
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function coverage(count: number, total: number) {
  return total > 0 ? `${Math.round((count / total) * 100)}%` : "--";
}

export function PortfolioAnalysisButton({ snapshot }: PortfolioAnalysisProps) {
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

      setAnalysis(data.analysis);
      setProvider(data.provider || "统一 AI");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "组合分析失败，请稍后重试。");
    } finally {
      setLoading(false);
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
              <span><small>持有组合</small><strong>{snapshot.ownedCount} 张</strong></span>
              <span><small>总投入</small><strong>{formatCurrency(snapshot.financials.totalCost)}</strong></span>
              <span><small>当前估值</small><strong>{formatCurrency(snapshot.financials.totalValue)}</strong></span>
              <span><small>估值覆盖</small><strong>{coverage(snapshot.financials.valueCoverageCount, snapshot.ownedCount)}</strong></span>
            </div>

            {loading ? (
              <div className={styles.loading}>
                <span />
                <strong>正在分析组合结构</strong>
                <p>AI 正在比较集中度、价值覆盖、收藏品质和整理优先级。</p>
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
