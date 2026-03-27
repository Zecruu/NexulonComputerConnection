import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { setupSignaling } from './signaling.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*', // Electron apps connect from file:// or localhost
    methods: ['GET', 'POST'],
  },
  // Increase ping timeout for flaky connections
  pingTimeout: 30_000,
  pingInterval: 10_000,
});

// Health check endpoint for Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

setupSignaling(io);

const PORT = parseInt(process.env.PORT || '3001', 10);

httpServer.listen(PORT, () => {
  console.log(`Relay server listening on port ${PORT}`);
});
