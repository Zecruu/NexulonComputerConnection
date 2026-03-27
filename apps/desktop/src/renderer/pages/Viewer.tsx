import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SimplePeer from 'simple-peer';

const { signaling, capture, webrtc } = window.nexulon;

export function Viewer() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<SimplePeer.Instance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hudVisible, setHudVisible] = useState(true);
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [connected, setConnected] = useState(false);
  const targetDeviceId = sessionStorage.getItem('nexulon-peer-id') || '';
  const agentId = sessionStorage.getItem('nexulon-agent-id') || '';
  const returnPath = agentId ? '/portal' : '/help';

  // Screen size of the remote host (for coordinate normalization)
  const screenSizeRef = useRef({ width: 1920, height: 1080 });

  const disconnect = useCallback(() => {
    peerRef.current?.destroy();
    peerRef.current = null;
    signaling.disconnectSession();
    signaling.removeAllListeners();
    navigate(returnPath);
  }, [navigate, returnPath]);

  useEffect(() => {
    if (!targetDeviceId) {
      navigate(returnPath);
      return;
    }

    let destroyed = false;

    async function initPeer() {
      // If agent is connecting from support portal, register with relay first
      if (agentId) {
        await signaling.connect({ deviceId: agentId });
        // Wait briefly for registration
        await new Promise((r) => setTimeout(r, 1000));
        await signaling.connectTo({ targetDeviceId });
      }

      const iceServers = await webrtc.getIceServers();

      // Create the WebRTC peer as initiator (viewer initiates)
      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        config: { iceServers },
      });

      peerRef.current = peer;

      // Send signals to the host via relay
      peer.on('signal', (data) => {
        if (destroyed) return;
        signaling.sendSignal({ targetDeviceId, data });
      });

      // Receive signals from the host via relay
      signaling.onSignal((payload) => {
        if (destroyed) return;
        if (payload.fromDeviceId === targetDeviceId) {
          peer.signal(payload.data as SimplePeer.SignalData);
        }
      });

      // Connection established
      peer.on('connect', () => {
        if (destroyed) return;
        setConnected(true);

        // Request screen size from host via data channel
        peer.send(JSON.stringify({ type: 'request-screen-size' }));
      });

      // Receive remote video stream
      peer.on('stream', (stream: MediaStream) => {
        if (destroyed || !videoRef.current) return;
        videoRef.current.srcObject = stream;
      });

      // Receive data channel messages (screen size info, etc.)
      peer.on('data', (rawData: Uint8Array) => {
        try {
          const msg = JSON.parse(new TextDecoder().decode(rawData));
          if (msg.type === 'screen-size') {
            screenSizeRef.current = {
              width: msg.width,
              height: msg.height,
            };
          }
        } catch {
          // Ignore parse errors
        }
      });

      peer.on('close', () => {
        if (!destroyed) disconnect();
      });

      peer.on('error', (err) => {
        console.error('[viewer] Peer error:', err);
        if (!destroyed) disconnect();
      });

      // Handle host disconnection
      signaling.onPeerDisconnected(() => {
        if (!destroyed) disconnect();
      });
    }

    initPeer();

    return () => {
      destroyed = true;
      peerRef.current?.destroy();
      peerRef.current = null;
      signaling.removeAllListeners();
    };
  }, [targetDeviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Input forwarding ---

  const sendInput = useCallback(
    (event: {
      type: string;
      x?: number;
      y?: number;
      button?: number;
      deltaX?: number;
      deltaY?: number;
      key?: string;
      code?: string;
    }) => {
      const peer = peerRef.current;
      if (peer && connected) {
        try {
          peer.send(JSON.stringify(event));
        } catch {
          // Data channel not ready yet
        }
      }
    },
    [connected]
  );

  const normalizeCoords = useCallback(
    (clientX: number, clientY: number) => {
      const video = videoRef.current;
      if (!video) return { x: 0, y: 0 };
      const rect = video.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = normalizeCoords(e.clientX, e.clientY);
      sendInput({ type: 'mousemove', x, y });
    },
    [normalizeCoords, sendInput]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const { x, y } = normalizeCoords(e.clientX, e.clientY);
      sendInput({ type: 'mousedown', x, y, button: e.button });
    },
    [normalizeCoords, sendInput]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = normalizeCoords(e.clientX, e.clientY);
      sendInput({ type: 'mouseup', x, y, button: e.button });
    },
    [normalizeCoords, sendInput]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      sendInput({ type: 'scroll', deltaX: e.deltaX, deltaY: e.deltaY });
    },
    [sendInput]
  );

  // Global keyboard forwarding when viewer is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      sendInput({ type: 'keydown', key: e.key, code: e.code });
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      sendInput({ type: 'keyup', key: e.key, code: e.code });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [sendInput]);

  // Auto-hide HUD after 3 seconds of mouse inactivity
  const resetHudTimeout = useCallback(() => {
    setHudVisible(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setHudVisible(false), 3000);
  }, []);

  useEffect(() => {
    resetHudTimeout();
    return () => {
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    };
  }, [resetHudTimeout]);

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-black overflow-hidden cursor-none"
      onMouseMove={(e) => {
        resetHudTimeout();
        handleMouseMove(e);
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Remote screen */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain"
      />

      {/* HUD overlay */}
      <div
        className={`absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          hudVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <span className="text-sm text-white/80 font-mono">
          Connected to{' '}
          <span className="font-bold text-white">
            {targetDeviceId.slice(0, 3)}-{targetDeviceId.slice(3)}
          </span>
        </span>
        <button
          onClick={disconnect}
          className="rounded-md bg-destructive px-3 py-1 text-sm font-medium text-white hover:bg-destructive/80 transition-colors cursor-pointer"
        >
          Disconnect
        </button>
      </div>

      {/* Connection loading state */}
      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-white/80 text-sm">
              Connecting to {targetDeviceId.slice(0, 3)}-{targetDeviceId.slice(3)}...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
