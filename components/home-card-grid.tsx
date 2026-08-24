"use client";

import { useState } from "react";

const initialCardCount = 24;
const cardCountStep = 24;

export type HomeCardGridItem = {
  id: string;
  playerName: string;
  cardTitle: string;
  details: string;
  tags: string[];
  imagePath: string | null;
  href: string;
};

type HomeCardGridProps = {
  cards: HomeCardGridItem[];
};

export function HomeCardGrid({ cards }: HomeCardGridProps) {
  const [visibleCount, setVisibleCount] = useState(initialCardCount);
  const visibleCards = cards.slice(0, visibleCount);
  const remainingCount = Math.max(cards.length - visibleCards.length, 0);

  return (
    <>
      <section className="cards-grid">
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
            onClick={() => setVisibleCount((count) => Math.min(count + cardCountStep, cards.length))}
          >
            显示更多（剩余 {remainingCount}）
          </button>
        </div>
      ) : null}
    </>
  );
}
