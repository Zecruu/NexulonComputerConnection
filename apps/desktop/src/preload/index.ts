import { contextBridge, ipcRenderer } from 'electron';

// Type-safe API exposed to the renderer via contextBridge
const api = {
  // --- Signaling ---
  signaling: {
    connect: (payload: { deviceId: string }) =>
      ipcRenderer.invoke('signaling:connect', payload),
    setAvailable: (available: boolean) =>
      ipcRenderer.invoke('signaling:set-available', available),
    connectTo: (payload: { targetDeviceId: string }) =>
      ipcRenderer.invoke('signaling:connect-to', payload),
    sendSignal: (payload: { targetDeviceId: string; data: unknown }) =>
      ipcRenderer.invoke('signaling:send-signal', payload),
    disconnectSession: () =>
      ipcRenderer.invoke('signaling:disconnect-session'),
    setNeedHelp: (payload: { deviceId: string; needsHelp: boolean }) =>
      ipcRenderer.invoke('signaling:need-help', payload),
    destroy: () =>
      ipcRenderer.invoke('signaling:destroy'),

    // Event listeners from relay → renderer
    onRegistered: (cb: (deviceId: string) => void) =>
      ipcRenderer.on('signaling:registered', (_e, deviceId) => cb(deviceId)),
    onSessionRequest: (cb: (fromDeviceId: string) => void) =>
      ipcRenderer.on('signaling:session-request', (_e, fromDeviceId) => cb(fromDeviceId)),
    onSignal: (cb: (data: { fromDeviceId: string; data: unknown }) => void) =>
      ipcRenderer.on('signaling:signal', (_e, data) => cb(data)),
    onPeerDisconnected: (cb: () => void) =>
      ipcRenderer.on('signaling:peer-disconnected', () => cb()),
    onRelayError: (cb: (message: string) => void) =>
      ipcRenderer.on('signaling:relay-error', (_e, message) => cb(message)),
    onConnected: (cb: () => void) =>
      ipcRenderer.on('signaling:connected', () => cb()),
    onDisconnected: (cb: () => void) =>
      ipcRenderer.on('signaling:disconnected', () => cb()),

    removeAllListeners: () => {
      const channels = [
        'signaling:registered',
        'signaling:session-request',
        'signaling:signal',
        'signaling:peer-disconnected',
        'signaling:relay-error',
        'signaling:connected',
        'signaling:disconnected',
      ];
      channels.forEach((ch) => ipcRenderer.removeAllListeners(ch));
    },
  },

  // --- Capture ---
  capture: {
    getSources: () => ipcRenderer.invoke('capture:get-sources'),
    getScreenSize: () => ipcRenderer.invoke('capture:get-screen-size'),
    getQualityConstraints: (quality: 'low' | 'medium' | 'high') =>
      ipcRenderer.invoke('capture:get-quality-constraints', quality),
  },

  // --- Input ---
  input: {
    simulate: (event: {
      type: string;
      x?: number;
      y?: number;
      button?: number;
      deltaX?: number;
      deltaY?: number;
      key?: string;
      code?: string;
    }) => ipcRenderer.invoke('input:simulate', event),
  },

  // --- WebRTC ---
  webrtc: {
    getIceServers: () => ipcRenderer.invoke('webrtc:get-ice-servers'),
  },
} as const;

// contextIsolation is disabled, so assign directly to window
// contextBridge.exposeInMainWorld only works with contextIsolation: true
(window as any).nexulon = api;

// Type declaration for renderer access
export type NexulonAPI = typeof api;
