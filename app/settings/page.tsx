import { AiSettings } from "@/components/ai-settings";
import { AboutSettings } from "@/components/about-settings";
import { BackupSettings } from "@/components/backup-settings";
import { StorageSettings } from "@/components/storage-settings";
import { resolveConfiguredDataDir } from "@/lib/storage-resolver";
import packageInfo from "@/package.json";
import { FinancialSettings } from "@/components/financial-settings";
import { loadFinancialSettings } from "@/lib/financial-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const financialConfig = await loadFinancialSettings();
  const currentStoragePath = resolveConfiguredDataDir() ?? "\u672a\u8bbe\u7f6e";

  return (
    <div className="page settings-page">
      <div className="title-row">
        <div>
          <h1 className="h1">{"\u8bbe\u7f6e"}</h1>
        </div>
      </div>

      <StorageSettings currentPath={currentStoragePath} />

      <BackupSettings />

      <AiSettings />
      <FinancialSettings config={financialConfig} />

      <AboutSettings defaultVersion={packageInfo.version} />

    </div>
  );
}
