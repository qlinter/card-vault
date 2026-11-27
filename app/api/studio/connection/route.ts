import { accountStatus } from "@/lib/account-server";
import { getStudioAiSettings } from "@/lib/ai-settings";
import { fetchAi } from "@/lib/ai-fetch";

export async function POST() {
  if (!(await accountStatus()).authenticated) return new Response(null, { status: 403 });
  const { apiKey, imageModel: model, proxy } = getStudioAiSettings();
  if (!apiKey) return Response.json({ result: "key", model }, { status: 400 });
  try {
    const reply = await fetchAi("https://api.openai.com/v1/models/" + encodeURIComponent(model), {
      headers: { Authorization: "Bearer " + apiKey }, redirect: "error", signal: AbortSignal.timeout(15000)
    }, proxy);
    await reply.body?.cancel();
    const result = reply.ok ? "ready" : reply.status === 404 ? "missing" : reply.status === 429 ? "limit"
      : [401,403].includes(reply.status) ? "access" : "network";
    return Response.json({ result, model }, { status: reply.ok ? 200 : 502 });
  } catch { return Response.json({ result: "network", model }, { status: 502 }); }
}
