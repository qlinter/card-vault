"use client";

import { useEffect, useRef, useState } from "react";
import { useCollectionView } from "./view-mode-toggle";
import { cardImageRotationStyle } from "@/lib/card-image-rotation";
import {
  homeCardCountStep,
  restoreHomeGridVisibleCount,
  saveHomeGridVisibleCount
} from "@/lib/home-card-grid-state";
import { useLanguage } from "@/components/language-provider";
import { formatHomeLoadMoreLabel } from "@/lib/ui-locale";

export type HomeCardGridItem = {
  id: string;
  playerName: string;
  cardTitle: string;
  details: string;
  tags: string[];
  imagePath: string | null;
  imageRotation: number;
  href: string;
};

type HomeCardGridProps = {
  cards: HomeCardGridItem[];
  historyKey: string;
  totalCount: number;
};

export function HomeCardGrid({ cards, historyKey, totalCount }: HomeCardGridProps) {
  const { locale, t } = useLanguage();
  const [view] = useCollectionView();
  const [visibleCards, setCards] = useState(cards);
  const [count, setCount] = useState(totalCount);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const nextPage = useRef(1);
  const busy = useRef(false);
  const remainingCount = Math.max(count - visibleCards.length, 0);

  useEffect(() => {
    const controller = new AbortController();
    const restored = restoreHomeGridVisibleCount(window.history.state, historyKey, totalCount);
    if (restored && restored > cards.length) {
      busy.current = true;
      setPending(true);
      void (async () => {
        try {
          let loaded = [...cards];
          for (let page = 1; page * homeCardCountStep < restored; page++) {
            const url = new URL(historyKey, window.location.origin);
            url.pathname = "/api/cards";
            url.searchParams.set("page", String(page));
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error("加载失败，请重试。");
            const data = await response.json();
            loaded = [...loaded, ...data.cards];
            if (controller.signal.aborted) return;
            nextPage.current = page + 1;
            setCount(data.totalCount);
            setCards([...new Map(loaded.map(card => [card.id, card])).values()]);
          }
        } catch { if (!controller.signal.aborted) setError("加载失败，请重试。"); }
        finally { if (!controller.signal.aborted) { busy.current = false; setPending(false); } }
      })();
    }
    return () => controller.abort();
  }, [cards, totalCount, historyKey]);

  async function showMoreCards() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const url = new URL(historyKey, window.location.origin);
      url.pathname = "/api/cards";
      url.searchParams.set("page", String(nextPage.current));
      const response = await fetch(url);
      if (!response.ok) throw new Error("加载失败，请重试。");
      const data = await response.json();
      const loaded = [...new Map([...visibleCards, ...data.cards as HomeCardGridItem[]].map(card => [card.id, card])).values()];
      setCards(loaded);
      setCount(data.cards.length ? data.totalCount : loaded.length);
      nextPage.current++;
      window.history.replaceState(
        saveHomeGridVisibleCount(window.history.state, historyKey, loaded.length),
        ""
      );
    } catch { setError("加载失败，请重试。"); }
    finally { busy.current = false; setPending(false); }
  }

  return (
    <>
      <section className={`cards-grid${view === "list" ? " is-list" : ""}`} data-testid="home-card-grid">
        {visibleCards.map((card, index) => (
          <article key={card.id} className="card-item">
            <a href={card.href}>
              {card.imagePath ? (
                <img
                  className="card-thumb"
                  src={card.imagePath}
                  alt={card.cardTitle}
                  loading={index < 6 ? "eager" : "lazy"}
                  fetchPriority={index < 6 ? "high" : "low"}
                  decoding="async"
                  style={cardImageRotationStyle(card.imageRotation)}
                />
              ) : (
                <div className="card-thumb" />
              )}
            </a>
            <div className="card-body">
              <h2 className="card-title">{card.playerName}</h2>
              <p className="card-sub">{card.cardTitle}</p>
              <p className="card-sub">{card.details || t("未补充更多信息")}</p>
              {card.tags.length > 0 ? (
                <div className="tags">
                  {card.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>
      {error ? <p role="alert" className="note-error">{t(error)}</p> : null}

      {remainingCount > 0 ? (
        <div className="home-load-more">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="home-load-more"
            onClick={showMoreCards}
            disabled={pending}
          >
            {pending ? t("加载中…") : formatHomeLoadMoreLabel(locale, remainingCount)}
          </button>
        </div>
      ) : null}
    </>
  );
}
