export {};

declare global {
  interface Window {
    cardVaultDesktop?: {
      chooseStorageDirectory: () => Promise<{ path: string; changed: boolean; cancelled: boolean }>;
      getBackupSettings: () => Promise<{ path: string }>;
      chooseBackupDirectory: () => Promise<{ path: string; cancelled: boolean }>;
      backupDataFolder: () => Promise<{ backupRoot: string; datePath: string; backupPath: string }>;
      getAiSettings: () => Promise<{
        provider: "azure" | "minimax";
        azure: {
          endpoint: string;
          deployment: string;
          apiVersion: string;
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
          apiVersion: string;
        };
        minimax: {
          endpoint: string;
          apiKey?: string;
          model: string;
        };
      }) => Promise<{
        provider: "azure" | "minimax";
        azure: {
          endpoint: string;
          deployment: string;
          apiVersion: string;
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
