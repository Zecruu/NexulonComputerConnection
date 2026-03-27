import { app, BrowserWindow, systemPreferences } from 'electron';
import path from 'node:path';
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

function createWindow(): void {
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
      webSecurity: false, // Allow Clerk to load external resources
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for @nut-tree/nut-js native modules
    },
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    const [w, h] = mainWindow.getSize();
    store.set('windowBounds', { width: w, height: h });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // In dev, load from Vite dev server; in prod, load the built index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

/**
 * macOS: Prompt for Screen Recording and Accessibility permissions.
 * These are required for desktopCapturer and @nut-tree/nut-js respectively.
 */
async function requestMacPermissions(): Promise<void> {
  if (process.platform !== 'darwin') return;

  // Screen Recording — systemPreferences doesn't have a direct API for this,
  // but attempting desktopCapturer.getSources will trigger the system prompt.
  // Accessibility permission for input simulation:
  const trusted = systemPreferences.isTrustedAccessibilityClient(true);
  if (!trusted) {
    console.warn(
      '[permissions] Accessibility not granted — input simulation will fail. ' +
        'Please enable in System Preferences → Privacy → Accessibility.'
    );
  }
}

app.whenReady().then(async () => {
  await requestMacPermissions();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  destroySignalingClient();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Auto-update setup (imported dynamically to avoid crashes in dev)
if (app.isPackaged) {
  import('electron-updater').then(({ autoUpdater }) => {
    autoUpdater.checkForUpdatesAndNotify();
  });
}
