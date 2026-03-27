/** In-memory device registry: maps deviceId → socket state */

interface DeviceEntry {
  socketId: string;
  available: boolean;
  connectedTo: string | null; // deviceId of the peer currently connected
}

const devices = new Map<string, DeviceEntry>();

export function registerDevice(deviceId: string, socketId: string): void {
  devices.set(deviceId, { socketId, available: false, connectedTo: null });
}

export function unregisterDevice(deviceId: string): void {
  devices.delete(deviceId);
}

export function findDeviceBySocketId(socketId: string): string | undefined {
  for (const [deviceId, entry] of devices) {
    if (entry.socketId === socketId) return deviceId;
  }
  return undefined;
}

export function getDevice(deviceId: string): DeviceEntry | undefined {
  return devices.get(deviceId);
}

export function setAvailable(deviceId: string, available: boolean): void {
  const entry = devices.get(deviceId);
  if (entry) entry.available = available;
}

export function setConnected(deviceId: string, peerId: string | null): void {
  const entry = devices.get(deviceId);
  if (entry) entry.connectedTo = peerId;
}

export function getSocketId(deviceId: string): string | undefined {
  return devices.get(deviceId)?.socketId;
}

export function isAvailable(deviceId: string): boolean {
  const entry = devices.get(deviceId);
  return entry?.available === true && entry.connectedTo === null;
}

export function getAllDevices(): Map<string, DeviceEntry> {
  return devices;
}
