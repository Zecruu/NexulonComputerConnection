import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { Device } from '../models/device.js';

const router = Router();

// All routes require Clerk authentication (support agents only)
router.use(requireAuth());

// GET /api/devices — list all registered devices
router.get('/', async (_req, res) => {
  try {
    const devices = await Device.find().sort({ needsHelp: -1, lastSeen: -1 });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// GET /api/devices/:deviceId — single device
router.get('/:deviceId', async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// PATCH /api/devices/:deviceId — update device name
router.patch('/:deviceId', async (req, res) => {
  try {
    const { name } = req.body;
    const device = await Device.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { name },
      { new: true }
    );
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// DELETE /api/devices/:deviceId — remove a device
router.delete('/:deviceId', async (req, res) => {
  try {
    await Device.findOneAndDelete({ deviceId: req.params.deviceId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

export default router;
