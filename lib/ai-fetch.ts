import { Agent, ProxyAgent, Socks5ProxyAgent, type Dispatcher } from "undici";
import { randomUUID } from "node:crypto";
import { bypassProxy, manualProxyUrl, normalizeAiProxy, normalizeProxyUrl, systemProxyUrls, type AiProxySettings } from "./ai-proxy-core.js";

export type AiRouteDiagnostic = { source: "direct" | "bypass" | "manual" | "environment" | "system"; connection: "direct" | "proxy"; protocol?: string; attempt: number };
type Route = { source: AiRouteDiagnostic["source"]; proxies: string[] };

const dispatchers = new Map<string, Dispatcher>();
function dispatcherFor(proxy: string): Dispatcher {
  const existing = dispatchers.get(proxy);
  if (existing) { dispatchers.delete(proxy); dispatchers.set(proxy, existing); return existing; }
  let agent: Dispatcher;
  if (!proxy) agent = new Agent({ connect: { timeout: 15000 } });
  else {
    const url = new URL(proxy);
    if (url.protocol === "socks5:") agent = new Socks5ProxyAgent(url);
    else {
      const token = url.username || url.password ? "Basic " + Buffer.from(decodeURIComponent(url.username) + ":" + decodeURIComponent(url.password)).toString("base64") : undefined;
      agent = new ProxyAgent({ uri: proxy, token, connectTimeout: 15000 });
    }
  }
  dispatchers.set(proxy, agent);
  if (dispatchers.size > 16) {
    const oldest = dispatchers.keys().next().value!;
    const retired = dispatchers.get(oldest)!;
    dispatchers.delete(oldest);
    void retired.close().catch(() => {});
  }
  return agent;
}

function desktopSystemProxy(url: string, signal?: AbortSignal | null): Promise<string> {
  if (!process.send || !process.connected) return Promise.reject(new Error("无法读取系统代理，请使用手动代理配置。"));
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const cleanup = () => { clearTimeout(timer); process.off("message", receive); signal?.removeEventListener("abort", abort); };
    const abort = () => { cleanup(); reject(new DOMException("已取消 AI 请求。", "AbortError")); };
    const receive = (message: unknown) => {
      const reply = message as { type?: string; id?: string; proxy?: string; error?: boolean } | null;
      if (reply?.type !== "card-vault:ai-proxy-result" || reply.id !== id) return;
      cleanup();
      if (reply.error || typeof reply.proxy !== "string") reject(new Error("无法读取系统代理，请使用手动代理配置。"));
      else resolve(reply.proxy);
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error("读取系统代理超时，请使用手动代理配置。")); }, 5000);
    process.on("message", receive);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    process.send!({ type: "card-vault:resolve-ai-proxy", id, url }, error => { if (error) { cleanup(); reject(new Error("无法读取系统代理，请使用手动代理配置。")); } });
  });
}

async function resolveProxy(target: string, settings: AiProxySettings, signal?: AbortSignal | null): Promise<Route> {
  if (settings.mode === "direct") return { source: "direct", proxies: [""] };
  if (bypassProxy(target, settings.noProxy)) return { source: "bypass", proxies: [""] };
  if (settings.mode === "manual") return { source: "manual", proxies: [manualProxyUrl(settings)] };
  const env = process.env;
  if (bypassProxy(target, env.no_proxy ?? env.NO_PROXY ?? "")) return { source: "bypass", proxies: [""] };
  const protocol = new URL(target).protocol;
  const value = (protocol === "https:" ? env.https_proxy || env.HTTPS_PROXY : env.http_proxy || env.HTTP_PROXY) || env.all_proxy || env.ALL_PROXY;
  if (value) return { source: "environment", proxies: [normalizeProxyUrl(value)] };
  if (process.env.CARD_VAULT_DESKTOP_PROXY_BRIDGE !== "1") return { source: "direct", proxies: [""] };
  return { source: "system", proxies: systemProxyUrls(await desktopSystemProxy(target, signal)) };
}

