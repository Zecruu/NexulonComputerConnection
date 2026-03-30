import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser, useSignIn, useSignUp } from '@clerk/clerk-react';
import { io, Socket } from 'socket.io-client';

const RELAY_URL = 'https://relay-server-production-76ba.up.railway.app';
const CLERK_DOMAIN = 'driving-swine-96.clerk.accounts.dev';

interface DeviceInfo {
  deviceId: string;
  name: string;
  online: boolean;
  needsHelp: boolean;
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
}: {
  device: DeviceInfo;
  onConnect: (deviceId: string) => void;
}) {
  const timeAgo = getTimeAgo(device.lastSeen);

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
            {device.name && (
              <span className="text-sm text-muted-foreground">
                ({device.name})
              </span>
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
          <button
            onClick={() => signOut()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-6 pt-4">
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
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');

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

  const handleSignUp = async () => {
    console.log('[auth] handleSignUp called, signUpLoaded:', signUpLoaded, 'signUp:', !!signUp);
    if (!signUpLoaded || !signUp) {
      setError('Clerk not loaded yet. Please wait a moment and try again.');
      return;
    }
    console.log('[auth] Starting sign up with email:', email);
    setError('');
    setLoading(true);
    try {
      console.log('[auth] Calling signUp.create...');
      const result = await signUp.create({
        emailAddress: email,
        password,
        firstName: firstName || undefined,
      });
      console.log('[auth] signUp.create result:', result.status, result);

      if (result.status === 'complete') {
        console.log('[auth] Sign up complete, setting active session');
        await setSignUpActive({ session: result.createdSessionId });
        return;
      }

      // Send email verification
      console.log('[auth] Preparing email verification...');
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      console.log('[auth] Verification email sent');
      setVerifying(true);
    } catch (err: any) {
      console.error('[auth] signUp error:', JSON.stringify(err?.errors || err, null, 2));
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Sign up failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!signUpLoaded || !signUp) return;
    setError('');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setError('New code sent!');
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage || err?.message || 'Failed to resend');
    }
  };

  const handleVerify = async () => {
    if (!signUpLoaded || !signUp) return;
    setError('');
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      console.log('[auth] verify result:', result.status);
      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        // Force reload so useAuth() picks up the new session
        window.location.reload();
        return;
      }
    } catch (err: any) {
      console.error('[auth] verify error:', err);
      setError(err?.errors?.[0]?.longMessage || err?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background px-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
        <p className="text-sm text-muted-foreground mb-6">Enter the verification code sent to {email}</p>
        <div className="w-full max-w-xs space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Verification code"
            className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={handleVerify}
            disabled={loading || !code}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            onClick={handleResendCode}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Didn't get the code? Resend
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background px-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">Support Portal</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {mode === 'signin' ? 'Sign in to your account' : 'Create a new account'}
      </p>

      <div className="w-full max-w-xs space-y-4">
        {mode === 'signup' && (
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}
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
          onKeyDown={(e) => e.key === 'Enter' && (mode === 'signin' ? handleSignIn() : handleSignUp())}
          className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Clerk CAPTCHA widget container — required for bot protection */}
        <div id="clerk-captcha" />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={mode === 'signin' ? handleSignIn : handleSignUp}
          disabled={loading || !email || !password}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>

        <p className="text-xs text-center text-muted-foreground">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); }} className="text-primary hover:underline">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(''); }} className="text-primary hover:underline">
                Sign in
              </button>
            </>
          )}
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
