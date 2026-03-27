import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  registerDevice,
  unregisterDevice,
  findDeviceBySocketId,
  getDevice,
  setAvailable,
  setConnected,
  getSocketId,
  isAvailable,
} from './registry.js';

// --- Zod schemas for all incoming messages ---

const RegisterSchema = z.object({
  deviceId: z.string().min(1).max(10),
});

const AvailableSchema = z.object({
  deviceId: z.string().min(1).max(10),
});

const ConnectToSchema = z.object({
  targetDeviceId: z.string().min(1).max(10),
});

const SignalSchema = z.object({
  targetDeviceId: z.string().min(1).max(10),
  data: z.unknown(),
});

const DisconnectSchema = z.object({
  deviceId: z.string().min(1).max(10),
});

export function setupSignaling(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[connect] ${socket.id}`);

    socket.on('register', (payload: unknown) => {
      const parsed = RegisterSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid register payload' });
        return;
      }
      const { deviceId } = parsed.data;
      registerDevice(deviceId, socket.id);
      socket.emit('registered', { deviceId });
      console.log(`[register] ${deviceId} → ${socket.id}`);
    });

    socket.on('available', (payload: unknown) => {
      const parsed = AvailableSchema.safeParse(payload);
      if (!parsed.success) return;
      const { deviceId } = parsed.data;
      setAvailable(deviceId, true);
      console.log(`[available] ${deviceId}`);
    });

    socket.on('unavailable', (payload: unknown) => {
      const parsed = AvailableSchema.safeParse(payload);
      if (!parsed.success) return;
      const { deviceId } = parsed.data;
      setAvailable(deviceId, false);
      console.log(`[unavailable] ${deviceId}`);
    });

    socket.on('connect-to', (payload: unknown) => {
      const parsed = ConnectToSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid connect-to payload' });
        return;
      }
      const { targetDeviceId } = parsed.data;
      const fromDeviceId = findDeviceBySocketId(socket.id);
      if (!fromDeviceId) {
        socket.emit('error', { message: 'You must register first' });
        return;
      }

      if (!isAvailable(targetDeviceId)) {
        socket.emit('error', { message: 'Target device is not available' });
        return;
      }

      const targetSocketId = getSocketId(targetDeviceId);
      if (!targetSocketId) {
        socket.emit('error', { message: 'Target device not found' });
        return;
      }

      // Notify host that a viewer wants to connect
      io.to(targetSocketId).emit('session-request', { fromDeviceId });

      // Mark both as connected to each other
      setConnected(targetDeviceId, fromDeviceId);
      setConnected(fromDeviceId, targetDeviceId);

      console.log(`[connect-to] ${fromDeviceId} → ${targetDeviceId}`);
    });

    socket.on('signal', (payload: unknown) => {
      const parsed = SignalSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid signal payload' });
        return;
      }
      const { targetDeviceId, data } = parsed.data;
      const fromDeviceId = findDeviceBySocketId(socket.id);
      if (!fromDeviceId) return;

      const targetSocketId = getSocketId(targetDeviceId);
      if (!targetSocketId) return;

      // Relay the WebRTC signal data to the target
      io.to(targetSocketId).emit('signal', { fromDeviceId, data });
    });

    socket.on('disconnect-session', (payload: unknown) => {
      const parsed = DisconnectSchema.safeParse(payload);
      if (!parsed.success) return;
      const { deviceId } = parsed.data;

      const device = getDevice(deviceId);
      if (device?.connectedTo) {
        const peerSocketId = getSocketId(device.connectedTo);
        if (peerSocketId) {
          io.to(peerSocketId).emit('peer-disconnected', {});
        }
        setConnected(device.connectedTo, null);
      }
      setConnected(deviceId, null);
      console.log(`[disconnect-session] ${deviceId}`);
    });

    socket.on('disconnect', () => {
      const deviceId = findDeviceBySocketId(socket.id);
      if (deviceId) {
        const device = getDevice(deviceId);
        // Notify connected peer if any
        if (device?.connectedTo) {
          const peerSocketId = getSocketId(device.connectedTo);
          if (peerSocketId) {
            io.to(peerSocketId).emit('peer-disconnected', {});
          }
          setConnected(device.connectedTo, null);
        }
        unregisterDevice(deviceId);
        console.log(`[disconnect] ${deviceId} (${socket.id})`);
      }
    });
  });
}
