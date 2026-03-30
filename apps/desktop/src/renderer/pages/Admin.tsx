import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';

const RELAY_URL = 'https://relay-server-production-76ba.up.railway.app';
const ADMIN_EMAIL = 'nomnk5138@gmail.com';

interface AgentUser {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: number;
  lastSignInAt: number | null;
}

export function Admin() {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const [users, setUsers] = useState<AgentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [creating, setCreating] = useState(false);

  const currentEmail = user?.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress;

  const isAdmin = currentEmail === ADMIN_EMAIL;

  const fetchUsers = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${RELAY_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers(await res.json());
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch users');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn && isAdmin) {
      fetchUsers();
    }
  }, [isLoaded, isSignedIn, isAdmin, fetchUsers]);

  const handleCreate = async () => {
    if (!newEmail || !newPassword || !newUsername) {
      setError('Email, password, and username are required');
      return;
    }
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${RELAY_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          username: newUsername,
          firstName: newFirstName || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Created agent: ${data.username} (${data.email})`);
        setNewEmail('');
        setNewPassword('');
        setNewUsername('');
        setNewFirstName('');
        fetchUsers();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (email === ADMIN_EMAIL) {
      setError("Can't delete admin account");
      return;
    }
    setError('');
    try {
      const token = await getToken();
      const res = await fetch(`${RELAY_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSuccess(`Deleted ${email}`);
        fetchUsers();
      }
    } catch {
      setError('Failed to delete user');
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isSignedIn || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <p className="text-destructive text-sm">Access denied</p>
        <button
          onClick={() => navigate('/portal')}
          className="text-sm text-primary hover:underline"
        >
          Back to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h1 className="text-lg font-bold text-foreground">Admin Panel</h1>
        <button
          onClick={() => navigate('/portal')}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to Portal
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {/* Create new agent */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Create Support Agent</h2>
          <div className="grid grid-cols-2 gap-3 max-w-lg">
            <input
              type="text"
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              placeholder="First name"
              className="rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="Username *"
              className="rounded-md bg-secondary border border-border px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Email *"
              className="rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Password *"
              className="rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newEmail || !newPassword || !newUsername}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating...' : 'Create Agent'}
          </button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-400">{success}</p>}

        {/* User list */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Support Agents ({users.length})
          </h2>
          {loading ? (
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {u.firstName || u.username}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        @{u.username}
                      </span>
                      {u.email === ADMIN_EMAIL && (
                        <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  {u.email !== ADMIN_EMAIL && (
                    <button
                      onClick={() => handleDelete(u.id, u.email)}
                      className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
