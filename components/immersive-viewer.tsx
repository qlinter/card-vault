"use client";

import { useState } from "react";
import { useLanguage } from "./language-provider";
import { ShowcaseIcon } from "./showcase-icon";
import { ImmersiveGallery } from "./immersive-gallery";
import type { GallerySource as Source } from "@/lib/immersive-presentation";

export function StartImmersive({ source, label = "浏览", disabled = false, appearance = "default" }: { source: Source; label?: string; disabled?: boolean; appearance?: "default" | "showcase" }) {
  const [open, setOpen] = useState(false), { t } = useLanguage();
  return <><button type="button" className={appearance === "showcase" ? "showcase-action" : "btn"} disabled={disabled} onClick={() => setOpen(true)}>{appearance === "showcase" ? <ShowcaseIcon name="image" /> : null}{t(label)}</button>{open ? <ImmersiveGallery source={source} onClose={() => setOpen(false)} /> : null}</>;
}

