// Shared by Next's request limit, client validation and persistent uploads.
const maxImagesPerCard = 5;
const maxStoredImageBytes = 15 * 1024 * 1024;
const maxCardImageRequestBytes = maxImagesPerCard * maxStoredImageBytes + 1024 * 1024;

function cardImageSelectionError(files) {
  if (files.length > maxImagesPerCard) return `单张卡最多上传 ${maxImagesPerCard} 张图片。`;
  if (files.some(file => file.size > maxStoredImageBytes)) return "单张卡片图片不能超过 15MB。";
  if (files.reduce((total, file) => total + file.size, 0) > maxImagesPerCard * maxStoredImageBytes) return "卡片图片总大小不能超过 75MB。";
  return "";
}

module.exports = { maxImagesPerCard, maxStoredImageBytes, maxCardImageRequestBytes, cardImageSelectionError };
