export const shareGallerySegmentSize = 48;

export function siteJs(): string {
  return `(() => {
  function initGallery() {
  const cards = Array.from(document.querySelectorAll(".carousel-card"));
  const current = document.querySelector("[data-carousel-current]");
  const prev = document.querySelector("[data-carousel-prev]");
  const next = document.querySelector("[data-carousel-next]");
  const stage = document.querySelector(".card-stage");
  if (!cards.length || !stage) return;

  let activeIndex = 0;
  let touchStartX = null;

  function render() {
    cards.forEach((card, index) => {
      const offset = index - activeIndex;
      card.style.setProperty("--offset", String(offset));
      card.style.setProperty("--abs-offset", String(Math.abs(offset)));
      card.classList.toggle("active", offset === 0);
      card.setAttribute("aria-hidden", Math.abs(offset) > 2 ? "true" : "false");
    });
    if (current) current.textContent = String(activeIndex + 1);
  }

  function goTo(index) {
    activeIndex = (index + cards.length) % cards.length;
    render();
  }

  cards.forEach((card, index) => card.addEventListener("click", (event) => {
    if (index !== activeIndex) {
      event.preventDefault();
      goTo(index);
    }
  }));
  prev?.addEventListener("click", () => goTo(activeIndex - 1));
  next?.addEventListener("click", () => goTo(activeIndex + 1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") goTo(activeIndex - 1);
    if (event.key === "ArrowRight") goTo(activeIndex + 1);
  });
  stage.addEventListener("touchstart", (event) => {
    touchStartX = event.touches[0]?.clientX ?? null;
  }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) < 36) return;
    goTo(activeIndex + (delta < 0 ? 1 : -1));
  });

  render();
  }

  function initPreviewDetails() {
    const gallery = document.querySelector("[data-preview-gallery]");
    const layer = document.querySelector("[data-preview-detail-layer]");
    if (!gallery || !layer) return;

    function closeDetail() {
      layer.querySelectorAll("[data-preview-detail]").forEach((detail) => { detail.hidden = true; });
      layer.hidden = true;
      gallery.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll("[data-preview-card]").forEach((trigger) => {
      trigger.addEventListener("click", (event) => {
        const carouselCard = trigger.closest(".carousel-card");
        if (carouselCard && !carouselCard.classList.contains("active")) return;
        event.preventDefault();
        event.stopPropagation();
        const cardId = trigger.getAttribute("data-preview-card");
        const detail = cardId
          ? Array.from(layer.querySelectorAll("[data-preview-detail]")).find((entry) => entry.getAttribute("data-preview-detail") === cardId)
          : null;
        if (!detail) return;
        layer.querySelectorAll("[data-preview-detail]").forEach((entry) => { entry.hidden = entry !== detail; });
        gallery.hidden = true;
        layer.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    layer.querySelectorAll("[data-preview-back]").forEach((button) => button.addEventListener("click", closeDetail));
  }

  function initSegmentedGalleries() {
    document.querySelectorAll("[data-segmented-gallery]").forEach((gallery) => {
      const items = Array.from(gallery.querySelectorAll("[data-segment-item]"));
      const button = gallery.querySelector("[data-segment-more]");
      const status = gallery.querySelector("[data-segment-status]");
      const segmentSize = Math.max(1, Number(gallery.getAttribute("data-segment-size")) || ${shareGallerySegmentSize});
      let visibleCount = items.filter((item) => !item.hidden).length;
      if (!button) return;
      button.addEventListener("click", () => {
        const nextVisibleCount = Math.min(items.length, visibleCount + segmentSize);
        items.slice(visibleCount, nextVisibleCount).forEach((item) => { item.hidden = false; });
        visibleCount = nextVisibleCount;
        if (status) status.textContent = "已显示 " + visibleCount + " / " + items.length;
        const remaining = items.length - visibleCount;
        button.textContent = remaining > 0 ? "显示更多（剩余 " + remaining + "）" : "已显示全部卡片";
        button.hidden = remaining === 0;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { initGallery(); initPreviewDetails(); initSegmentedGalleries(); }, { once: true });
  } else {
    initGallery();
    initPreviewDetails();
    initSegmentedGalleries();
  }
})();`;
}

