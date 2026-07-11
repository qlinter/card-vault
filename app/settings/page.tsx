import { AzureOpenAISettings } from "@/components/azure-openai-settings";
import { BackupSettings } from "@/components/backup-settings";
import { StorageSettings } from "@/components/storage-settings";
import { resolveConfiguredDataDir } from "@/lib/storage-resolver";

export default function SettingsPage() {
  const currentStoragePath = resolveConfiguredDataDir() ?? "\u672a\u8bbe\u7f6e";

  return (
    <div className="page settings-page">
      <div className="title-row">
        <div>
          <h1 className="h1">{"\u8bbe\u7f6e"}</h1>
          <p className="muted">
            {"\u7ba1\u7406\u5168\u5c40\u914d\u7f6e\u3002\u5f53\u524d\u652f\u6301\u672c\u5730\u6570\u636e\u5b58\u50a8\u3001AI \u670d\u52a1\u5546\u3001\u6a21\u578b\u548c\u8fde\u63a5\u4fe1\u606f\u3002"}
          </p>
        </div>
      </div>

      <StorageSettings currentPath={currentStoragePath} />

      <BackupSettings />

      <AzureOpenAISettings />

      <section className="panel settings-section">
        <h2>{"\u4e91\u7aef\u53d1\u5e03"}</h2>
        <p className="muted">
          {"\u5f53\u524d\u7248\u672c\u5148\u751f\u6210\u9002\u914d\u670d\u52a1\u5668\u9759\u6001\u6258\u7ba1 / Nginx \u7684\u53d1\u5e03\u5305\u3002\u540e\u7eed\u4e00\u952e\u4e0a\u4f20\u4f1a\u5728\u8fd9\u91cc\u914d\u7f6e\u670d\u52a1\u5668\u5730\u5740\u3001\u8fdc\u7a0b\u76ee\u5f55\u548c SSH/SFTP \u51ed\u8bc1\u3002"}
        </p>
      </section>
    </div>
  );
}
