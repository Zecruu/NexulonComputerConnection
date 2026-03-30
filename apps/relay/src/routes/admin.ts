import { Router } from 'express';
import { requireAuth, getAuth } from '@clerk/express';
import { clerkClient } from '@clerk/express';

const router = Router();
const ADMIN_EMAIL = 'nomnk5138@gmail.com';

// All admin routes require Clerk auth + admin email check
router.use(requireAuth());
router.use(async (req, res, next) => {
  try {
    const auth = getAuth(req);
    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await clerkClient.users.getUser(auth.userId);
    const email = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    )?.emailAddress;
    if (email !== ADMIN_EMAIL) {
      res.status(403).json({ error: 'Admin access only' });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
  }
});

// GET /api/admin/users — list all Clerk users
router.get('/users', async (_req, res) => {
  try {
    const users = await clerkClient.users.getUserList({ limit: 100 });
    const mapped = users.data.map((u) => ({
      id: u.id,
      email: u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
        ?.emailAddress,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/users — create a new support agent
router.post('/users', async (req, res) => {
  try {
    const { email, password, username, firstName, lastName } = req.body;
    if (!email || !password || !username) {
      res.status(400).json({ error: 'email, password, and username are required' });
      return;
    }
    const user = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      username,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
    });
    res.json({
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      username: user.username,
    });
  } catch (err: any) {
    const msg = err?.errors?.[0]?.longMessage || err?.message || 'Failed to create user';
    res.status(400).json({ error: msg });
  }
});

// DELETE /api/admin/users/:userId — delete a user
router.delete('/users/:userId', async (req, res) => {
  try {
    await clerkClient.users.deleteUser(req.params.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
