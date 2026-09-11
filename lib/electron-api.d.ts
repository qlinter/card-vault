import type { AiSettingsDraft, PublicAiSettings } from "./ai-settings";

type DesktopMediaFile = { type: string; path: string };

type DesktopDataHealth = {
  ok: boolean;
  checkedAt: string;
  dataPath: string;
  databasePath: string;
  integrity: string;
  counts: { cards: number; images: number; queueItems: number; shares: number; shareCovers: number; shareBackgrounds: number };
  missingFiles: DesktopMediaFile[];
  orphanFiles: DesktopMediaFile[];
  issues: string[];
};

type DesktopStorageProgress = {
  operation: "backup" | "restore" | "migrate" | "health" | "cleanup" | "reveal";
  percent: number;
  message: string;
  done: boolean;
};

declare global {
  interface Window {
    cardVaultDesktop?: {
      chooseStorageDirectory: () => Promise<{ path: string; changed: boolean; cancelled: boolean }>;
      getBackupSettings: () => Promise<{ path: string }>;
      chooseBackupDirectory: () => Promise<{ path: string; cancelled: boolean }>;
      backupDataFolder: () => Promise<{ backupRoot: string; datePath: string; backupPath: string }>;
      checkDataHealth: () => Promise<DesktopDataHealth>;
      showOrphanFileInFolder: (file: DesktopMediaFile) => Promise<{ path: string }>;
      cleanOrphanFiles: () => Promise<{
        recoveryPath?: string | null;
        cancelled: boolean;
        deletedFiles: Array<{ type: string; path: string }>;
        failedFiles: Array<{ type: string; path: string; reason: string }>;
        health: DesktopDataHealth;
      }>;
      restoreDataFolder: () => Promise<{
        cancelled: boolean;
        restoredFrom?: string;
        restoredTo?: string;
        safetyBackupPath?: string | null;
        schemaVersion?: string;
      }>;
      onStorageProgress: (callback: (progress: DesktopStorageProgress) => void) => () => void;
      getAiSettings: () => Promise<PublicAiSettings & { keyRecoveryRequired?: boolean }>;
      saveAiSettings: (settings: AiSettingsDraft) => Promise<PublicAiSettings & { keyRecoveryRequired?: boolean }>;
    };
  }
}
