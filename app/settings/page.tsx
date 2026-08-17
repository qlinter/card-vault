import { AiSettings } from "@/components/ai-settings";
import { AboutSettings } from "@/components/about-settings";
import { BackupSettings } from "@/components/backup-settings";
import { StorageSettings } from "@/components/storage-settings";
import { resolveConfiguredDataDir } from "@/lib/storage-resolver";
import packageInfo from "@/package.json";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const currentStoragePath = resolveConfiguredDataDir() ?? "\u672a\u8bbe\u7f6e";

  return (
    <div className="page settings-page">
      <div className="title-row">
        <div>
          <h1 className="h1">{"\u8bbe\u7f6e"}</h1>
          <p className="muted">
            管理本地存储、备份恢复、AI 服务和 Card Vault 应用信息。
          </p>
        </div>
      </div>

      <StorageSettings currentPath={currentStoragePath} />

      <BackupSettings />

      <AiSettings />

      <AboutSettings defaultVersion={packageInfo.version} />

    </div>
  );
}
