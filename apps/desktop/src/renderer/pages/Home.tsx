import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { DeviceID } from '../components/DeviceID';
import { StatusBadge, type ConnectionStatus } from '../components/StatusBadge';
import { SettingsDrawer } from '../components/SettingsDrawer';
import { useHostPeer } from '../hooks/useHostPeer';

const { signaling } = window.nexulon;

export function Home() {
  const navigate = useNavigate();
  const [deviceId, setDeviceId] = useState('');
  const [hostEnabled, setHostEnabled] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>('offline');
  const [connectId, setConnectId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [error, setError] = useState('');

  // Manage host-side peer connection when toggle is on
  useHostPeer(hostEnabled);

  // Generate or load device ID on mount
  useEffect(() => {
    // nanoid is ESM-only, so we generate a simple 6-char alphanumeric ID
    const stored = localStorage.getItem('nexulon-device-id');
    if (stored) {
      setDeviceId(stored);
    } else {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
      let id = '';
      for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      localStorage.setItem('nexulon-device-id', id);
      setDeviceId(id);
    }
  }, []);

  // Connect to relay once we have a deviceId
  useEffect(() => {
    if (!deviceId) return;

    signaling.connect({ deviceId });

    signaling.onConnected(() => {
      setStatus('offline'); // Connected to relay but not hosting
    });

    signaling.onRegistered(() => {
      console.log('[relay] Registered');
    });

    signaling.onSessionRequest((fromDeviceId: string) => {
      // A viewer wants to connect — the renderer will handle peer creation
      setStatus('connected');
      console.log(`[relay] Session request from ${fromDeviceId}`);
      // Store the viewer's deviceId so peer.ts can use it
      sessionStorage.setItem('nexulon-peer-id', fromDeviceId);
    });

    signaling.onPeerDisconnected(() => {
      setStatus(hostEnabled ? 'ready' : 'offline');
    });

    signaling.onRelayError((message: string) => {
      setError(message);
      setTimeout(() => setError(''), 5000);
    });

    return () => {
      signaling.removeAllListeners();
    };
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = useCallback(
    async (checked: boolean) => {
      setHostEnabled(checked);
      if (checked) {
        await signaling.setAvailable(true);
        setStatus('ready');
      } else {
        await signaling.setAvailable(false);
        await signaling.disconnectSession();
        setStatus('offline');
      }
    },
    []
  );

  const handleConnect = useCallback(async () => {
    const target = connectId.replace(/[-\s]/g, '').toUpperCase();
    if (target.length !== 6) {
      setError('Enter a 6-character Device ID');
      return;
    }
    setError('');
    setStatus('waiting');
    await signaling.connectTo({ targetDeviceId: target });
    // Navigate to viewer mode
    sessionStorage.setItem('nexulon-peer-id', target);
    navigate('/viewer');
  }, [connectId, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen px-8 relative">
      {/* Settings gear */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors text-xl"
        title="Settings"
      >
        &#9881;
      </button>

      {/* App title */}
      <h1 className="text-xl font-semibold text-muted-foreground mb-8">
        Nexulon Connect
      </h1>

      {/* Toggle switch */}
      <div className="mb-6">
        <ToggleSwitch checked={hostEnabled} onChange={handleToggle} />
      </div>

      {/* Status */}
      <div className="mb-4">
        <StatusBadge status={status} />
      </div>

      {/* Device ID */}
      {deviceId && (
        <div className="mb-8">
          <DeviceID deviceId={deviceId} />
        </div>
      )}

      {/* Divider */}
      <div className="w-full max-w-xs border-t border-border my-4" />

      {/* Connect to remote device */}
      <div className="w-full max-w-xs space-y-3">
        <label className="text-sm font-medium text-muted-foreground">
          Connect to a device
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={connectId}
            onChange={(e) => setConnectId(e.target.value.toUpperCase())}
            placeholder="ABC-123"
            maxLength={7}
            className="flex-1 rounded-md bg-secondary border border-border px-3 py-2 text-sm font-mono tracking-wider text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleConnect}
            disabled={!connectId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Connect
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="mt-4 text-sm text-destructive">{error}</p>
      )}

      {/* Settings Drawer */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        quality={quality}
        onQualityChange={setQuality}
      />
    </div>
  );
}
