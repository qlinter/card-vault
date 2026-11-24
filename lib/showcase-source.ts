export function showcaseSourceCookie(guest: boolean) {
  return guest ? "card-vault-guest-showcase-source" : "card-vault-showcase-source";
}

export function rememberShowcaseSource(guest: boolean, studio: boolean) {
  document.cookie = showcaseSourceCookie(guest) + "=" + (studio ? "studio" : "original") + "; Path=/; Max-Age=31536000; SameSite=Strict";
}
