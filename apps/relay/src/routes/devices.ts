import { Router } from 'express';
import { requireAuth, getAuth, clerkClient } from '@clerk/express';
import { Device } from '../models/device.js';

const router = Router();
const ADMIN_EMAIL = 'nomnk5138@gmail.com';

// All routes require Clerk authentication
router.use(requireAuth());

// Helper to get current user's email
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return (
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress || null
    );
  } catch {
    return null;
  }
}

// GET /api/devices — list devices assigned to current agent (admin sees all)
router.get('/', async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const email = await getUserEmail(auth.userId);
    const isAdmin = email === ADMIN_EMAIL;

    const filter = isAdmin ? {} : { assignedTo: auth.userId };
    const devices = await Device.find(filter).sort({ needsHelp: -1, lastSeen: -1 });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// POST /api/devices/claim — claim a device by its 6-char code
router.post('/claim', async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { deviceId } = req.body;
    if (!deviceId || typeof deviceId !== 'string') {
      res.status(400).json({ error: 'deviceId is required' });
      return;
    }

    const code = deviceId.replace(/[-\s]/g, '').toUpperCase();
    const device = await Device.findOne({ deviceId: code });

    if (!device) {
      res.status(404).json({ error: 'Device not found. Make sure the customer has opened the app.' });
      return;
    }

    if (device.assignedTo && device.assignedTo !== auth.userId) {
      res.status(409).json({ error: 'Device is already assigned to another agent' });
      return;
    }

    const email = await getUserEmail(auth.userId);
    device.assignedTo = auth.userId;
    device.assignedEmail = email;
    await device.save();

    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Failed to claim device' });
  }
});

// POST /api/devices/unclaim — release a device
router.post('/unclaim', async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { deviceId } = req.body;
    const email = await getUserEmail(auth.userId);
    const isAdmin = email === ADMIN_EMAIL;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Only the assigned agent or admin can unclaim
    if (device.assignedTo !== auth.userId && !isAdmin) {
      res.status(403).json({ error: 'Not your device' });
      return;
    }

    device.assignedTo = null;
    device.assignedEmail = null;
    await device.save();
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Failed to unclaim device' });
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
