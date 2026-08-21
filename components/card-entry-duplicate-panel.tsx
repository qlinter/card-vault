"use client";

import { useEffect, useRef, useState } from "react";
import { readCardFormValues } from "@/lib/card-entry-domain";
import type { CardEntryDuplicateCandidate } from "@/lib/card-entry-duplicate-domain";

export function CardEntryDuplicatePanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const [candidates, setCandidates] = useState<CardEntryDuplicateCandidate[]>([]);

  useEffect(() => {
    const form = panelRef.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function check() {
      const values = readCardFormValues(new FormData(form ?? undefined));
      const identityCount = [
        values.year,
        values.brand,
        values.productLine,
        values.cardNumber,
        values.parallel,
        values.certNumber
      ].filter((value) => value.trim()).length;
      if (!values.playerName.trim() || identityCount < 1) {
        setCandidates([]);
        return;
      }
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch("/api/card-entry/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
          signal: controller.signal
        });
        const data = await response.json() as {
          candidates?: CardEntryDuplicateCandidate[];
        };
        if (response.ok) setCandidates(data.candidates ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setCandidates([]);
        }
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, 550);
    }
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    schedule();
    return () => {
      if (timer) clearTimeout(timer);
      controller?.abort();
      form.removeEventListener("input", schedule);
      form.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <div ref={panelRef}>
      {candidates.length > 0 ? (
        <section className="entry-duplicate-panel" aria-label="疑似重复卡">
          <strong>发现疑似重复卡</strong>
          <div className="entry-duplicate-list">
            {candidates.map((candidate) => (
              <a
                key={candidate.id}
                href={`/cards/${candidate.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  window.dispatchEvent(new CustomEvent("card-entry:navigate", {
                    detail: `/cards/${candidate.id}`
                  }));
                }}
              >
                {candidate.imageUrl ? <img src={candidate.imageUrl} alt="" /> : null}
                <span>
                  <b>{candidate.playerName} · {candidate.cardTitle}</b>
                  <small>{candidate.level === "high" ? "高度疑似" : "可能重复"}：{candidate.matches.join("、")}</small>
                </span>
              </a>
            ))}
          </div>
          <p>提示不会阻止保存，请结合多份持仓或不同评级情况判断。</p>
        </section>
      ) : null}
    </div>
  );
}
