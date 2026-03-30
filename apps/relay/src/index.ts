import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { clerkMiddleware } from '@clerk/express';
import { connectDB } from './db.js';
import { setupSignaling } from './signaling.js';
import devicesRouter from './routes/devices.js';
import adminRouter from './routes/admin.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30_000,
  pingInterval: 10_000,
});

// Middleware
app.use(express.json());
app.use(clerkMiddleware());

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Device management API (Clerk-protected)
app.use('/api/devices', devicesRouter);

// Admin API (admin email only)
app.use('/api/admin', adminRouter);

// Signaling
setupSignaling(io);

const PORT = parseInt(process.env.PORT || '3001', 10);

// Connect to MongoDB then start server
connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Relay server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[startup] Failed to connect to MongoDB:', err);
    process.exit(1);
  });
