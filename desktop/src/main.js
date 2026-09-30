const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { findFreePort } = require('./portFinder');

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let backendPort = 8000;
let isQuitting = false;

// 1. Single Instance Lock (Preempts multiple competing SQLite writers)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Desktop] Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(bootApplication);
}

function getAppDataDir() {
  const base = process.env.LOCALAPPDATA || process.env.APPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
  const dir = path.join(base, 'PushpaRajAutomotive');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getLogFile() {
  const logsDir = path.join(getAppDataDir(), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  return path.join(logsDir, 'desktop.log');
}

function logMessage(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(getLogFile(), line);
  } catch {}
  console.log(msg);
}

// 2. Poll Backend Health
function waitForBackend(port, maxAttempts = 50, intervalMs = 400) {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${port}/api/v1/auth/setup-status`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 401) {
          resolve(true);
        } else {
          retry();
        }
      });

      req.on('error', () => retry());
      req.setTimeout(800, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (attempts >= maxAttempts) {
        resolve(false);
      } else {
        setTimeout(check, intervalMs);
      }
    };

    check();
  });
}

// 3. Boot Orchestrator
async function bootApplication() {
  logMessage('[Desktop] Starting Pushpa Raj Automotive Services Desktop System...');

  // Create Splash Preloader
  splashWindow = new BrowserWindow({
    width: 480,
    height: 310,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));

  try {
    // A. Allocate free port
    backendPort = await findFreePort(8000, 8099);
    logMessage(`[Desktop] Allocated available port for backend: ${backendPort}`);
  } catch (err) {
    logMessage(`[Desktop] Port allocation error: ${err.message}`);
    backendPort = 8000;
  }

  // B. Determine backend executable path
  const isDev = !app.isPackaged;
  let backendBinary = '';
  let backendArgs = [];
  let backendCwd = '';

  if (isDev) {
    backendBinary = path.join(__dirname, '../../.venv/Scripts/python.exe');
    backendArgs = ['server_entrypoint.py', '--port', backendPort.toString()];
    backendCwd = path.join(__dirname, '../../backend');
  } else {
    // In packaged application, sidecar is placed in process.resourcesPath/backend-server/backend-server.exe
    backendBinary = path.join(process.resourcesPath, 'backend-server', 'backend-server.exe');
    backendArgs = ['--port', backendPort.toString()];
    backendCwd = path.join(process.resourcesPath, 'backend-server');
  }

  logMessage(`[Desktop] Spawning backend sidecar: ${backendBinary} with args: ${backendArgs.join(' ')}`);

  // C. Spawn Python Backend Process
  try {
    backendProcess = spawn(backendBinary, backendArgs, {
      cwd: backendCwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout?.on('data', (d) => {
      const out = d.toString().trim();
      if (out) logMessage(`[Backend stdout] ${out}`);
    });

    backendProcess.stderr?.on('data', (d) => {
      const err = d.toString().trim();
      if (err) logMessage(`[Backend stderr] ${err}`);
    });

    backendProcess.on('exit', (code, signal) => {
      logMessage(`[Desktop] Backend exited with code: ${code}, signal: ${signal}`);
      if (!isQuitting && code !== 0) {
        dialog.showErrorBox(
          'Engine Offline',
          `The local workshop database engine stopped unexpectedly (Code: ${code}).\nLogs saved to:\n${getLogFile()}`
        );
      }
    });
  } catch (err) {
    logMessage(`[Desktop] Failed to launch backend sidecar: ${err.message}`);
    dialog.showErrorBox(
      'Startup Failed',
      `Could not launch local backend server:\n${err.message}\n\nPlease check if your antivirus is blocking the file:\n${backendBinary}`
    );
    app.quit();
    return;
  }

  // D. Wait for backend ready
  const isHealthy = await waitForBackend(backendPort, 60, 400);
  if (!isHealthy) {
    logMessage('[Desktop] Backend failed health check after 24 seconds.');
    dialog.showErrorBox(
      'Database Connection Failed',
      `The local backend server did not respond within 24 seconds.\nPlease check your logs at:\n${getLogFile()}`
    );
    app.quit();
    return;
  }

  logMessage('[Desktop] Backend server is healthy! Initializing main window...');

  // E. Create Main Window
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Pushpa Raj Automotive Services - Workshop Suite',
    icon: path.join(__dirname, '../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Prevents CORS & Private Network Access restrictions for local file:// to http://127.0.0.1
    },
  });

  // Remove default standard browser menu for clean desktop app appearance
  Menu.setApplicationMenu(null);

  let isWindowShown = false;
  const showMainWindow = () => {
    if (isWindowShown) return;
    isWindowShown = true;
    logMessage('[Desktop] Showing main window and dismissing splash screen.');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  // Register transition handlers BEFORE loading content
  mainWindow.once('ready-to-show', () => {
    logMessage('[Desktop] Main window ready-to-show event fired.');
    showMainWindow();
  });

  mainWindow.webContents.once('did-finish-load', () => {
    logMessage('[Desktop] Main window did-finish-load event fired.');
    // Safety fallback: if ready-to-show is delayed, show after brief paint interval
    setTimeout(showMainWindow, 200);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logMessage(`[Desktop Renderer Error] did-fail-load: code ${errorCode} - ${errorDescription} on ${validatedURL}`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logMessage(`[Renderer Console] ${message} (line ${line} in ${sourceId})`);
  });

  // Intercept and configure child windows (e.g. PDF viewers)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logMessage(`[Desktop] Opening document viewer window for URL: ${url}`);
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1100,
        height: 850,
        minWidth: 800,
        minHeight: 600,
        center: true,
        autoHideMenuBar: true,
        icon: path.join(__dirname, '../assets/icon.ico'),
        title: 'Pushpa Raj Automotive - Document Viewer',
        webPreferences: {
          sandbox: false,
          contextIsolation: true,
          webSecurity: false,
        },
      },
    };
  });

  mainWindow.webContents.on('did-create-window', (childWindow, { url }) => {
    childWindow.on('page-title-updated', (event, title) => {
      if (!title || title.trim().toLowerCase() === 'anonymous') {
        event.preventDefault();
        childWindow.setTitle('Pushpa Raj Automotive - Document Viewer');
      }
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // F. Load Frontend
  if (isDev && process.env.VITE_DEV_SERVER === 'true') {
    await mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    // In production or built mode, load dist/index.html
    const localDistPath = path.join(__dirname, '../../frontend/dist/index.html');
    const packagedDistPath = path.join(__dirname, '../dist/index.html');
    const distPath = fs.existsSync(packagedDistPath) ? packagedDistPath : localDistPath;

    logMessage(`[Desktop] Loading frontend bundle from: ${distPath}`);
    await mainWindow.loadFile(distPath);
  }

  // Safety fallback timer in case all events were missed
  setTimeout(() => {
    if (!isWindowShown) {
      logMessage('[Desktop] Fallback timer triggered to show main window.');
      showMainWindow();
    }
  }, 1500);
}

// 4. Synchronous IPC Handlers for Preload Bridge
ipcMain.on('get-backend-port', (event) => {
  event.returnValue = backendPort;
});

// 5. Silent Direct Printing Handler (A4 Laser and Thermal POS)
ipcMain.handle('print-silent', async (event, { pdfUrl, printerName }) => {
  logMessage(`[Print] Printing request received for printer: ${printerName || 'Default'}`);
  return new Promise((resolve, reject) => {
    const printWorker = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: false,
      },
    });

    printWorker.loadURL(pdfUrl);

    printWorker.webContents.on('did-finish-load', () => {
      printWorker.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: printerName || '',
        },
        (success, failureReason) => {
          printWorker.close();
          if (!success) {
            logMessage(`[Print] Print job failed: ${failureReason}`);
            reject(new Error(failureReason));
          } else {
            logMessage('[Print] Print job dispatched successfully to spooler.');
            resolve(true);
          }
        }
      );
    });

    printWorker.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      printWorker.close();
      reject(new Error(`Failed to load document for printing: ${errorDescription} (${errorCode})`));
    });
  });
});

// 6. Enumerate System Printers
ipcMain.handle('get-printers', async () => {
  if (mainWindow) {
    return await mainWindow.webContents.getPrintersAsync();
  }
  return [];
});

// 7. Clean Shutdown & SQLite WAL Flush
async function handleGracefulShutdown() {
  if (isQuitting) return;
  isQuitting = true;
  logMessage('[Desktop] Initiating graceful shutdown...');

  if (backendPort && backendProcess) {
    // Attempt HTTP shutdown to let FastAPI flush SQLite WAL checkpoint
    try {
      await new Promise((resolve) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: backendPort,
            path: '/api/v1/system/shutdown',
            method: 'POST',
            timeout: 1000,
          },
          () => resolve(true)
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      });
    } catch {}

    // Give process 600ms to exit, then terminate if necessary
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        try {
          backendProcess.kill();
        } catch {}
      }
      app.exit(0);
    }, 600);
  } else {
    app.exit(0);
  }
}

app.on('before-quit', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    handleGracefulShutdown();
  }
});

app.on('window-all-closed', () => {
  handleGracefulShutdown();
});
