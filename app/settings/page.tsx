import { AiSettings } from "@/components/ai-settings";
import { BackupSettings } from "@/components/backup-settings";
import { StorageSettings } from "@/components/storage-settings";
import { resolveConfiguredDataDir } from "@/lib/storage-resolver";

export const dynamic = "force-dynamic";

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

      <AiSettings />

    </div>
  );
}
