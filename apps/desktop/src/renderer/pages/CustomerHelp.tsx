import { useState, useEffect, useCallback } from 'react';
import { StatusBadge, type ConnectionStatus } from '../components/StatusBadge';
import { DeviceID } from '../components/DeviceID';
import { useHostPeer } from '../hooks/useHostPeer';
import { useFileTransfer } from '../hooks/useFileTransfer';

const { signaling, files } = window.nexulon;

export function CustomerHelp() {
  const [deviceId, setDeviceId] = useState('');
  const [needsHelp, setNeedsHelp] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('offline');
  const [relayConnected, setRelayConnected] = useState(false);

  // Manage host-side peer connection when help is requested
  const { peerRef } = useHostPeer(needsHelp);
  const { progress: fileProgress, sendFile } = useFileTransfer(peerRef);

  // Generate or load device ID on mount
  useEffect(() => {
    const stored = localStorage.getItem('nexulon-device-id');
    if (stored) {
      setDeviceId(stored);
    } else {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let id = '';
      for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      localStorage.setItem('nexulon-device-id', id);
      setDeviceId(id);
    }
  }, []);

  // Connect to relay
  useEffect(() => {
    if (!deviceId) return;

    signaling.connect({ deviceId });

    signaling.onConnected(() => {
      setRelayConnected(true);
      setStatus('offline');
    });

    signaling.onSessionRequest(() => {
      setStatus('connected');
    });

    signaling.onPeerDisconnected(() => {
      setStatus(needsHelp ? 'waiting' : 'offline');
    });

    signaling.onRelayError((msg: string) => {
      console.error('[relay]', msg);
    });

    return () => {
      signaling.removeAllListeners();
    };
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleHelp = useCallback(async () => {
    const next = !needsHelp;
    setNeedsHelp(next);

    if (next) {
      await signaling.setNeedHelp({ deviceId, needsHelp: true });
      await signaling.setAvailable(true);
      setStatus('waiting');
    } else {
      await signaling.setNeedHelp({ deviceId, needsHelp: false });
      await signaling.setAvailable(false);
      await signaling.disconnectSession();
      setStatus('offline');
    }
  }, [needsHelp, deviceId]);

  return (
    <div className="flex flex-col items-center justify-center h-screen px-8 bg-background">
      {/* Logo / Title */}
      <h1 className="text-2xl font-bold text-foreground mb-2">Nexulon Connect</h1>
      <p className="text-sm text-muted-foreground mb-10">Customer Support</p>

      {/* Big Need Help Button */}
      <button
        onClick={toggleHelp}
        disabled={!relayConnected}
        className={`
          relative w-48 h-48 rounded-full font-bold text-xl transition-all duration-300
          focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-background
          disabled:opacity-50 disabled:cursor-not-allowed
          ${
            needsHelp
              ? 'bg-red-500 text-white focus:ring-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)]'
              : 'bg-green-500 text-white hover:bg-green-400 focus:ring-green-500 shadow-[0_0_40px_rgba(34,197,94,0.3)]'
          }
        `}
      >
        {needsHelp ? (
          <span className="flex flex-col items-center">
            <span className="text-3xl mb-1">&#128680;</span>
            <span>Help Requested</span>
            <span className="text-xs font-normal mt-1 opacity-80">Click to cancel</span>
          </span>
        ) : (
          <span className="flex flex-col items-center">
            <span className="text-3xl mb-1">&#9997;</span>
            <span>Need Help</span>
          </span>
        )}
      </button>

      {/* Pulsing ring animation when help is active */}
      {needsHelp && (
        <div className="absolute w-48 h-48 rounded-full border-4 border-red-500 animate-ping opacity-20 pointer-events-none"
             style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', marginTop: '-20px' }} />
      )}

      {/* Status */}
      <div className="mt-8 mb-4">
        <StatusBadge status={status} />
      </div>

      {/* Device ID */}
      {deviceId && (
        <div className="mb-4">
          <DeviceID deviceId={deviceId} />
        </div>
      )}

      {/* Send File button — visible when connected to an agent */}
      {status === 'connected' && (
        <button
          onClick={async () => {
            const file = await files.pickFile();
            if (file) sendFile(file);
          }}
          className="mt-4 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Send File to Agent
        </button>
      )}

      {/* File transfer progress */}
      {fileProgress && (
        <div className="mt-4 w-full max-w-xs">
          <p className="text-xs text-muted-foreground mb-1">
            {fileProgress.direction === 'sending' ? 'Sending' : 'Receiving'}: {fileProgress.fileName}
          </p>
          <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${fileProgress.done ? 'bg-green-500' : 'bg-primary'}`}
              style={{ width: `${fileProgress.percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {fileProgress.done ? 'Complete!' : `${fileProgress.percent}%`}
          </p>
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs text-muted-foreground text-center max-w-xs mt-4">
        {needsHelp
          ? status === 'connected'
            ? 'A support agent is connected. You can send files using the button above.'
            : 'A support agent will connect to your screen shortly. Please wait...'
          : 'Press the button above when you need assistance from our support team.'}
      </p>
    </div>
  );
}
