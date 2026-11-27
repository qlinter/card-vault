import type { StudioStagePlan } from "./group-photo-stage-plan";

export class PhotoAiError extends Error {
  describe(en: boolean): string {
    if (this.message === "key") return en ? "Save an image service key in AI settings." : "请先在 AI 设置中保存图片服务密钥。";
    if (this.message === "input") return en ? "The submitted image or layout is invalid. Reselect the cards and try again." : "提交的图片或构图数据无效，请重新选卡后重试。";
    if (this.message === "session") return en ? "Sign in again to continue." : "请重新登录后继续。";
    if (this.message === "network") return en ? "Could not reach the local application service. Try again." : "未能连接本地应用服务，请重试。";
    return en ? "AI stage generation failed. Check the image service settings." : "AI 展台生成失败，请检查制图服务设置。";
  }
}
async function post(form: FormData, signal: AbortSignal) {
  let response: Response;
  try { response = await fetch("/api/studio/group-photo",{method:"POST",body:form,signal}); }
  catch { signal.throwIfAborted(); throw new PhotoAiError("network"); }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new PhotoAiError(body?.error || (response.status === 403 ? "session" : "image"));
  }
  return response;
}

export async function requestStagePlate(photo: Blob, plan: StudioStagePlan, signal: AbortSignal) {
  const form = new FormData();
  form.set("action","stage"); form.set("layout",JSON.stringify(plan)); form.append("image",photo,"studio-reference.jpg");
  return (await post(form,signal)).blob();
}
