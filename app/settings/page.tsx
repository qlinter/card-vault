import { DataSettings } from "@/components/settings-disclosure";
import { DataWorkspace } from "@/components/data-workspace";
import { UiText } from "@/components/ui-text";
import { AiSettings } from "@/components/ai-settings";
import { SettingsHelp } from "@/components/settings-help";
import packageInfo from "@/package.json";
import { FinancialSettings } from "@/components/financial-settings";
import { loadFinancialSettings } from "@/lib/financial-settings";
import { ThemeSettings } from "@/components/theme-settings";
import { AccountSettings } from "@/components/account-settings";
import { SettingsSignOut } from "@/components/settings-sign-out";
import { requireAccount } from "@/lib/account-server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const account = await requireAccount();
  const financialConfig = await loadFinancialSettings();

  return (
    <div className="page settings-page settings-surface">
      <h1 className="sr-only"><UiText text="设置" /></h1>

      <div className="settings-groups">
        <AccountSettings username={account.username || ""} />
        <ThemeSettings />
        <DataSettings><DataWorkspace embedded /></DataSettings>
        <AiSettings />
        <FinancialSettings config={financialConfig} />
      </div>
      <SettingsHelp defaultVersion={packageInfo.version} action={<SettingsSignOut />} />

    </div>
  );
}
