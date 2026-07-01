import { AzureOpenAISettings } from "@/components/azure-openai-settings";

export default function SettingsPage() {
  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">设置</h1>
          <p className="muted">管理全局配置。当前支持 AI 服务商、模型和连接信息。</p>
        </div>
      </div>

      <AzureOpenAISettings defaultOpen />
    </div>
  );
}
