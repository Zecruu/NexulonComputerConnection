import type { NexulonAPI } from '../preload/index.js';

declare global {
  interface Window {
    nexulon: NexulonAPI;
  }
}

export {};
