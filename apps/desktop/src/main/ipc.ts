import { ipcMain, BrowserWindow } from 'electron';
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
}
