type IconName = "search" | "expand" | "close" | "previous" | "next" | "plus" | "minus" | "left" | "right" | "image" | "download" | "play" | "pause" | "settings";

const paths: Record<IconName, string> = {
  play: "m9 5 11 7-11 7V5Z",
  pause: "M8 5v14M16 5v14",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  expand: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  close: "M6 6l12 12M18 6 6 18", previous: "m15 5-7 7 7 7", next: "m9 5 7 7-7 7",
  plus: "M12 5v14M5 12h14", minus: "M5 12h14",
  left: "M3 10a9 9 0 1 1 2 9M3 4v6h6", right: "M21 10a9 9 0 1 0-2 9m2-15v6h-6",
  image: "M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M16 7h.01"
};

export function ShowcaseIcon({ name }: { name: IconName }) {
  return <svg className="showcase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
