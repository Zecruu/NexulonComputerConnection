import { app, BrowserWindow, systemPreferences, session, ipcMain } from 'electron';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import Store from 'electron-store';
import { registerIpcHandlers } from './ipc.js';
import { destroySignalingClient } from './peer.js';

const store = new Store({
  defaults: {
    windowBounds: { width: 480, height: 600 },
    quality: 'medium' as const,
    launchAtStartup: false,
  },
});

let mainWindow: BrowserWindow | null = null;
let localServer: http.Server | null = null;

// Mime types for local static server
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Serves the renderer build folder on a random localhost port.
 * Clerk requires an http:// origin — file:// gets 401.
 */
function startLocalServer(rendererDir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(rendererDir, req.url === '/' ? 'index.html' : req.url!);
      // Prevent directory traversal
      if (!filePath.startsWith(rendererDir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const ext = path.extname(filePath);
      const contentType = MIME[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback — serve index.html for client-side routes
          fs.readFile(path.join(rendererDir, 'index.html'), (err2, data2) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not found');
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    // Port 3000 — standard dev port that Clerk whitelists
    server.listen(3000, 'localhost', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        localServer = server;
        resolve(addr.port);
      } else {
        reject(new Error('Failed to start local server'));
      }
    });
  });
}

async function createWindow(): Promise<void> {
  const { width, height } = store.get('windowBounds') as {
    width: number;
    height: number;
  };

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 400,
    minHeight: 500,
    title: 'Nexulon Connect',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const [w, h] = mainWindow.getSize();
    store.set('windowBounds', { width: w, height: h });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.openDevTools();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Serve renderer via localhost so Clerk gets an http:// origin
    const rendererDir = path.join(__dirname, '../renderer');
    const port = await startLocalServer(rendererDir);
    mainWindow.loadURL(`http://localhost:${port}`);
  }
}

async function requestMacPermissions(): Promise<void> {
  if (process.platform !== 'darwin') return;
  const trusted = systemPreferences.isTrustedAccessibilityClient(true);
  if (!trusted) {
    console.warn(
      '[permissions] Accessibility not granted — input simulation will fail.'
    );
  }
}

app.whenReady().then(async () => {
  // Fix Clerk security: ensure Origin header is sent on cross-origin requests
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*.clerk.accounts.dev/*', 'https://*.clerk.com/*'] },
    (details, callback) => {
      details.requestHeaders['Origin'] = 'http://localhost:3000';
      details.requestHeaders['Referer'] = 'http://localhost:3000/';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  await requestMacPermissions();
  registerIpcHandlers();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  destroySignalingClient();
  localServer?.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- Auto-updater with IPC ---
// Use require() not import() — output is CJS and dynamic import()
// fails to resolve from asar in packaged Electron apps.

let autoUpdaterInstance: any = null;

const sendToRenderer = (channel: string, ...args: unknown[]) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
};

if (app.isPackaged) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater } = require('electron-updater');
    autoUpdaterInstance = autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => sendToRenderer('updater:status', 'checking'));
    autoUpdater.on('update-available', (info: any) => sendToRenderer('updater:status', 'available', info.version));
    autoUpdater.on('update-not-available', () => sendToRenderer('updater:status', 'up-to-date'));
    autoUpdater.on('download-progress', (p: any) => sendToRenderer('updater:status', 'downloading', p.percent));
    autoUpdater.on('update-downloaded', () => sendToRenderer('updater:status', 'ready'));
    autoUpdater.on('error', (err: any) => sendToRenderer('updater:status', 'error', err?.message || 'Update failed'));

    console.log('[updater] electron-updater loaded successfully');
  } catch (err) {
    console.error('[updater] Failed to load electron-updater:', err);
  }
}

ipcMain.handle('updater:check', async () => {
  if (!autoUpdaterInstance) return { error: 'Updater not available (app not packaged or module missing)' };
  try {
    const result = await autoUpdaterInstance.checkForUpdates();
    return result?.updateInfo?.version || null;
  } catch (err: any) {
    return { error: err?.message || 'Check failed' };
  }
});

ipcMain.handle('updater:download', async () => {
  if (!autoUpdaterInstance) return;
  await autoUpdaterInstance.downloadUpdate();
});

ipcMain.handle('updater:install', () => {
  if (autoUpdaterInstance) {
    autoUpdaterInstance.quitAndInstall(false, true);
  }
});

ipcMain.handle('updater:get-version', () => {
  return app.getVersion();
});
