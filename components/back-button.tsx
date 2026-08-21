"use client";

import type { MouseEvent } from "react";

type BackButtonProps = {
  href: string;
  className?: string;
};

export function BackButton({ href, className = "btn btn-secondary" }: BackButtonProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const opensCurrentPage =
      event.button === 0 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey;

    if (!event.defaultPrevented && opensCurrentPage && window.history.length > 1) {
      event.preventDefault();
      window.history.back();
    }
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      返回上一页
    </a>
  );
}
