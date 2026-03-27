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
import { Device } from './models/device.js';

// --- Zod schemas for all incoming messages ---

const RegisterSchema = z.object({
  deviceId: z.string().min(1).max(10),
  name: z.string().optional(),
  os: z.string().optional(),
});

const AvailableSchema = z.object({
  deviceId: z.string().min(1).max(10),
});

const NeedHelpSchema = z.object({
  deviceId: z.string().min(1).max(10),
  needsHelp: z.boolean(),
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

    // Support portal clients join a room to receive real-time device updates
    socket.on('join-support', () => {
      socket.join('support-portal');
      console.log(`[support] ${socket.id} joined support portal`);
    });

    socket.on('register', async (payload: unknown) => {
      const parsed = RegisterSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', { message: 'Invalid register payload' });
        return;
      }
      const { deviceId, name, os } = parsed.data;
      registerDevice(deviceId, socket.id);

      // Upsert device in MongoDB
      try {
        await Device.findOneAndUpdate(
          { deviceId },
          {
            deviceId,
            online: true,
            lastSeen: new Date(),
            ...(name && { name }),
            ...(os && { os }),
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error('[db] Failed to upsert device:', err);
      }

      socket.emit('registered', { deviceId });

      // Notify support portal of device status change
      const device = await Device.findOne({ deviceId }).lean();
      if (device) {
        io.to('support-portal').emit('device-updated', device);
      }

      console.log(`[register] ${deviceId} → ${socket.id}`);
    });

    socket.on('need-help', async (payload: unknown) => {
      const parsed = NeedHelpSchema.safeParse(payload);
      if (!parsed.success) return;
      const { deviceId, needsHelp } = parsed.data;

      // Update in-memory registry
      setAvailable(deviceId, needsHelp);

      // Persist to MongoDB
      try {
        const device = await Device.findOneAndUpdate(
          { deviceId },
          { needsHelp, lastSeen: new Date() },
          { new: true }
        );
        if (device) {
          // Broadcast to all support portal clients
          io.to('support-portal').emit('device-updated', device.toObject());
        }
      } catch (err) {
        console.error('[db] Failed to update need-help:', err);
      }

      console.log(`[need-help] ${deviceId} → ${needsHelp}`);
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

    socket.on('disconnect', async () => {
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

        // Mark device offline in MongoDB
        try {
          const updated = await Device.findOneAndUpdate(
            { deviceId },
            { online: false, needsHelp: false, lastSeen: new Date() },
            { new: true }
          );
          if (updated) {
            io.to('support-portal').emit('device-updated', updated.toObject());
          }
        } catch (err) {
          console.error('[db] Failed to mark device offline:', err);
        }

        console.log(`[disconnect] ${deviceId} (${socket.id})`);
      }
    });
  });
}
