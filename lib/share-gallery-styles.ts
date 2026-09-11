export function siteCss(): string {
  return `:root {
  color-scheme: dark;
  --bg: #08090b;
  --text: var(--gallery-text, #f5f7fb);
  --muted: var(--gallery-muted, #a8b0bd);
  --accent: var(--gallery-accent, #d7bb7a);
  --line: var(--gallery-line, rgba(255, 255, 255, 0.14));
  --panel: rgba(var(--gallery-panel-rgb, 8, 14, 24), var(--gallery-panel-alpha, 0.14));
  --panel-strong: rgba(var(--gallery-panel-rgb, 8, 14, 24), calc(var(--gallery-panel-alpha, 0.14) + 0.14));
  --gallery-content-max: 1160px;
  --gallery-page-gutter: clamp(16px, 3vw, 32px);
  --gallery-cover-safe-inline: clamp(0px, 2.2vw, 28px);
  --gallery-section-gap: clamp(18px, 2.5vw, 30px);
  --gallery-copy-measure: 68ch;
  --gallery-title-measure: 12ch;
}
* { box-sizing: border-box; }
body {
  position: relative;
  margin: 0;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  background:
    radial-gradient(circle at top left, rgba(215, 187, 122, 0.16), transparent 28rem),
    linear-gradient(145deg, #08090b 0%, #111722 55%, #06070a 100%);
  color: var(--text);
}
body.has-custom-bg::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  background: var(--share-bg-image) var(--share-bg-position-x, 50%) var(--share-bg-position-y, 50%) / cover no-repeat;
}
a { color: inherit; text-decoration: none; }
button.preview-card-link { color: inherit; font: inherit; text-align: inherit; cursor: pointer; }
img { display: block; max-width: 100%; }
.text-scale-small { font-size: 14px; }
.text-scale-standard { font-size: 16px; }
.text-scale-large { font-size: 18px; }
.shell { position: relative; z-index: 1; width: min(var(--gallery-content-max), calc(100% - (var(--gallery-page-gutter) * 2))); margin: 0 auto; padding: 32px 0 48px; }
body.has-custom-bg .back {
  display: inline-flex;
  padding: 9px 13px;
}
body.has-custom-bg .hero-copy {
  padding: clamp(20px, 3vw, 32px);
}
body.has-custom-bg .carousel-toolbar {
  width: fit-content;
  margin-inline: auto;
  padding: 9px 13px;
}
body.has-custom-bg .hero-copy h1,
body.has-custom-bg .detail-copy h1,
body.has-custom-bg .subtitle,
body.has-custom-bg .hero-copy p:not(.kicker):not(.subtitle),
body.has-custom-bg .curated-section p,
body.has-custom-bg .detail-copy p {
  color: var(--text);
  text-shadow: 0 2px 18px rgba(0,0,0,0.62);
}
.hero {
  min-height: 72vh;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.7fr);
  gap: var(--gallery-section-gap);
  align-items: center;
  padding-inline: var(--gallery-cover-safe-inline);
}
.hero-copy h1, .detail-copy h1 { max-inline-size: var(--gallery-title-measure); margin: 0; font-size: clamp(40px, 8vw, 92px); line-height: 0.96; letter-spacing: 0; overflow-wrap: anywhere; text-wrap: balance; }
.kicker { color: var(--accent); text-transform: uppercase; font-size: 12px; letter-spacing: 0; font-weight: 800; }
.subtitle { color: var(--muted); font-size: clamp(18px, 2.2vw, 26px); line-height: 1.45; }
.hero-copy p:not(.kicker):not(.subtitle), .curated-section p, .detail-copy p { max-inline-size: var(--gallery-copy-measure); color: var(--muted); line-height: 1.85; }
.hero-cover, .curated-section, .detail-images, .detail-copy {
  border: 1px solid var(--line);
  background: var(--panel);
  backdrop-filter: blur(18px);
}
.hero-cover { padding: 14px; }
.hero-cover img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
.stats, .groups { display: flex; flex-wrap: wrap; gap: 10px; }
.stats span, .chip {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  color: var(--text);
  padding: 8px 12px;
  font-size: 13px;
}
.curated-sections { display: grid; gap: var(--gallery-section-gap); margin: 0 0 var(--gallery-section-gap); }
.curated-section {
  position: relative;
  display: grid;
  grid-template-columns: 52px minmax(220px, 0.75fr) minmax(0, 1.25fr);
  gap: 22px;
  align-items: start;
  padding: clamp(20px, 3vw, 34px);
  overflow: hidden;
}
.curated-section h2 { margin: 0 0 12px; font-size: clamp(24px, 4vw, 42px); line-height: 1.08; }
.section-number { color: var(--accent); font-size: 13px; font-weight: 900; border-top: 2px solid currentColor; padding-top: 8px; }
.section-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.section-card { min-width: 0; padding: 0; border-radius: 12px; overflow: hidden; background: var(--panel-strong); border: 1px solid var(--line); }
.section-card img, .section-card .placeholder { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; }
.section-card span { display: grid; gap: 2px; padding: 10px; }
.section-card strong, .section-card small { overflow-wrap: anywhere; }
.section-card small { color: var(--muted); }
.featured-badge { position: absolute; z-index: 2; inset: 10px auto auto 10px; display: inline-flex !important; width: auto; padding: 6px 9px !important; border-radius: 999px; color: #111820; background: var(--accent); font-size: 11px; font-weight: 900; box-shadow: 0 6px 18px rgba(0,0,0,0.25); }
.section-card, .featured-story { position: relative; }
.featured-stories { display: grid; gap: 16px; margin: 0 0 var(--gallery-section-gap); padding: clamp(20px, 3vw, 34px); border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(18px); }
.featured-stories-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; }
.featured-stories-head h2 { margin: 3px 0 0; font-size: clamp(26px, 4vw, 42px); }
.featured-stories-head > span { color: var(--accent); font-weight: 900; }
.featured-story-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.featured-story { display: grid; grid-template-columns: minmax(92px, 0.32fr) minmax(0, 1fr); gap: 14px; align-items: stretch; min-width: 0; padding: 0; overflow: hidden; border: 1px solid var(--line); background: var(--panel-strong); }
.featured-story > img, .featured-story > .placeholder { width: 100%; height: 100%; min-height: 170px; aspect-ratio: 3 / 4; object-fit: cover; }
.featured-story > span { display: grid; align-content: center; gap: 5px; padding: 14px 16px 14px 0; }
.featured-story strong { font-size: 18px; overflow-wrap: anywhere; }
.featured-story small, .featured-story p { color: var(--muted); }
.featured-story p { margin: 4px 0 0; line-height: 1.55; }
.section-editorial { grid-template-columns: 52px minmax(0, 1fr); }
.section-editorial .section-cards { grid-column: 2; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.section-rail .section-cards { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }
.section-rail .section-card { flex: 0 0 min(190px, 48vw); scroll-snap-align: start; }
.section-grid .section-cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.collection-browser { display: grid; gap: 18px; margin-top: var(--gallery-section-gap); padding-top: var(--gallery-section-gap); border-top: 1px solid var(--line); }
.collection-browser-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.collection-browser-head h2 { margin: 4px 0 0; font-size: clamp(26px, 4vw, 42px); }
.collection-browser-head > span { color: var(--muted); font-size: 13px; }
.collection-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
.collection-card-grid > [data-segment-item] { min-width: 0; }
.collection-card-grid .section-card { display: block; height: 100%; }
.segment-more { justify-self: center; min-width: 220px; padding: 12px 18px; border: 1px solid var(--line); border-radius: 999px; color: var(--text); background: var(--panel-strong); font: inherit; font-weight: 800; cursor: pointer; }
.collection-page { display: grid; gap: var(--gallery-section-gap); }
.collection-page-head { max-width: 820px; padding: clamp(22px, 4vw, 42px); border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(18px); }
.collection-page-head h1 { max-inline-size: var(--gallery-title-measure); margin: 4px 0 14px; font-size: clamp(38px, 7vw, 78px); line-height: 0.98; overflow-wrap: anywhere; text-wrap: balance; }
.collection-page-head > span { color: var(--accent); font-size: 13px; font-weight: 900; }
.groups { margin-bottom: 24px; }
.carousel { margin-top: 20px; }
.carousel-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 18px;
}
.carousel-toolbar button {
  border: 1px solid var(--line);
  background: var(--panel-strong);
  color: var(--text);
  width: 42px;
  height: 42px;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  padding: 0;
  font: inherit;
  line-height: 1;
  cursor: pointer;
}
.carousel-toolbar button svg {
  display: block;
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.card-stage {
  position: relative;
  min-height: 460px;
  perspective: 1500px;
  overflow: hidden;
  touch-action: pan-y;
}
.carousel-card {
  position: absolute;
  top: 0;
  left: 50%;
  width: min(330px, 76vw);
  padding: 0;
  border: 0;
  --card-radius: 24px;
  border-radius: var(--card-radius);
  overflow: hidden;
  clip-path: inset(0 round var(--card-radius));
  contain: paint;
  isolation: isolate;
  background: transparent;
  background-clip: padding-box;
  box-shadow: 0 24px 60px rgba(0,0,0,0.24);
  transform:
    translateX(calc(-50% + (var(--offset) * 250px)))
    rotateY(calc(var(--offset) * -14deg))
    scale(calc(1 - (var(--abs-offset) * 0.08)));
  opacity: calc(1 - (var(--abs-offset) * 0.24));
  z-index: calc(10 - var(--abs-offset));
  transition: transform 220ms ease, opacity 220ms ease;
}
.carousel-card[aria-hidden="true"] { pointer-events: none; opacity: 0; }
.card-image { display: block; width: 100%; padding: 0; border: 0; background: transparent; }
.card-image img, .placeholder { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; background: rgba(255,255,255,0.06); }
.typography-modern .hero-copy h1,
.typography-modern .detail-copy h1,
.typography-modern .curated-section h2,
.typography-modern .featured-stories h2,
.typography-modern .collection-browser h2 { font-family: "Arial Narrow", "Segoe UI", "Microsoft YaHei", sans-serif; font-weight: 900; }
.typography-editorial .hero-copy h1,
.typography-editorial .detail-copy h1,
.typography-editorial .curated-section h2,
.typography-editorial .featured-stories h2,
.typography-editorial .collection-browser h2 { font-family: Georgia, "Times New Roman", "Microsoft YaHei", serif; font-weight: 700; letter-spacing: -0.025em; }
.text-scale-small .hero-copy h1, .text-scale-small .detail-copy h1 { font-size: clamp(34px, 6.5vw, 72px); }
.text-scale-large .hero-copy h1, .text-scale-large .detail-copy h1 { font-size: clamp(48px, 9vw, 106px); }
.text-scale-small .subtitle { font-size: clamp(15px, 1.8vw, 20px); }
.text-scale-large .subtitle { font-size: clamp(21px, 2.7vw, 31px); }
.density-compact { --gallery-section-gap: clamp(12px, 1.5vw, 18px); }
.density-compact .shell { width: min(1240px, calc(100% - (var(--gallery-page-gutter) * 2))); padding-top: 16px; padding-bottom: 24px; }
.density-compact .hero { min-height: 48vh; gap: 14px; }
.density-compact .curated-sections { gap: 10px; }
.density-compact .curated-section { gap: 12px; padding: clamp(12px, 1.6vw, 18px); }
.density-compact .section-cards { gap: 8px; }
.density-compact .card-stage { min-height: 380px; }
.density-compact .collection-card-grid { grid-template-columns: repeat(auto-fill, minmax(126px, 1fr)); gap: 9px; }
.density-comfortable .hero { min-height: 72vh; }
.image-fit-contain .card-image img,
.image-fit-contain .section-card img,
.image-fit-contain .hero-cover img { padding: 10px; object-fit: contain; background: var(--panel-strong); }
.carousel-card .card-image img,
.carousel-card .placeholder {
  display: block;
  border-radius: 24px;
  box-shadow: none;
}
.detail-shell { padding-top: 20px; }
.back { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-bottom: 18px; color: var(--accent); font-weight: 700; }
.detail { display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(320px, 0.8fr); gap: 24px; align-items: start; }
.detail-images { padding: 14px; display: grid; gap: 14px; }
.detail-images img { width: 100%; max-height: 78vh; object-fit: contain; background: #050608; }
.detail-copy { padding: 24px; position: sticky; top: 16px; }
.meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 20px; }
.meta div { border-top: 1px solid var(--line); padding-top: 10px; }
.meta strong { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
.meta span { overflow-wrap: anywhere; }
.large { min-height: 420px; }
.preview-detail-layer { position: relative; z-index: 2; width: min(1160px, calc(100% - 32px)); margin: 0 auto; padding: 20px 0 48px; }
.preview-detail-back { margin-bottom: 18px; padding: 9px 13px; border: 1px solid var(--line); border-radius: 999px; color: var(--accent); background: var(--panel-strong); font: inherit; font-weight: 800; cursor: pointer; }
.archive-catalog { display: grid; grid-template-columns: minmax(190px, 0.3fr) minmax(0, 1fr); gap: 28px; align-items: start; }
.archive-catalog > aside { position: sticky; top: 20px; padding: 22px; border: 1px solid var(--line); background: var(--panel); backdrop-filter: blur(14px); }
.archive-catalog > aside .groups { display: grid; margin: 0; }
.layout-archive .shell { width: min(1320px, calc(100% - 32px)); }
.layout-archive .hero { min-height: 54vh; grid-template-columns: minmax(0, 1.4fr) minmax(240px, 0.45fr); border-bottom: 1px solid var(--line); margin-bottom: 30px; }
.layout-archive .hero-copy h1 { max-width: 13ch; font-family: Georgia, "Times New Roman", "Microsoft YaHei", serif; font-size: clamp(46px, 7vw, 88px); }
.layout-archive.typography-modern .hero-copy h1 { font-family: "Arial Narrow", "Segoe UI", "Microsoft YaHei", sans-serif; }
.layout-archive.text-scale-small .hero-copy h1 { font-size: clamp(34px, 5vw, 64px); }
.layout-archive.text-scale-large .hero-copy h1 { font-size: clamp(56px, 9vw, 112px); }
.layout-archive.density-compact .hero { min-height: 42vh; }
.layout-archive.density-comfortable .hero { min-height: 66vh; }
.layout-archive .curated-section { grid-template-columns: 64px minmax(0, 0.72fr) minmax(0, 1.28fr); border-radius: 0; border-width: 0 0 1px; background: transparent; backdrop-filter: none; }
.layout-archive .section-number { font-family: Georgia, "Times New Roman", serif; font-size: 20px; }
.layout-archive .carousel { border-top: 1px solid var(--line); padding-top: 28px; }
.arena-board { display: grid; grid-template-columns: 150px 150px minmax(0, 1fr); gap: 12px; align-items: stretch; margin: -40px 0 34px; position: relative; z-index: 2; }
.arena-board > div { display: grid; align-content: center; padding: 18px; border: 1px solid var(--line); background: var(--panel-strong); backdrop-filter: blur(14px); }
.arena-board strong { color: var(--accent); font-size: 34px; line-height: 1; }
.arena-board span { color: var(--muted); font-size: 11px; font-weight: 800; }
.arena-board .groups { display: flex; margin: 0; }
.layout-arena .hero { min-height: 76vh; grid-template-columns: minmax(0, 0.92fr) minmax(320px, 0.72fr); }
.layout-arena.density-compact .hero { min-height: 54vh; }
.layout-arena.density-comfortable .hero { min-height: 80vh; }
.layout-arena .hero-copy { border-left: 5px solid var(--accent); }
.layout-arena .hero-cover { transform: perspective(1100px) rotateY(-8deg); box-shadow: 28px 30px 70px rgba(0,0,0,0.28); }
.layout-arena .card-stage { min-height: 520px; }
.layout-arena .curated-section { border-left: 4px solid var(--accent); }
body.theme-archive {
  color-scheme: light;
  --bg: #f4f0e8;
  --line: rgba(36, 57, 88, 0.18);
  --text: #1b2d49;
  --muted: #52627a;
  --accent: #a36f24;
  background:
    radial-gradient(circle at top left, rgba(163, 111, 36, 0.14), transparent 28rem),
    linear-gradient(145deg, #f7f4ee 0%, #e6edf4 56%, #f7f4ee 100%);
}
body.theme-archive .hero-cover,
body.theme-archive .curated-section,
body.theme-archive .detail-images,
body.theme-archive .detail-copy {
  background: var(--panel);
  border-color: var(--line);
}
body.theme-archive .card-image img,
body.theme-archive .placeholder,
body.theme-archive .detail-images img { background: #e6ebf0; }
body.theme-football {
  color: #f5fbf4;
  --accent: #cde83d;
  --muted: #b9d8c5;
  background:
    linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px) 0 0 / 25% 100%,
    linear-gradient(145deg, #08271e 0%, #0d5f40 55%, #062118 100%);
}
body.theme-football .hero { border-left: 6px solid #cde83d; padding-left: 20px; }
body.theme-football .curated-section,
body.theme-football .hero-cover,
body.theme-football .detail-images,
body.theme-football .detail-copy { border-color: rgba(205,232,61,0.34); background: var(--panel); }
body.theme-basketball {
  color: #fff8ee;
  --accent: #ffc46d;
  --muted: #ead0b5;
  background: radial-gradient(circle at 78% 18%, rgba(255,195,109,0.22), transparent 13rem), linear-gradient(145deg, #552516 0%, #b95c2a 50%, #102c4d 100%);
}
body.theme-basketball .curated-section,
body.theme-basketball .hero-cover,
body.theme-basketball .detail-images,
body.theme-basketball .detail-copy { border-color: rgba(255,196,109,0.38); background: var(--panel); }
body.theme-tennis {
  color: #f4fbff;
  --accent: #d8ef44;
  --muted: #b9d8e7;
  background: linear-gradient(135deg, transparent 0 46%, rgba(216,239,68,0.18) 47% 52%, transparent 53%), linear-gradient(145deg, #071d31 0%, #0e5c8d 56%, #06243e 100%);
}
body.theme-tennis .hero { transform: skewY(-1deg); }
body.theme-tennis .curated-section,
body.theme-tennis .hero-cover,
body.theme-tennis .detail-images,
body.theme-tennis .detail-copy { border-color: rgba(216,239,68,0.36); background: var(--panel); }
body.theme-f1 {
  color: #f7f8fa;
  --accent: #f0524e;
  --muted: #b9bec8;
  background: repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 18px), linear-gradient(145deg, #090a0d 0%, #252931 60%, #120f13 100%);
}
body.theme-f1 .hero-copy h1 { text-transform: uppercase; letter-spacing: 0; }
body.theme-f1 .curated-section,
body.theme-f1 .hero-cover,
body.theme-f1 .detail-images,
body.theme-f1 .detail-copy { border-color: rgba(240,82,78,0.4); background: var(--panel); }
body.theme-nerazzurri {
  color: #10233c;
  --accent: #004e9a;
  --muted: #3f5875;
  --line: rgba(0,78,154,0.22);
  background: radial-gradient(circle at 72% 18%, rgba(0,83,167,0.14), transparent 16rem), linear-gradient(145deg, #f7fbff 0%, #dceafa 56%, #f8fbff 100%);
}
body.theme-nerazzurri .hero { border-left: 6px solid #0067d8; padding-left: 20px; }
body.theme-nerazzurri .hero-copy h1 { color: #07182e; text-shadow: 0 0 28px rgba(255,255,255,0.72); }
body.theme-nerazzurri .curated-section,
body.theme-nerazzurri .hero-cover,
body.theme-nerazzurri .detail-images,
body.theme-nerazzurri .detail-copy { border-color: rgba(0,78,154,0.22); background: var(--panel); }
body.theme-nerazzurri-2 {
  color: #f2f7ff;
  --accent: #d9ad54;
  --muted: #b9c8dc;
  background: repeating-linear-gradient(90deg, rgba(0,85,170,0.22) 0 7rem, rgba(3,11,24,0.22) 7rem 14rem), radial-gradient(circle at 72% 18%, rgba(218,170,76,0.22), transparent 16rem), linear-gradient(145deg, #020916 0%, #043b82 45%, #01050d 100%);
}
body.theme-nerazzurri-2 .hero { border-left: 6px solid #0067d8; padding-left: 20px; }
body.theme-nerazzurri-2 .hero-copy h1 { text-shadow: 0 0 28px rgba(0,103,216,0.46); }
body.theme-nerazzurri-2 .curated-section,
body.theme-nerazzurri-2 .hero-cover,
body.theme-nerazzurri-2 .detail-images,
body.theme-nerazzurri-2 .detail-copy { border-color: rgba(217,173,84,0.36); background: var(--panel); }
body.has-custom-bg .back,
body.has-custom-bg .hero-copy,
body.has-custom-bg .carousel-toolbar,
body.has-custom-bg .curated-section,
body.has-custom-bg .detail-copy {
  border: 1px solid rgba(255,255,255,0.24);
  border-radius: 24px;
  background: var(--panel);
  box-shadow: 0 14px 38px rgba(0,0,0,0.14), inset 0 0 0 1px rgba(255,255,255,0.05);
  backdrop-filter: blur(10px) saturate(125%);
}
body.has-custom-bg .stats span,
body.has-custom-bg .chip {
  border-color: rgba(255,255,255,0.22);
  background: var(--panel-strong);
  backdrop-filter: blur(8px) saturate(125%);
}
.template-collector-spotlight .hero-cover { border-radius: 26px; transform: perspective(1200px) rotateY(-5deg); box-shadow: 28px 30px 70px rgba(0,0,0,0.3); }
.template-collector-spotlight .curated-section { border-radius: 22px; }
.template-archive-journal .hero { border-bottom: 1px solid var(--line); }
.template-archive-journal .hero-cover,
.template-archive-journal .curated-section { border-radius: 2px; }
.template-arena-lineup .arena-board > div { box-shadow: inset 0 3px 0 var(--accent); }
.template-arena-lineup .curated-section { border-radius: 0 18px 18px 0; }
/* v1.3: display the whole collectible, including slab edges and serial numbers. */
.hero-cover img, .section-card img, .card-image img, .featured-story img, .collection-card img { object-fit: contain; padding: clamp(8px, 1.2vw, 18px); }
.image-fit-cover .card-image img, .image-fit-cover .section-card img, .image-fit-cover .hero-cover img { object-fit: cover; padding: 0; }
.hero-cover { padding: 18px; box-shadow: 0 24px 70px rgba(0,0,0,.2); }
.layout-archive .hero { grid-template-columns: minmax(0, 1.05fr) minmax(280px, .85fr); }
.layout-archive .hero-copy h1 { font-size: clamp(36px, 6vw, 76px); }
body.has-custom-bg .hero-copy, body.has-custom-bg .curated-section, body.has-custom-bg .detail-copy, body.has-custom-bg .archive-catalog > aside {
  background: linear-gradient(var(--panel), var(--panel)), color-mix(in srgb, var(--bg) 78%, transparent);
}
body.has-custom-bg .hero-copy h1, body.has-custom-bg .detail-copy h1, body.has-custom-bg .subtitle, body.has-custom-bg .hero-copy p:not(.kicker):not(.subtitle), body.has-custom-bg .curated-section p, body.has-custom-bg .detail-copy p { text-shadow: none; }
.hero-cover img { max-height: 72vh; background: color-mix(in srgb, var(--panel-strong) 80%, transparent); }
.hero-copy h1 { line-height: 1.06; }
.hero-copy { padding-block: 32px; }
.kicker { letter-spacing: .12em; }
.gallery-enter { display: inline-flex; gap: 32px; align-items: center; border-bottom: 1px solid var(--accent); padding: 14px 0 10px; margin-top: 18px; font-size: 14px; font-weight: 700; color: var(--accent); }
.gallery-enter span { font-size: 24px; }
a:focus-visible, button:focus-visible { outline: 3px solid var(--accent); outline-offset: 5px; }
#collection { scroll-margin-top: 24px; }
.section-card { transition: transform .2s ease, box-shadow .2s ease; }
.section-card:hover { transform: translateY(-4px); box-shadow: 0 14px 28px rgba(0,0,0,.16); }
.curated-section p { line-height: 1.8; }
@media (max-width: 1024px) and (min-width: 821px) {
  :root {
    --gallery-content-max: 900px;
    --gallery-page-gutter: 24px;
    --gallery-cover-safe-inline: 18px;
    --gallery-section-gap: 20px;
  }
  .hero,
  .layout-archive .hero,
  .layout-arena .hero { grid-template-columns: minmax(0, 1fr) minmax(250px, 0.72fr); min-height: 64vh; }
  .hero-copy h1, .detail-copy h1 { font-size: clamp(42px, 7vw, 72px); }
  .curated-section { grid-template-columns: 44px minmax(180px, 0.8fr) minmax(0, 1.2fr); gap: 16px; }
  .section-cards, .section-grid .section-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .arena-board { grid-template-columns: 120px 120px minmax(0, 1fr); }
}
@media (max-width: 820px) {
  :root {
    --gallery-content-max: 680px;
    --gallery-page-gutter: 11px;
    --gallery-cover-safe-inline: 0px;
    --gallery-section-gap: 16px;
    --gallery-title-measure: 100%;
  }
  .shell { padding-top: 20px; }
  .hero-cover { max-width: 460px; width: 100%; margin-inline: auto; padding: 12px; }
  .hero-cover img { max-height: 62vh; }
  .hero-copy { padding-block: 16px; }
  .gallery-enter { min-height: 44px; margin-top: 8px; }
  .hero,
  .layout-arena .hero,
  .layout-archive .hero,
  .detail { grid-template-columns: minmax(0, 1fr); min-height: auto; }
  .archive-catalog { grid-template-columns: 1fr; }
  .archive-catalog > aside { position: static; }
  .arena-board { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 0; }
  .arena-board .groups { grid-column: 1 / -1; }
  .curated-section,
  .layout-archive .curated-section { grid-template-columns: 42px minmax(0, 1fr); gap: 14px; }
  .curated-section .section-cards { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .featured-story-grid { grid-template-columns: 1fr; }
  .collection-browser-head { align-items: start; flex-direction: column; }
  .collection-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .section-rail .section-cards { display: flex; }
  .layout-arena .hero-cover { transform: none; }
  .template-collector-spotlight .hero-cover { transform: none; }
  .layout-arena .hero-copy { border-left-width: 3px; padding-left: 16px; }
  .hero-copy h1, .detail-copy h1 { font-size: clamp(34px, 14vw, 58px); }
  .detail-copy { position: static; }
  .meta { grid-template-columns: 1fr; }
  .card-stage { min-height: 420px; }
  .carousel-card {
    width: min(300px, 78vw);
    transform:
      translateX(calc(-50% + (var(--offset) * 170px)))
      rotateY(calc(var(--offset) * -10deg))
      scale(calc(1 - (var(--abs-offset) * 0.09)));
  }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}`;
}

