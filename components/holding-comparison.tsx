"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { formatMinorMoneyGrouped, minorMoneyToNumber } from "@/lib/financial-history";
import type { HoldingSnapshot } from "@/lib/position-accounting";
import { useLanguage } from "./language-provider";
import { UiText } from "./ui-text";

function HoldingLines({ days, currency }: {
  days: HoldingSnapshot[]; currency: string;
}) {
  const { locale, t } = useLanguage();
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(560);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex === null ? undefined : days[activeIndex];
  const tooltipId = useId();
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
    });
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, []);

  const peak = days.reduce((max, day) => {
    const value = day.currentValueMinor ?? 0n;
    const higher = value > day.remainingCostMinor ? value : day.remainingCostMinor;
    return higher > max ? higher : max;
  }, 0n);
  const roughInterval = peak > 0n ? (peak + 3n) / 4n : 25n;
  const unit = 10n ** BigInt(roughInterval.toString().length - 1);
  const interval = [unit, 2n * unit, 5n * unit / 2n, 5n * unit, 10n * unit]
    .find(candidate => candidate >= roughInterval) ?? 10n * unit;
  const tickCount = peak > 0n ? Number((peak + interval - 1n) / interval) : 4;
  const maximum = interval * BigInt(tickCount);
  const formatTick = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 });
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const amount = interval * BigInt(index);
    return { amount, label: formatTick.format(minorMoneyToNumber(amount, currency)) };
  });
  const left = 12 + Math.max(...ticks.map(tick => tick.label.length)) * 8;
  const right = width - 8;
  const top = 12, bottom = 156;
  const start = Date.parse(days[0].day), end = Date.parse(days[days.length - 1].day);
  const x = (day: string) => start === end ? (left + right) / 2
    : left + (Date.parse(day) - start) / (end - start) * (right - left);
  const y = (amount: bigint) => bottom - Number(amount * 1000000n / maximum) / 1000000 * (bottom - top);
  // Reserve room for both endpoint labels, then label only dates that fit between them.
  let lastLabelX = left + 64;
  const axisDates = days.filter(({ day }, index) => {
    if (index === 0 || index === days.length - 1) return true;
    const px = x(day);
    if (px - lastLabelX < 72 || right - px < 105) return false;
    lastLabelX = px;
    return true;
  });
  function inspectPoint(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - bounds.left) * width / bounds.width;
    const py = event.clientY - bounds.top;
    if (px < left - 8 || px > right + 8 || py < top - 8 || py > bottom + 8) {
      setActiveIndex(null);
      return;
    }
    // Split each interval halfway between its actual record dates.
    let low = 0, high = days.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (px <= (x(days[mid].day) + x(days[mid + 1].day)) / 2) high = mid;
      else low = mid + 1;
    }
    setActiveIndex(low);
  }
  return <div className="holding-plot">
    <svg ref={chart} className="holding-lines" viewBox={`0 0 ${width} 186`} role="img" aria-label={t("持仓成本与估值")}
      tabIndex={0} aria-describedby={active ? tooltipId : undefined}
      onPointerMove={inspectPoint} onPointerDown={inspectPoint}
      onPointerLeave={event => { if (event.pointerType !== "touch") setActiveIndex(null); }}
      onPointerCancel={() => setActiveIndex(null)} onBlur={() => setActiveIndex(null)}
      onFocus={() => setActiveIndex(index => index ?? days.length - 1)}
      onKeyDown={event => {
        if (event.key === "Escape") setActiveIndex(null);
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        setActiveIndex(index => Math.max(0, Math.min(days.length - 1, (index ?? days.length - 1) + delta)));
      }}>
    {ticks.map(tick => <g key={String(tick.amount)}>
      <line className="holding-gridline" x1={left} x2={right} y1={y(tick.amount)} y2={y(tick.amount)} />
      <text x={left - 8} y={y(tick.amount) + 4} textAnchor="end">{tick.label}</text>
    </g>)}
    {active && <line className="holding-guide" x1={x(active.day)} x2={x(active.day)} y1={top} y2={bottom} />}
    {(["remainingCostMinor", "currentValueMinor"] as const).map(key => {
      const path = days.map((day, i) => {
        const amount = day[key];
        if (amount === null) return "";
        if (i === 0 || days[i - 1][key] === null) return `M${x(day.day)},${y(amount)}`;
        const previousQuantity = days[i - 1].remainingQuantity;
        if (previousQuantity > 0 && day.remainingQuantity === 0) return `L${x(day.day)},${y(amount)}`;
        const quantityChanged = day.remainingQuantity !== previousQuantity;
        return key === "remainingCostMinor" || quantityChanged
          ? `H${x(day.day)} V${y(amount)}` : `L${x(day.day)},${y(amount)}`;
      }).join(" ");
      return <g className={key === "remainingCostMinor" ? "holding-cost" : "holding-value"} key={key}>
        <path d={path} />
        {days.map((day, i) => {
          const amount = day[key];
          if (amount === null) return null;
          const endpoint = i === days.length - 1;
          const isolated = days[i - 1]?.[key] == null && days[i + 1]?.[key] == null;
          if (days.length > Math.max(4, width / 28) && !endpoint && !isolated && i !== activeIndex) return null;
          const radius = i === activeIndex ? 5 : endpoint ? 4 : 2.5;
          return <circle key={day.day} cx={x(day.day)} cy={y(amount)} r={key === "remainingCostMinor" ? radius + 1 : radius} />;
        })}
      </g>;
    })}
    {axisDates.map(({ day }, i) => <text key={day} x={x(day)} y="179"
      textAnchor={axisDates.length === 1 ? "middle" : i === 0 ? "start" : i === axisDates.length - 1 ? "end" : "middle"}>
      {day}
    </text>)}
    </svg>
    {active && <div id={tooltipId} role="tooltip" className="holding-tooltip"
      style={{ "--point-x": `${x(active.day)}px` } as React.CSSProperties} data-side={x(active.day) > width / 2 ? "left" : "right"}>
      <strong>{active.day}</strong>
      <dl>
        <div><dt>{t("剩余成本")}</dt><dd>{formatMinorMoneyGrouped(active.remainingCostMinor, currency)}</dd></div>
        <div><dt>{t("持仓估值")}</dt><dd>{active.currentValueMinor === null ? t(active.quote ? "缺少估值汇率" : "暂无估值") : formatMinorMoneyGrouped(active.currentValueMinor, currency)}</dd></div>
        <div><dt>{t("持有数量")}</dt><dd>{active.remainingQuantity}</dd></div>
      </dl>
    </div>}
  </div>;
}

export function HoldingComparison({ days, currency }: { days: HoldingSnapshot[]; currency: string }) {
  const { t } = useLanguage();
  const latest = days.at(-1);
  if (!latest) return null;
  const { remainingCostMinor: cost, currentValueMinor: value, quote } = latest;
  const money = (amount: bigint) => formatMinorMoneyGrouped(amount, currency);
  const rows = [
    { label: "剩余成本", amount: cost, style: "cost" },
    { label: "持仓估值", amount: value, style: "value" }
  ];
  return <section className="financial-chart-card holding-comparison">
    <div className="financial-chart-heading">
      <h3><UiText text="持仓成本与估值" /></h3>
      <time dateTime={latest.day}><UiText text="截至 {0}" values={[latest.day]} /></time>
    </div>
    <dl className="holding-readout">
      {rows.map(({ label, amount, style }) => <div key={style}>
        <dt className={`holding-${style}`}>{t(label)}</dt>
        <dd>{amount === null ? t(quote ? "缺少估值汇率" : "暂无估值") : money(amount)}</dd>
      </div>)}
    </dl>
    <HoldingLines days={days} currency={currency} />
  </section>;
}
