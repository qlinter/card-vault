function normalizeExternalHttpUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function isSameOriginUrl(rawUrl, baseUrl) {
  try {
    return new URL(rawUrl).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

module.exports = { isSameOriginUrl, normalizeExternalHttpUrl };
