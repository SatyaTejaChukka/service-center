const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktopApp: true,
  getBackendPort: () => ipcRenderer.sendSync('get-backend-port'),
  printSilent: (pdfUrl, printerName) => ipcRenderer.invoke('print-silent', { pdfUrl, printerName }),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  onSplashStatus: (callback) => {
    ipcRenderer.on('splash-status', (_, msg) => callback(msg));
  }
});
