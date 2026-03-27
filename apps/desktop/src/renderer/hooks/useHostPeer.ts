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

      // Create peer as non-initiator (host receives the offer)
      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        config: { iceServers },
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

        try {
          // Get screen capture source
          const sources = await capture.getSources();
          if (sources.length === 0) return;

          const screenSize = await capture.getScreenSize();

          // Start screen capture using getUserMedia with the source ID
          // In Electron, desktopCapturer sources work with getUserMedia
          const stream = await navigator.mediaDevices.getUserMedia({
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

          // Add the stream to the peer connection
          stream.getTracks().forEach((track) => {
            peer.addTrack(track, stream);
          });

          // Send screen size to viewer for coordinate mapping
          peer.send(
            JSON.stringify({
              type: 'screen-size',
              width: screenSize.width,
              height: screenSize.height,
            })
          );
        } catch (err) {
          console.error('[host] Failed to start capture:', err);
        }
      });

      // Handle input events from the viewer
      peer.on('data', (rawData: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(rawData));
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
          input.simulate(msg);
        } catch {
          // Ignore parse errors
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
