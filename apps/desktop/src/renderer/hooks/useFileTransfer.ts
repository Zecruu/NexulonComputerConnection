import { useCallback, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';

const CHUNK_SIZE = 16 * 1024; // 16KB chunks for WebRTC data channel

export interface FileTransferProgress {
  fileName: string;
  direction: 'sending' | 'receiving';
  percent: number;
  done: boolean;
}

/**
 * Hook for sending/receiving files over a WebRTC data channel.
 *
 * Protocol:
 *   Sender  → { type: 'file-start', name, size }
 *   Sender  → { type: 'file-chunk', index, data (base64) }
 *   Sender  → { type: 'file-end', name }
 */
export function useFileTransfer(peerRef: React.RefObject<SimplePeer.Instance | null>) {
  const [progress, setProgress] = useState<FileTransferProgress | null>(null);
  const receiveBufferRef = useRef<{ name: string; size: number; chunks: string[] } | null>(null);

  const sendFile = useCallback(async (file?: { name: string; data: Uint8Array; size: number } | null) => {
    const peer = peerRef.current;
    if (!peer || !file) return;

    const { name, data, size } = file;
    setProgress({ fileName: name, direction: 'sending', percent: 0, done: false });

    // Send start marker
    peer.send(JSON.stringify({ type: 'file-start', name, size }));

    // Send chunks
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, data.length);
      const chunk = data.slice(start, end);

      // Convert to base64 for JSON transport
      const b64 = btoa(String.fromCharCode(...chunk));
      peer.send(JSON.stringify({ type: 'file-chunk', index: i, data: b64 }));

      const percent = Math.round(((i + 1) / totalChunks) * 100);
      setProgress({ fileName: name, direction: 'sending', percent, done: false });

      // Yield to event loop every 10 chunks to prevent freezing
      if (i % 10 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Send end marker
    peer.send(JSON.stringify({ type: 'file-end', name }));
    setProgress({ fileName: name, direction: 'sending', percent: 100, done: true });

    // Clear after 3s
    setTimeout(() => setProgress(null), 3000);
  }, [peerRef]);

  const handleIncomingData = useCallback((msg: any) => {
    if (msg.type === 'file-start') {
      receiveBufferRef.current = { name: msg.name, size: msg.size, chunks: [] };
      setProgress({ fileName: msg.name, direction: 'receiving', percent: 0, done: false });
      return true;
    }

    if (msg.type === 'file-chunk' && receiveBufferRef.current) {
      receiveBufferRef.current.chunks.push(msg.data);
      const received = receiveBufferRef.current.chunks.length * CHUNK_SIZE;
      const percent = Math.min(100, Math.round((received / receiveBufferRef.current.size) * 100));
      setProgress({ fileName: receiveBufferRef.current.name, direction: 'receiving', percent, done: false });
      return true;
    }

    if (msg.type === 'file-end' && receiveBufferRef.current) {
      const { name, chunks } = receiveBufferRef.current;

      // Reassemble from base64 chunks
      const byteArrays = chunks.map((b64) => {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
      });

      const totalLength = byteArrays.reduce((sum, arr) => sum + arr.length, 0);
      const fullData = new Uint8Array(totalLength);
      let offset = 0;
      for (const arr of byteArrays) {
        fullData.set(arr, offset);
        offset += arr.length;
      }

      // Save to downloads
      window.nexulon.files.saveToDownloads(name, fullData);

      setProgress({ fileName: name, direction: 'receiving', percent: 100, done: true });
      receiveBufferRef.current = null;

      setTimeout(() => setProgress(null), 3000);
      return true;
    }

    return false; // Not a file transfer message
  }, []);

  return { progress, sendFile, handleIncomingData };
}
