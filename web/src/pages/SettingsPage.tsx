import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { User, Key, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint';

const API_BASE_URL = 'http://localhost:3000';

interface ProfileData {
  name: string;
  phone: string;
  email: string;
  username: string;
  address: string;
}

export function SettingsPage() {
  const { token, login } = useAuthStore();
  const { isMobile } = useBreakpoint();
  const [profile, setProfile] = useState<ProfileData>({
    name: 'System Admin',
    phone: 'haajari896',
    email: 'admin@haajari.com',
    username: 'admin',
    address: 'System Admin HQ',
  });

  // Password fields
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Fetch profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setProfile({
            name: data.user.name || '',
            phone: data.user.phone || '',
            email: data.user.email || '',
            username: data.user.username || '',
            address: data.user.address || '',
          });
        }
      } catch (err) {
        console.warn('Backend profile fetch offline. Using local session data.', err);
      }
    };
    fetchProfile();
  }, [token]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess('Profile updated successfully.');
        if (data.user && data.user.username) {
          login(token || '', data.user.username);
        }
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to update profile.');
      }
    } catch (err) {
      console.warn('Backend update offline. Saving locally.', err);
      setSuccess('Profile saved locally (Offline Mode).');
      if (profile.username) {
        login(token || '', profile.username);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPwError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }

    setPwLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (res.ok) {
        setPwSuccess('Password updated successfully.');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const errData = await res.json();
        setPwError(errData.error || 'Failed to update password.');
      }
    } catch (err) {
      console.warn('Backend password change offline.', err);
      setPwError('Password change failed. Backend server is currently offline.');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: isMobile ? '20px' : '22px', fontWeight: '800', marginBottom: '4px' }}>Admin Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Modify your admin profile credentials, password, and configuration</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <User size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '15px', fontWeight: '700' }}>Admin Credentials & Profile</h2>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
              color: '#EF4444', fontSize: '13px',
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {success && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
              color: '#22C55E', fontSize: '13px',
            }}>
              <CheckCircle size={16} />
              {success}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Admin Username / ID
              </label>
              <input
                type="text"
                value={profile.username}
                onChange={e => setProfile(prev => ({ ...prev, username: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Admin Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={e => setProfile(prev => ({ ...prev, email: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Phone Number / Mobile
              </label>
              <input
                type="text"
                value={profile.phone}
                onChange={e => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                HQ Location / Address
              </label>
              <input
                type="text"
                value={profile.address}
                onChange={e => setProfile(prev => ({ ...prev, address: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: isMobile ? 'span 1' : 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: isMobile ? '100%' : 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  color: 'white', fontWeight: '700', fontSize: '14px',
                  padding: '12px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
                }}
              >
                {loading && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: isMobile ? '16px' : '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Key size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '15px', fontWeight: '700' }}>Security & Password</h2>
          </div>

          {pwError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
              color: '#EF4444', fontSize: '13px',
            }}>
              <AlertCircle size={16} />
              {pwError}
            </div>
          )}

          {pwSuccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
              color: '#22C55E', fontSize: '13px',
            }}>
              <CheckCircle size={16} />
              {pwSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                Current Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={pwLoading}
                style={{
                  width: isMobile ? '100%' : 'auto',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: 'linear-gradient(135deg, #F97316, #EA580C)',
                  color: 'white', fontWeight: '700', fontSize: '14px',
                  padding: '12px 20px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
                }}
              >
                {pwLoading && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};
