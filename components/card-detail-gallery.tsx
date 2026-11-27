"use client";

import { useState } from "react";
import { useLanguage } from "./language-provider";
import { cardImageRotationStyle } from "@/lib/card-image-rotation";

export function CardDetailGallery({images,title}:{images:{id:string;path:string;rotation:number}[];title:string}) {
  const [selected,setSelected] = useState(images[0]?.id);
  const {locale} = useLanguage();
  const current = images.find(image => image.id === selected) ?? images[0];
  if (!current) return null;
  const quarterTurn = current.rotation === 90 || current.rotation === 270;
  return <div className="archive-gallery">
    <div className="archive-main-image"><div className="archive-image-frame"><img src={current.path} alt={title} className={quarterTurn ? "quarter-turn" : undefined} style={{transform:`translate(-50%, -50%) rotate(${current.rotation}deg)`}} /></div></div>
    {images.length > 1 && <div className="archive-thumbnails">{images.map((image,i) =>
      <button type="button" key={image.id} aria-pressed={image.id===current.id} aria-label={locale==="en" ? "Image "+(i+1) : "第 "+(i+1)+" 张图片"} onClick={()=>setSelected(image.id)}>
        <img src={image.path} alt="" style={cardImageRotationStyle(image.rotation)} />
      </button>)}</div>}
  </div>;
}
