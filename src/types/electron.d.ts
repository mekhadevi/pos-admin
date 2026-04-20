export {};

declare global {
  interface Window {
    electronAPI: {
      login(arg0: { username: string; password: string }): unknown;
      printReceipt: (html: string) => Promise<void>;
    };
  }
}
