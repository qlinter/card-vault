import sharp from "sharp";

type CardGrading = {
  gradingCompany: string | null;
  grade: string | null;
  certNumber: string | null;
};

export async function studioReferenceImages(path: string) {
  const reference = sharp(path);
  const { width, height } = await reference.metadata();
  const standTop = Math.ceil(height * 0.842);

  // The bundled portrait has card-free space to the left and below the holder.
  function detail(region: { left: number; top: number; width: number; height: number }) {
    return reference.clone().extract(region)
      .resize(1024, 1024, { fit: "contain", background: "#e6e1db" })
      .png().toBuffer();
  }
  const [backdrop, stand] = await Promise.all([
    detail({ left: 0, top: 0, width: Math.floor(width * 0.18), height }),
    detail({ left: 0, top: standTop, width, height: height - standTop })
  ]);
  return { backdrop, stand };
}

export function singleCardStudioEdit(card: CardGrading, front: Buffer, references: { backdrop: Buffer; stand: Buffer }, layout: "portrait" | "landscape" | undefined, oversized: boolean) {
  const graded = [card.gradingCompany, card.grade, card.certNumber].some(value => value?.trim());
  const holder = graded
    ? "Keep the original grading holder. Preserve the company, grade and certificate number as printed on its label."
    : "Use a standard clear, unlabelled magnetic one-touch holder with one round magnet on the short edge.";
  const orientation = layout === "landscape" ? "Keep the printed card horizontal."
    : layout === "portrait" ? "Keep the printed card vertical." : "Orient the card by its printed artwork.";
  const prompt = [
    "Photograph the trading card shown in image 1. Preserve its printed artwork, lettering, numbering, foil pattern and proportions.",
    orientation,
    holder,
    "Use image 2 for the studio setting: soft window light from the upper left, a pale grey wall and an ivory plinth. Let the foil and clear holder catch the same light.",
    oversized ? "Rest the oversized card directly on the plinth."
      : "Use the clear acrylic stand in image 3, with both feet visible and a soft contact shadow on the plinth.",
    "Shoot straight on in a 3:4 portrait frame. Include the entire display."
  ].join(" ");
  const images = [
    { name: "card-front.png", png: front },
    { name: "studio-background.png", png: references.backdrop }
  ];
  if (!oversized) images.push({ name: "acrylic-stand.png", png: references.stand });
  return { prompt, images };
}
