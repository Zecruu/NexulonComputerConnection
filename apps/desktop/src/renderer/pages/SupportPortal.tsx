import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser, useSignIn } from '@clerk/clerk-react';
import { io, Socket } from 'socket.io-client';

const RELAY_URL = 'https://relay-server-production-76ba.up.railway.app';
const CLERK_DOMAIN = 'driving-swine-96.clerk.accounts.dev';

interface DeviceInfo {
  deviceId: string;
  name: string;
  online: boolean;
  needsHelp: boolean;
  assignedTo: string | null;
  assignedEmail: string | null;
  lastSeen: string;
  os: string;
}

function OsIcon({ os }: { os: string }) {
  switch (os) {
    case 'win32':
      return <span title="Windows">&#128187;</span>;
    case 'darwin':
      return <span title="macOS">&#127822;</span>;
    case 'linux':
      return <span title="Linux">&#128039;</span>;
    default:
      return <span title="Unknown">&#10067;</span>;
  }
}

function DeviceCard({
  device,
  onConnect,
  onRename,
}: {
  device: DeviceInfo;
  onConnect: (deviceId: string) => void;
  onRename: (deviceId: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(device.name || '');
  const timeAgo = getTimeAgo(device.lastSeen);

  const handleSave = () => {
    onRename(device.deviceId, editName.trim());
    setEditing(false);
  };

  return (
    <div
      className={`
        flex items-center justify-between p-4 rounded-lg border transition-all
        ${
          device.needsHelp && device.online
            ? 'border-green-500/50 bg-green-500/5 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
            : device.online
            ? 'border-border bg-card'
            : 'border-border/50 bg-card/50 opacity-60'
        }
      `}
    >
      <div className="flex items-center gap-4">
        {/* Status indicator */}
        <div className="relative">
          <div
            className={`w-3 h-3 rounded-full ${
              device.needsHelp && device.online
                ? 'bg-green-500'
                : device.online
                ? 'bg-blue-500'
                : 'bg-muted-foreground'
            }`}
          />
          {device.needsHelp && device.online && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping" />
          )}
        </div>

        {/* Device info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">
              {device.deviceId.slice(0, 3)}-{device.deviceId.slice(3)}
            </span>
            <OsIcon os={device.os} />
            {editing ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  autoFocus
                  placeholder="Device name"
                  className="w-32 rounded bg-secondary border border-border px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleSave}
                  className="text-xs text-green-400 hover:text-green-300"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditName(device.name || ''); setEditing(true); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                title="Click to rename"
              >
                {device.name || 'Name this device'}
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {device.online ? 'Online' : `Last seen ${timeAgo}`}
            {device.needsHelp && device.online && (
              <span className="ml-2 text-green-400 font-medium">
                Needs Help
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Connect button */}
      {device.online && device.needsHelp && (
        <button
          onClick={() => onConnect(device.deviceId)}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 transition-colors"
        >
          Connect
        </button>
      )}
      {device.online && !device.needsHelp && (
        <button
          onClick={() => onConnect(device.deviceId)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Connect
        </button>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SupportDashboard() {
  const navigate = useNavigate();
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [filter, setFilter] = useState<'all' | 'help' | 'online'>('all');
  const [claimCode, setClaimCode] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);

  const currentEmail = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress;
  const isAdmin = currentEmail === 'nomnk5138@gmail.com';

  // Fetch devices from API
  const fetchDevices = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${RELAY_URL}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch (err) {
      console.error('[portal] Failed to fetch devices:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  // Connect to socket.io for real-time updates
  useEffect(() => {
    const s = io(RELAY_URL, { transports: ['websocket'] });
    s.on('connect', () => {
      s.emit('join-support');
    });

    s.on('device-updated', (device: DeviceInfo) => {
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.deviceId === device.deviceId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = device;
          return next;
        }
        return [device, ...prev];
      });
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleClaim = useCallback(async () => {
    const code = claimCode.replace(/[-\s]/g, '').toUpperCase();
    if (code.length !== 6) {
      setClaimError('Enter a 6-character device code');
      return;
    }
    setClaimError('');
    setClaiming(true);
    try {
      const token = await getToken();
      const res = await fetch(`${RELAY_URL}/api/devices/claim`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId: code }),
      });
      const data = await res.json();
      if (res.ok) {
        setClaimCode('');
        fetchDevices();
      } else {
        setClaimError(data.error || 'Failed to add device');
      }
    } catch {
      setClaimError('Failed to connect to server');
    } finally {
      setClaiming(false);
    }
  }, [claimCode, getToken, fetchDevices]);

  const handleRename = useCallback(async (deviceId: string, name: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${RELAY_URL}/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setDevices((prev) =>
          prev.map((d) => (d.deviceId === deviceId ? { ...d, name } : d))
        );
      }
    } catch {
      console.error('[portal] Failed to rename device');
    }
  }, [getToken]);

  const handleConnect = useCallback(
    (deviceId: string) => {
      sessionStorage.setItem('nexulon-peer-id', deviceId);
      // The support agent needs their own deviceId for signaling
      const agentId = localStorage.getItem('nexulon-agent-id') || (() => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let id = '';
        for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
        localStorage.setItem('nexulon-agent-id', id);
        return id;
      })();
      sessionStorage.setItem('nexulon-agent-id', agentId);
      navigate('/viewer');
    },
    [navigate]
  );

  // Filter devices
  const filtered = devices.filter((d) => {
    if (filter === 'help') return d.needsHelp && d.online;
    if (filter === 'online') return d.online;
    return true;
  });

  // Sort: needs help first, then online, then offline
  const sorted = [...filtered].sort((a, b) => {
    if (a.needsHelp && a.online && !(b.needsHelp && b.online)) return -1;
    if (!(a.needsHelp && a.online) && b.needsHelp && b.online) return 1;
    if (a.online && !b.online) return -1;
    if (!a.online && b.online) return 1;
    return 0;
  });

  const helpCount = devices.filter((d) => d.needsHelp && d.online).length;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">Support Portal</h1>
          {helpCount > 0 && (
            <span className="flex items-center gap-1.5 bg-green-500/20 text-green-400 text-xs font-medium px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {helpCount} need{helpCount === 1 ? 's' : ''} help
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {user?.firstName || user?.emailAddresses?.[0]?.emailAddress}
          </span>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Admin
            </button>
          )}
          <button
            onClick={() => signOut()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Add device + filter */}
      <div className="px-6 pt-4 space-y-3">
        {/* Claim device by code */}
        <div className="flex gap-2">
          <input
            type="text"
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
            placeholder="Enter device code (e.g. ABC-123)"
            maxLength={7}
            onKeyDown={(e) => e.key === 'Enter' && handleClaim()}
            className="flex-1 rounded-md bg-secondary border border-border px-3 py-2 text-sm font-mono tracking-wider text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleClaim}
            disabled={claiming || !claimCode}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {claiming ? '...' : 'Add Device'}
          </button>
        </div>
        {claimError && <p className="text-xs text-destructive">{claimError}</p>}

        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['all', 'help', 'online'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              {f === 'help' ? 'Needs Help' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Device list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {filter === 'help'
              ? 'No devices currently need help'
              : filter === 'online'
              ? 'No devices online'
              : 'No devices registered yet'}
          </div>
        ) : (
          sorted.map((device) => (
            <DeviceCard
              key={device.deviceId}
              device={device}
              onConnect={handleConnect}
              onRename={handleRename}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground">
        {devices.length} device{devices.length !== 1 ? 's' : ''} registered
        {' / '}
        {devices.filter((d) => d.online).length} online
      </div>
    </div>
  );
}

function AuthForm() {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    console.log('[auth] handleSignIn called, signInLoaded:', signInLoaded);
    if (!signInLoaded || !signIn) return;
    setError('');
    setLoading(true);
    try {
      console.log('[auth] Calling signIn.create...');
      const result = await signIn.create({ identifier: email, password });
      console.log('[auth] signIn result:', result.status);
      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        window.location.reload();
        return;
      }
    } catch (err: any) {
      console.error('[auth] signIn error:', JSON.stringify(err?.errors || err, null, 2));
      setError(err?.errors?.[0]?.longMessage || err?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background px-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">Support Portal</h1>
      <p className="text-sm text-muted-foreground mb-8">Sign in to your account</p>

      <div className="w-full max-w-xs space-y-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
          className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={handleSignIn}
          disabled={loading || !email || !password}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-xs text-center text-muted-foreground">
          Contact your admin for account access
        </p>
      </div>
    </div>
  );
}

export function SupportPortal() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <AuthForm />;
  }

  return <SupportDashboard />;
}
