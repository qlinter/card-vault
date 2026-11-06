// URL construction is shared by server renderers and browser components.
const homeThumbnailSuffix = ".home.webp";
function sourceFileName(imagePath) { return String(imagePath || "").trim().replaceAll("\\", "/").replace(/\/+$/, "").split("/").at(-1) || ""; }
function homeThumbnailFileName(imagePath) { const fileName = sourceFileName(imagePath); return fileName ? `${fileName}${homeThumbnailSuffix}` : ""; }
function homeThumbnailPublicPath(imagePath) { const fileName = homeThumbnailFileName(imagePath); return fileName ? `/thumbnails/${encodeURIComponent(fileName)}` : ""; }
module.exports = { homeThumbnailSuffix, sourceFileName, homeThumbnailFileName, homeThumbnailPublicPath };
