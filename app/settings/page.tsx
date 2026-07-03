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

      <section className="panel settings-section">
        <h2>云端发布</h2>
        <p className="muted">
          当前版本先生成适配阿里云 ECS / Nginx 的静态发布包。后续一键上传会在这里配置服务器地址、远程目录和 SSH/SFTP 凭证。
        </p>
      </section>
    </div>
  );
}
