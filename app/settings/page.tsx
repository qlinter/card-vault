import { UserGuideSettings, DataSettings } from "@/components/settings-disclosure";
import { DataWorkspace } from "@/components/data-workspace";
import { UiText } from "@/components/ui-text";
import { AiSettings } from "@/components/ai-settings";
import { AboutSettings } from "@/components/about-settings";
import packageInfo from "@/package.json";
import { FinancialSettings } from "@/components/financial-settings";
import { loadFinancialSettings } from "@/lib/financial-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const financialConfig = await loadFinancialSettings();

  return (
    <div className="page settings-page">
      <h1 className="sr-only"><UiText text="设置" /></h1>

      <DataSettings><DataWorkspace embedded /></DataSettings>
      <AiSettings />
      <FinancialSettings config={financialConfig} />
      <UserGuideSettings />

      <AboutSettings defaultVersion={packageInfo.version} />

    </div>
  );
}
