export {};

declare global {
  interface Window {
    cardVaultDesktop?: {
      chooseStorageDirectory: () => Promise<{ path: string; changed: boolean; cancelled: boolean }>;
    };
  }
}
