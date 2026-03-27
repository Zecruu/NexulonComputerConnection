import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'node:events';

// Assumption: simple-peer will be used in the renderer process where WebRTC APIs
// are available. The main process handles socket.io signaling only and relays
// WebRTC signals between the renderer and the relay server.

const RELAY_URL = process.env.RELAY_URL || 'http://localhost:3001';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// TURN config — set env vars when self-hosting coturn
const TURN_SERVERS = process.env.TURN_URL
  ? [
      {
        urls: process.env.TURN_URL,
        username: process.env.TURN_USER || 'nexulon',
        credential: process.env.TURN_PASS || 'nexulon',
      },
    ]
  : [];

export const ICE_SERVERS = [...STUN_SERVERS, ...TURN_SERVERS];

export class SignalingClient extends EventEmitter {
  private socket: Socket | null = null;
  private _deviceId: string = '';

  get deviceId(): string {
    return this._deviceId;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  connect(deviceId: string): void {
    this._deviceId = deviceId;

    this.socket = io(RELAY_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.socket!.emit('register', { deviceId });
      this.emit('connected');
    });

    this.socket.on('registered', (data: { deviceId: string }) => {
      this.emit('registered', data.deviceId);
    });

    this.socket.on('session-request', (data: { fromDeviceId: string }) => {
      this.emit('session-request', data.fromDeviceId);
    });

    this.socket.on('signal', (data: { fromDeviceId: string; data: unknown }) => {
      this.emit('signal', data);
    });

    this.socket.on('peer-disconnected', () => {
      this.emit('peer-disconnected');
    });

    this.socket.on('error', (data: { message: string }) => {
      this.emit('relay-error', data.message);
    });

    this.socket.on('disconnect', () => {
      this.emit('disconnected');
    });
  }

  setAvailable(available: boolean): void {
    if (!this.socket) return;
    this.socket.emit(available ? 'available' : 'unavailable', {
      deviceId: this._deviceId,
    });
  }

  connectTo(targetDeviceId: string): void {
    if (!this.socket) return;
    this.socket.emit('connect-to', { targetDeviceId });
  }

  sendSignal(targetDeviceId: string, data: unknown): void {
    if (!this.socket) return;
    this.socket.emit('signal', { targetDeviceId, data });
  }

  disconnectSession(): void {
    if (!this.socket) return;
    this.socket.emit('disconnect-session', { deviceId: this._deviceId });
  }

  destroy(): void {
    this.disconnectSession();
    this.socket?.disconnect();
    this.socket = null;
    this.removeAllListeners();
  }
}

// Singleton for the main process
let signalingClient: SignalingClient | null = null;

export function getSignalingClient(): SignalingClient {
  if (!signalingClient) {
    signalingClient = new SignalingClient();
  }
  return signalingClient;
}

export function destroySignalingClient(): void {
  signalingClient?.destroy();
  signalingClient = null;
}
