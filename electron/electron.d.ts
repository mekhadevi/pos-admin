export {};

declare global {
  interface Window {
    electronAPI: {
      login: (data: any) => Promise<any>;
    };
  }
}
