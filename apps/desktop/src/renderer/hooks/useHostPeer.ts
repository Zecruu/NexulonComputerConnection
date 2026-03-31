import { useEffect, useRef, useCallback } from 'react';
import SimplePeer from 'simple-peer';

const { signaling, capture, input, webrtc } = window.nexulon;

/**
 * Hook that manages the host-side peer connection.
 * When a viewer sends a session-request, this creates a non-initiator peer,
 * starts screen capture, and handles incoming input events.
 */
export function useHostPeer(enabled: boolean) {
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    // Stop all media tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    peerRef.current?.destroy();
    peerRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    let destroyed = false;

    // Listen for incoming session requests from viewers
    signaling.onSessionRequest(async (fromDeviceId: string) => {
      if (destroyed || peerRef.current) return; // Only one session at a time

      const iceServers = await webrtc.getIceServers();

      // Start screen capture BEFORE creating peer — simple-peer needs
      // the stream at creation time for the viewer to receive it
      let stream: MediaStream | null = null;
      try {
        const sources = await capture.getSources();
        if (sources.length > 0) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sources[0].id,
                maxWidth: 2560,
                maxHeight: 1440,
                maxFrameRate: 30,
              },
            } as MediaTrackConstraints,
          });
          streamRef.current = stream;
          console.log('[host] Screen capture started');
        }
      } catch (err) {
        console.error('[host] Failed to start capture:', err);
      }

      // Create peer with the stream attached
      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        config: { iceServers },
        stream: stream || undefined,
      });

      peerRef.current = peer;

      // Relay signals to the viewer
      peer.on('signal', (data) => {
        if (destroyed) return;
        signaling.sendSignal({ targetDeviceId: fromDeviceId, data });
      });

      // Receive signals from the viewer
      signaling.onSignal((payload) => {
        if (destroyed) return;
        if (payload.fromDeviceId === fromDeviceId) {
          peer.signal(payload.data as SimplePeer.SignalData);
        }
      });

      peer.on('connect', async () => {
        if (destroyed) return;
        console.log('[host] Peer connected, sending screen size');

        try {
          const screenSize = await capture.getScreenSize();
          peer.send(
            JSON.stringify({
              type: 'screen-size',
              width: screenSize.width,
              height: screenSize.height,
            })
          );
        } catch (err) {
          console.error('[host] Failed to send screen size:', err);
        }
      });

      // Handle input events from the viewer
      // File receive buffer
      let fileBuffer: { name: string; size: number; chunks: string[] } | null = null;

      peer.on('data', (rawData: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(rawData));

          // Handle file transfers
          if (msg.type === 'file-start') {
            fileBuffer = { name: msg.name, size: msg.size, chunks: [] };
            console.log('[host] Receiving file:', msg.name, msg.size, 'bytes');
            return;
          }
          if (msg.type === 'file-chunk' && fileBuffer) {
            fileBuffer.chunks.push(msg.data);
            return;
          }
          if (msg.type === 'file-end' && fileBuffer) {
            const { name, chunks } = fileBuffer;
            const byteArrays = chunks.map((b64: string) => {
              const binary = atob(b64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              return bytes;
            });
            const totalLength = byteArrays.reduce((sum: number, arr: Uint8Array) => sum + arr.length, 0);
            const fullData = new Uint8Array(totalLength);
            let offset = 0;
            for (const arr of byteArrays) { fullData.set(arr, offset); offset += arr.length; }

            window.nexulon.files.saveToDownloads(name, fullData);
            console.log('[host] File saved:', name);
            fileBuffer = null;
            return;
          }

          if (msg.type === 'request-screen-size') {
            capture.getScreenSize().then((size) => {
              peer.send(
                JSON.stringify({
                  type: 'screen-size',
                  width: size.width,
                  height: size.height,
                })
              );
            });
            return;
          }
          // Forward input event to main process for simulation
          input.simulate(msg).catch((err: any) => {
            console.error('[host] Input simulate error:', err);
          });
        } catch (err) {
          console.error('[host] Data parse error:', err);
        }
      });

      peer.on('close', () => {
        if (!destroyed) cleanup();
      });

      peer.on('error', (err) => {
        console.error('[host] Peer error:', err);
        if (!destroyed) cleanup();
      });
    });

    return () => {
      destroyed = true;
      cleanup();
    };
  }, [enabled, cleanup]);

  return { cleanup };
}
