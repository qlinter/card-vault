const defaultNoProxy = "localhost,127.0.0.1,::1";
function ipNumber(value) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return value.split(".").every(part => Number(part) <= 255) ? { bits: 32, value: value.split(".").reduce((result, part) => (result << 8n) | BigInt(part), 0n) } : null;
  if (!value.includes(":")) return null;
  let text = value;
  if (text.includes(".")) {
    const offset = text.lastIndexOf(":"), parsed = ipNumber(text.slice(offset + 1));
    if (!parsed) return null;
    const ipv4 = parsed.value;
    text = text.slice(0, offset) + ":" + (ipv4 >> 16n).toString(16) + ":" + (ipv4 & 65535n).toString(16);
  }
  const [left, right] = text.split("::");
  const head = left ? left.split(":") : [], tail = right ? right.split(":") : [];
  if (text.split("::").length > 2 || head.length + tail.length > (text.includes("::") ? 7 : 8) || !text.includes("::") && head.length !== 8 || [...head, ...tail].some(part => !/^[a-f0-9]{1,4}$/i.test(part))) return null;
  const parts = text.includes("::") ? [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail] : head;
  return { bits: 128, value: parts.reduce((result, part) => (result << 16n) | BigInt("0x" + part), 0n) };
}
function matchesCidr(host, rule) {
  const [network, prefix, extra] = rule.split("/");
  if (extra !== undefined || !/^\d+$/.test(prefix || "")) return false;
  const address = ipNumber(host), base = ipNumber(network.replace(/^\[|\]$/g, ""));
  if (!address || !base || address.bits !== base.bits || Number(prefix) > base.bits) return false;
  const shift = BigInt(base.bits - Number(prefix));
  return address.value >> shift === base.value >> shift;
}
function normalizeAiProxy(value = {}) {
  return {
    mode: ["auto", "manual", "direct"].includes(value?.mode) ? value.mode : "auto",
    protocol: ["http", "https", "socks5"].includes(value?.protocol) ? value.protocol : "http",
    host: typeof value?.host === "string" ? value.host.trim() : "",
    port: typeof value?.port === "string" || typeof value?.port === "number" ? String(value.port).trim() : "",
    username: typeof value?.username === "string" ? value.username : "",
    password: typeof value?.password === "string" ? value.password : "",
    noProxy: typeof value?.noProxy === "string" ? value.noProxy.trim() : defaultNoProxy
  };
}
function validateAiProxy(proxy) {
  if (proxy.host && /[\s/@?#\\]/.test(proxy.host)) throw new Error("代理地址只填写主机名或 IP，请将协议、端口和认证信息分别填写。");
  if (proxy.mode !== "manual") return;
  if (!proxy.host || !/^\d+$/.test(proxy.port) || Number(proxy.port) < 1 || Number(proxy.port) > 65535) throw new Error("请填写有效的代理主机和 1–65535 之间的端口。");
  try {
    const host = proxy.host.includes(":") && !proxy.host.startsWith("[") ? "[" + proxy.host + "]" : proxy.host;
    const url = new URL(proxy.protocol + "://" + host + ":" + proxy.port);
    if (!url.hostname || url.username || url.password || url.pathname && url.pathname !== "/") throw new Error();
  } catch { throw new Error("代理主机地址无效，请检查主机名或 IP。"); }
}
function manualProxyUrl(proxy) {
  validateAiProxy(proxy);
  const host = proxy.host.includes(":") && !proxy.host.startsWith("[") ? "[" + proxy.host + "]" : proxy.host;
  const url = new URL(proxy.protocol + "://" + host + ":" + proxy.port);
  url.username = encodeURIComponent(proxy.username);
  url.password = encodeURIComponent(proxy.password);
  return url.href;
}
function bypassProxy(target, rules) {
  const url = new URL(target), host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase(), port = url.port || (url.protocol === "https:" ? "443" : "80");
  return String(rules || "").split(/[,;\s]+/).filter(Boolean).some(value => {
    let rule = value.toLowerCase();
    if (rule === "*") return true;
    if (rule.includes("/")) return matchesCidr(host, rule);
    const withPort = rule.startsWith("[") ? /^(\[[^\]]+\]):(\d+)$/.exec(rule) : /^([^:]+):(\d+)$/.exec(rule);
    if (withPort) { if (withPort[2] !== port) return false; rule = withPort[1]; }
    rule = rule.replace(/^\[|\]$/g, "");
    if (rule.startsWith("*.")) return host.endsWith(rule.slice(1));
    if (rule.startsWith(".")) return host === rule.slice(1) || host.endsWith(rule);
    return host === rule;
  });
}
function normalizeProxyUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "socks5h:" || url.protocol === "socks:") url.protocol = "socks5:";
    if (!["http:", "https:", "socks5:"].includes(url.protocol) || !url.hostname || url.hash || url.search || url.pathname && url.pathname !== "/") throw new Error();
    return url.href;
  } catch { throw new Error("代理配置无效，仅支持 HTTP、HTTPS 和 SOCKS5 代理。"); }
}
function systemProxyUrl(rules) {
  return systemProxyUrls(rules)[0];
}
function systemProxyUrls(rules) {
  const proxies = [];
  for (const rule of String(rules || "DIRECT").split(";")) {
    const [kind, address] = rule.trim().split(/\s+/);
    if (kind === "DIRECT") { proxies.push(""); break; }
    const protocol = { PROXY: "http", HTTP: "http", HTTPS: "https", SOCKS5: "socks5" }[kind];
    if (protocol && address) { proxies.push(normalizeProxyUrl(protocol + "://" + address)); continue; }
    if (kind) throw new Error("当前系统代理类型不受支持，请改用手动 HTTP、HTTPS 或 SOCKS5 配置。");
  }
  if (!proxies.length) throw new Error("当前系统代理类型不受支持，请改用手动 HTTP、HTTPS 或 SOCKS5 配置。");
  return proxies;
}
module.exports = { defaultNoProxy, normalizeAiProxy, validateAiProxy, manualProxyUrl, bypassProxy, normalizeProxyUrl, systemProxyUrl, systemProxyUrls };
