import { ipcMain, BrowserWindow, dialog, app, Notification } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import {
  getSignalingClient,
  destroySignalingClient,
  ICE_SERVERS,
} from './peer.js';
import {
  getCaptureSources,
  getScreenSize,
  QUALITY_PRESETS,
  type QualityPreset,
} from './capture.js';
import { handleInputEvent, InputEventSchema } from './input.js';

// --- IPC payload schemas ---

const StartHostSchema = z.object({
  deviceId: z.string().min(1).max(10),
});

const ConnectToSchema = z.object({
  targetDeviceId: z.string().min(1).max(10),
});

const SignalDataSchema = z.object({
  targetDeviceId: z.string().min(1).max(10),
  data: z.unknown(),
});

const QualitySchema = z.enum(['low', 'medium', 'high']);

/**
 * Registers all IPC handlers. Call once at app startup.
 */
export function registerIpcHandlers(): void {
  // --- Signaling ---

  ipcMain.handle('signaling:connect', async (_event, payload: unknown) => {
    const { deviceId } = StartHostSchema.parse(payload);
    const client = getSignalingClient();
    client.connect(deviceId);

    // Forward relay events to the renderer
    const win = BrowserWindow.fromWebContents(_event.sender);
    if (!win) return;

    const forward = (channel: string) => {
      client.on(channel, (...args: unknown[]) => {
        if (!win.isDestroyed()) {
          win.webContents.send(`signaling:${channel}`, ...args);
        }
      });
    };

    forward('registered');
    forward('session-request');
    forward('signal');
    forward('peer-disconnected');
    forward('relay-error');
    forward('connected');
    forward('disconnected');
  });

  ipcMain.handle('signaling:set-available', async (_event, available: boolean) => {
    getSignalingClient().setAvailable(available);
  });

  ipcMain.handle('signaling:connect-to', async (_event, payload: unknown) => {
    const { targetDeviceId } = ConnectToSchema.parse(payload);
    getSignalingClient().connectTo(targetDeviceId);
  });

  ipcMain.handle('signaling:send-signal', async (_event, payload: unknown) => {
    const { targetDeviceId, data } = SignalDataSchema.parse(payload);
    getSignalingClient().sendSignal(targetDeviceId, data);
  });

  ipcMain.handle('signaling:need-help', async (_event, payload: unknown) => {
    const schema = z.object({
      deviceId: z.string().min(1).max(10),
      needsHelp: z.boolean(),
    });
    const { deviceId, needsHelp } = schema.parse(payload);
    getSignalingClient().setNeedHelp(deviceId, needsHelp);
  });

  ipcMain.handle('signaling:disconnect-session', async () => {
    getSignalingClient().disconnectSession();
  });

  ipcMain.handle('signaling:destroy', async () => {
    destroySignalingClient();
  });

  // --- Capture ---

  ipcMain.handle('capture:get-sources', async () => {
    return getCaptureSources();
  });

  ipcMain.handle('capture:get-screen-size', async () => {
    return getScreenSize();
  });

  ipcMain.handle('capture:get-quality-constraints', async (_event, quality: unknown) => {
    const preset = QualitySchema.parse(quality) as QualityPreset;
    return QUALITY_PRESETS[preset];
  });

  // --- Input ---

  ipcMain.handle('input:simulate', async (_event, payload: unknown) => {
    const event = InputEventSchema.parse(payload);
    await handleInputEvent(event);
  });

  // --- ICE config ---

  ipcMain.handle('webrtc:get-ice-servers', async () => {
    return ICE_SERVERS;
  });

  // --- File transfer ---

  ipcMain.handle('files:save-to-downloads', async (_event, fileName: string, data: Uint8Array) => {
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, fileName);

    // Avoid overwriting — append (1), (2), etc.
    let finalPath = filePath;
    let counter = 1;
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    while (fs.existsSync(finalPath)) {
      finalPath = path.join(downloadsPath, `${base} (${counter})${ext}`);
      counter++;
    }

    fs.writeFileSync(finalPath, Buffer.from(data));

    // Show system notification
    if (Notification.isSupported()) {
      new Notification({
        title: 'File Received',
        body: `Saved to Downloads: ${path.basename(finalPath)}`,
      }).show();
    }

    return finalPath;
  });

  ipcMain.handle('files:pick-file', async (_event) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      title: 'Select a file to send',
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      data: new Uint8Array(data),
      size: data.length,
    };
  });

  ipcMain.handle('files:get-downloads-path', async () => {
    return app.getPath('downloads');
  });
}
