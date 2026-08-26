"use client";

import { useEffect, useState } from "react";
import { cardImageRotationStyle } from "@/lib/card-image-rotation";
import {
  homeCardCountStep,
  initialHomeCardCount,
  restoreHomeGridVisibleCount,
  saveHomeGridVisibleCount
} from "@/lib/home-card-grid-state";

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
};

export function HomeCardGrid({ cards, historyKey }: HomeCardGridProps) {
  const [visibleCount, setVisibleCount] = useState(initialHomeCardCount);
  const visibleCards = cards.slice(0, visibleCount);
  const remainingCount = Math.max(cards.length - visibleCards.length, 0);

  useEffect(() => {
    const restored = restoreHomeGridVisibleCount(window.history.state, historyKey, cards.length);
    if (restored !== null) setVisibleCount(restored);
  }, [cards.length, historyKey]);

  function showMoreCards() {
    setVisibleCount((currentCount) => {
      const nextCount = Math.min(currentCount + homeCardCountStep, cards.length);
      window.history.replaceState(
        saveHomeGridVisibleCount(window.history.state, historyKey, nextCount),
        ""
      );
      return nextCount;
    });
  }

  return (
    <>
      <section className="cards-grid" data-testid="home-card-grid">
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
              <p className="card-sub">{card.details}</p>
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

      {remainingCount > 0 ? (
        <div className="home-load-more">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="home-load-more"
            onClick={showMoreCards}
          >
            显示更多（剩余 {remainingCount}）
          </button>
        </div>
      ) : null}
    </>
  );
}
