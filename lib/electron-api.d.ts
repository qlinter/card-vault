export {};

type DesktopMediaFile = { type: string; path: string };

type DesktopDataHealth = {
  ok: boolean;
  checkedAt: string;
  dataPath: string;
  databasePath: string;
  integrity: string;
  counts: { cards: number; images: number; shares: number; shareCovers: number; shareBackgrounds: number };
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
      }>;
      onStorageProgress: (callback: (progress: DesktopStorageProgress) => void) => () => void;
      getAiSettings: () => Promise<{
        provider: "azure" | "minimax";
        keyRecoveryRequired?: boolean;
        azure: {
          endpoint: string;
          deployment: string;
          hasApiKey: boolean;
        };
        minimax: {
          endpoint: string;
          model: string;
          hasApiKey: boolean;
        };
      }>;
      saveAiSettings: (settings: {
        provider: "azure" | "minimax";
        azure: {
          endpoint: string;
          apiKey?: string;
          deployment: string;
        };
        minimax: {
          endpoint: string;
          apiKey?: string;
          model: string;
        };
      }) => Promise<{
        provider: "azure" | "minimax";
        keyRecoveryRequired?: boolean;
        azure: {
          endpoint: string;
          deployment: string;
          hasApiKey: boolean;
        };
        minimax: {
          endpoint: string;
          model: string;
          hasApiKey: boolean;
        };
      }>;
    };
  }
}
