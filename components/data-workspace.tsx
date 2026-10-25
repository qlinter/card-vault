import { DataCenter } from "./data-center";
import { StorageSettings } from "./storage-settings";
import { BackupSettings } from "./backup-settings";
import { resolveConfiguredDataDir } from "@/lib/storage-resolver";

export function DataWorkspace({ embedded = false }: { embedded?: boolean }) {
  return (
    <DataCenter embedded={embedded} maintenance={<StorageSettings currentPath={resolveConfiguredDataDir() ?? "未设置"} />}>
      <BackupSettings />
    </DataCenter>
  );
}
