function readDraftImages(json) {
  try {
    const images = JSON.parse(json).draftImages;
    if (!Array.isArray(images)) return [];
    return images.slice(0, 5).filter(image => image && typeof image.path === "string" && /^\/media\/draft-[a-z0-9-]+\.(?:jpg|png|webp)$/.test(image.path))
      .map(image => ({ path: image.path, name: typeof image.name === "string" ? image.name.slice(0, 240) : "image", rotation: [0, 90, 180, 270].includes(image.rotation) ? image.rotation : 0 }));
  } catch { return []; }
}
module.exports = { readDraftImages };