function networkFailure(error: unknown) {
  const codes: string[] = [], details: string[] = [];
  let current = error;
  for (let depth = 0; current && depth < 6; depth++) {
    const item = current as { code?: string; message?: string; cause?: unknown };
    codes.push(item.code ?? ""); details.push(item.message ?? ""); current = item.cause;
  }
  const text = details.join(" ");
  if (/407|authentication|username.*password/i.test(text)) return { kind: "auth", message: "代理认证失败，请检查代理用户名和密码。", failover: true };
  if (codes.some(code => /CERT|TLS|SSL/.test(code))) return { kind: "tls", message: "安全连接验证失败，请检查代理证书、服务地址和系统时间。", failover: false };
  if (codes.includes("ENOTFOUND") || codes.includes("EAI_AGAIN")) return { kind: "dns", message: "无法解析服务或代理地址，请检查地址和 DNS 设置。", failover: true };
  if (codes.some(code => ["ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT"].includes(code))) return { kind: "connect", message: "无法连接服务或代理，请检查地址、端口及代理是否已启动。", failover: true };
  if (/Proxy response \(\d+\) !== 200/.test(text)) return { kind: "proxy", message: "代理拒绝转发请求，请检查代理规则或访问权限。", failover: true };
  return { kind: "network", message: "无法连接 AI 服务，请检查网络、Endpoint 和代理设置。", failover: false };
}

/** Request-scoped routing keeps proxy choices out of the global fetch dispatcher. */
export async function fetchAi(url: string, init: RequestInit = {}, settings?: AiProxySettings, onRoute?: (route: AiRouteDiagnostic) => void): Promise<Response> {
  const proxySettings = normalizeAiProxy(settings);
  let target = new URL(url), request = { ...init, headers: new Headers(init.headers) };
  for (let redirects = 0; redirects <= 10; redirects++) {
    init.signal?.throwIfAborted();
    const route = await resolveProxy(target.href, proxySettings, init.signal);
    let response: Response | undefined;
    for (const [index, proxy] of route.proxies.entries()) {
      init.signal?.throwIfAborted();
      onRoute?.({ source: route.source, connection: proxy ? "proxy" : "direct", protocol: proxy ? new URL(proxy).protocol.slice(0, -1) : undefined, attempt: index + 1 });
      try {
        response = await fetch(target, { ...request, redirect: "manual", dispatcher: dispatcherFor(proxy) } as RequestInit);
        break;
      } catch (error) {
        if (init.signal?.aborted) throw error;
        const failure = networkFailure(error);
        // Only failures before sending upstream HTTP data can try another system candidate.
        if (route.source === "system" && failure.failover && index + 1 < route.proxies.length) continue;
        throw new Error(failure.message, { cause: error });
      }
    }
    if (!response) throw new Error("无法连接 AI 服务，请检查代理设置。");
    if (![301, 302, 303, 307, 308].includes(response.status) || !response.headers.has("location") || init.redirect === "manual") return response;
    if (init.redirect === "error" || redirects === 10) { await response.body?.cancel(); throw new Error("AI 服务重定向失败，请检查 Endpoint。"); }
    const next = new URL(response.headers.get("location")!, target);
    await response.body?.cancel();
    if (!["http:", "https:"].includes(next.protocol) || next.username || next.password || target.protocol === "https:" && next.protocol !== "https:") throw new Error("AI 服务重定向地址不安全，请检查 Endpoint。");
    if (next.origin !== target.origin) {
      // Custom providers can use arbitrary key headers. Preserve only public content headers.
      for (const name of [...request.headers.keys()]) if (!["accept", "accept-language", "content-type"].includes(name)) request.headers.delete(name);
    }
    const method = (request.method ?? "GET").toUpperCase();
    if ((response.status === 301 || response.status === 302) && method === "POST" || response.status === 303 && method !== "HEAD") {
      request = { ...request, method: "GET", body: undefined };
      request.headers.delete("content-type"); request.headers.delete("content-length");
    }
    target = next;
  }
  throw new Error("AI 服务重定向失败，请检查 Endpoint。");
}

export function redactAiError(value: string, apiKey: string): string {
  return (apiKey ? value.replaceAll(apiKey, "[REDACTED]") : value).replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]");
}
