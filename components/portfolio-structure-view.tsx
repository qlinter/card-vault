"use client";

import Link from "next/link";
import { useState } from "react";
import { UiText, UiElement } from "./ui-text";
import { dataHref, dataGroupCount, attributeDrillQuery } from "@/lib/portfolio-navigation";
import { cardAttributeFields, type StructureField, type DataWorkspace } from "@/lib/portfolio-workspace-types";
import type { PortfolioSnapshot, PortfolioAllocation, PortfolioFilterInput } from "@/lib/portfolio-analysis";
import { formatPercentage } from "@/lib/percentage-format";
import { formatPortfolioMoney as money } from "@/lib/portfolio-presentation";
import { collectionStatusText } from "@/lib/card-domain";
import styles from "./portfolio-data.module.css";

const dimensions: [StructureField, keyof PortfolioAllocation, string][] = [
  ["playerName", "byPlayer", "卡片主体"], ["sport", "bySport", "运动"], ["team", "byTeam", "Team"],
  ["brand", "byBrand", "品牌"], ["year", "byYear", "年份"], ["productLine", "byProductLine", "产品线"],
  ["gradingCompany", "byGradingCompany", "评级机构"], ["collectionStatus", "byStatus", "收藏状态"]
];
const attributeLabels = { isRookie: "新秀卡", isAutograph: "签名卡", isPatch: "Patch", isSerialNumbered: "限量卡" };
type StructureRow = { name: string; count: number; quantity: number; value: number; valuedCount: number; soldCount: number; href: string | null; soldHref: string | null };

function StructureTable({ rows, label, currency, totalValue, continuation = false }: {
  rows: StructureRow[]; label: string; currency: string; totalValue: number; continuation?: boolean;
}) {
  const headings = [label, "档案数量", "实物数量", "持仓估值", "估值占比"];
  return <table className={`${styles.table} ${styles.structureTable}${continuation ? ` ${styles.continuationTable}` : ""}`}>
    <colgroup><col /><col /><col /><col /><col /></colgroup>
    <thead><tr>{headings.map((heading, index) => <th key={heading} scope="col" className={index ? styles.numeric : undefined}><span className={continuation ? "sr-only" : undefined}><UiText text={heading} /></span></th>)}</tr></thead>
    <tbody>{rows.map(row => {
      const share = row.valuedCount && totalValue > 0 ? row.value / totalValue * 100 : null;
      return <tr key={row.name}>
        <td>{row.href && row.count ? <Link href={row.href}><UiText text={row.name} /></Link> : <UiText text={row.name} />}<div className={styles.bar}><i style={{ width: `${share || 0}%` }} /></div></td>
        <td className={styles.numeric}><span>{row.count}</span>{row.soldCount && row.soldHref ? <Link className={styles.soldNote} href={row.soldHref}><UiText text="已售" /> {row.soldCount} <UiText text="项" /></Link> : null}</td>
        <td className={styles.numeric}>{row.quantity}</td>
        <td className={styles.numeric}>{row.valuedCount ? money(row.value, currency) : "–"}</td>
        <td className={styles.numeric}>{formatPercentage(share, { fractionDigits: 1 })}</td>
      </tr>;
    })}</tbody>
  </table>;
}

export function PortfolioStructureView({ snapshot, physical, closed, attributes, query, state }: {
  snapshot: PortfolioSnapshot; physical: DataWorkspace["physical"]; closed: DataWorkspace["closed"]; attributes: DataWorkspace["attributes"];
  query: PortfolioFilterInput; state: Record<string, string | undefined>;
}) {
  const [showAttributes, setShowAttributes] = useState(false);
  const dimension = dimensions.find(item => item[0] === state.structure) || dimensions[0];
  const currency = snapshot.accounting!.currency;
  const totalValue = snapshot.financials.currencies.find(item => item.currency === currency)?.activeLatestValue || 0;
  const detailState = { ...state, tab: "details", kind: "all", page: undefined, search: undefined, order: undefined, issue: undefined, closed: undefined, dimension: undefined, item: undefined };
  const distribution: StructureRow[] = snapshot.allocation[dimension[1]].map(item => {
    const drill = { ...detailState, dimension: dimension[0], item: item.name };
    return {
      name: dimension[0] === "collectionStatus" ? collectionStatusText(item.name) : item.name,
      count: item.count, quantity: dataGroupCount(physical, dimension[0], item.name),
      value: item.values[currency] || 0, valuedCount: item.valuedCount, soldCount: dataGroupCount(closed, dimension[0], item.name),
      href: dataHref(query, drill), soldHref: dataHref(query, drill, { closed: "1" })
    };
  }).sort((a, b) => b.value - a.value || b.count - a.count || a.name.localeCompare(b.name));
  const attributeRows: StructureRow[] = cardAttributeFields.map(field => {
    const drill = attributeDrillQuery(query, field);
    return { ...attributes[field], name: attributeLabels[field], href: drill ? dataHref(drill, detailState) : null, soldHref: drill ? dataHref(drill, detailState, { closed: "1" }) : null };
  });
  const rows = showAttributes ? attributeRows : distribution;
  const share = (value: number) => totalValue > 0 ? value / totalValue * 100 : null;
  const tableProps = { currency, totalValue, label: showAttributes ? "卡片属性" : dimension[2] };

  return <section className={styles.panel} data-testid="data-structure">
    <header className={styles.heading}>
      <h2><UiText text="收藏结构" /></h2>
      <UiElement as="div" className={styles.modeSwitch} role="group" aria-label="收藏结构显示方式" uiAttributes={["aria-label"]}>
        <button type="button" aria-pressed={!showAttributes} onClick={() => setShowAttributes(false)}><UiText text="结构分布" /></button>
        <button type="button" aria-pressed={showAttributes} onClick={() => setShowAttributes(true)}><UiText text="卡片属性" /></button>
      </UiElement>
    </header>
    {!showAttributes ? <form className={styles.form} method="get">
      {Object.entries({ ...query, ...state, page: undefined }).map(([key, value]) => value && key !== "structure" ? <input type="hidden" key={key} name={key} value={value} /> : null)}
      <UiElement as="select" uiAttributes={["aria-label"]} name="structure" aria-label="收藏结构维度" defaultValue={dimension[0]}>{dimensions.map(([value, , label]) => <option key={value} value={value}><UiText text={label} /></option>)}</UiElement>
      <button className="btn btn-secondary"><UiText text="应用" /></button>
    </form> : null}
    <div className={styles.tableWrap}>
      <StructureTable {...tableProps} rows={rows.slice(0, 5)} />
      {rows.length > 5 ? <details key={dimension[0]} className={styles.structureMore}>
        <summary><span className={styles.moreClosed}><UiText text="查看全部" /> · {rows.length} <UiText text="项" /></span><span className={styles.moreOpen}><UiText text="收起" /></span></summary>
        <StructureTable {...tableProps} rows={rows.slice(5)} continuation />
      </details> : null}
    </div>
    {!showAttributes ? <div className={`${styles.meta} ${styles.concentration}`}>
      {[1, 3, 5].map(limit => <span key={limit}>Top {limit} · {formatPercentage(share(distribution.slice(0, limit).reduce((sum, row) => sum + row.value, 0)))}</span>)}
    </div> : null}
  </section>;
}
