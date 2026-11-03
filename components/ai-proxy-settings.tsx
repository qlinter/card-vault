"use client";
import { UiText, UiElement } from "./ui-text";
import type { PublicAiProxySettings } from "@/lib/ai-proxy-core";

type Props = { value: PublicAiProxySettings; onChange: (patch: Partial<PublicAiProxySettings>) => void; password: string; onPassword: (value: string) => void; clearPassword: boolean; onClearPassword: (value: boolean) => void; disabled: boolean };
const modeNames = { auto: "自动", direct: "直连", manual: "手动代理" };
export function AiProxySettings({ value, onChange, password, onPassword, clearPassword, onClearPassword, disabled }: Props) {
  return <details className="ai-proxy-settings">
    <summary><UiText text="网络与代理" /></summary>
    <div className="form-grid ai-common-fields">
      <label className="field full"><span><UiText text="连接方式" /></span><select value={value.mode} disabled={disabled} onChange={event => onChange({ mode: event.target.value as PublicAiProxySettings["mode"] })}>
        {Object.entries(modeNames).map(([id, name]) => <option key={id} value={id}><UiText text={name} /></option>)}
      </select></label>
      {value.mode === "manual" ? <>
        <label className="field"><span><UiText text="代理协议" /></span><select value={value.protocol} disabled={disabled} onChange={event => onChange({ protocol: event.target.value as PublicAiProxySettings["protocol"] })}><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">SOCKS5</option></select></label>
        <label className="field"><span><UiText text="代理端口" /></span><input type="number" min="1" max="65535" inputMode="numeric" value={value.port} disabled={disabled} onChange={event => onChange({ port: event.target.value })} /></label>
        <label className="field full"><span><UiText text="代理服务器地址" /></span><input autoComplete="off" value={value.host} disabled={disabled} onChange={event => onChange({ host: event.target.value })} /></label>
        <label className="field"><span><UiText text="代理用户名（可选）" /></span><input autoComplete="off" value={value.username} disabled={disabled} onChange={event => onChange({ username: event.target.value })} /></label>
        <label className="field"><span><UiText text="代理密码（可选）" /></span><UiElement as="input" uiAttributes={["placeholder"]} type="password" autoComplete="new-password" value={password} placeholder={value.hasPassword ? "已保存；留空则不修改" : undefined} disabled={disabled} onChange={event => { onPassword(event.target.value); onClearPassword(false); }} /></label>
        {value.hasPassword ? <label className="field full"><span><input type="checkbox" checked={clearPassword} disabled={disabled} onChange={event => { onClearPassword(event.target.checked); if (event.target.checked) onPassword(""); }} /> <UiText text="保存时清除代理密码" /></span></label> : null}
      </> : null}
      {value.mode !== "direct" ? <label className="field full"><span><UiText text="不经过代理的地址" /></span><UiElement as="input" uiAttributes={["placeholder"]} autoComplete="off" placeholder="多个地址用逗号分隔" value={value.noProxy} disabled={disabled} onChange={event => onChange({ noProxy: event.target.value })} /></label> : null}
    </div>
  </details>;
}
