export interface ElectronAPI {
  getBackendPort: () => number;
  printSilent: (pdfUrl: string, printerName?: string) => Promise<boolean>;
  getPrinters: () => Promise<Array<{ name: string; isDefault: boolean }>>;
  exportFile?: (defaultName: string, buffer: ArrayBuffer) => Promise<boolean>;
  isDesktopApp?: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __WORKSHOP_API_PORT__?: number;
  }
}
