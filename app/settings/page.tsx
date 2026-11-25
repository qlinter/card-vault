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
import { prisma } from "@/lib/prisma";
import { guestShowcaseVisibility } from "@/lib/showcase";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const account = await requireAccount();
  const [financialConfig, publicCardCount] = await Promise.all([
    loadFinancialSettings(),
    prisma.card.count({ where: { visibility: guestShowcaseVisibility } })
  ]);

  return (
    <div className="page settings-page settings-surface">
      <h1 className="sr-only"><UiText text="设置" /></h1>

      <div className="settings-groups">
        <AccountSettings username={account.username || ""} initialGuestEnabled={account.guestEnabled === true} publicCardCount={publicCardCount} />
        <ThemeSettings />
        <DataSettings><DataWorkspace embedded /></DataSettings>
        <AiSettings defaultOpen={(await searchParams).section === "ai"} />
        <FinancialSettings config={financialConfig} />
      </div>
      <SettingsHelp defaultVersion={packageInfo.version} action={<SettingsSignOut />} />

    </div>
  );
}
