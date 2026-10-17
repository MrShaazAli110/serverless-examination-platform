import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  KeyRound, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight,
  X
} from 'lucide-react';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
  const { login, register, claimSuperAdmin } = useAuth();
  const [mode, setMode] = useState('login'); // 'login', 'register', or 'super_admin'

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isExaminerRequest, setIsExaminerRequest] = useState(false);
  const [adminSecretKey, setAdminSecretKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'super_admin') {
        const res = await claimSuperAdmin({
          email,
          password,
          full_name: fullName || 'Super Administrator',
          super_admin_key: adminSecretKey || 'SUPER_ADMIN_2026',
        });

        if (res.success) {
          setSuccessMsg('Authenticated as Super Admin in Supabase!');
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(res.data.user);
            if (onClose) onClose();
            window.location.hash = 'admin';
          }, 450);
        } else {
          setErrorMsg(res.message || 'Super Admin authorization failed');
        }
      } else if (mode === 'login') {
        const res = await login(email, password);
        if (res.success) {
          setSuccessMsg('Logged in successfully!');
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(res.data.user);
            if (onClose) onClose();
          }, 400);
        } else {
          setErrorMsg(res.message || 'Invalid credentials');
        }
      } else {
        // Register
        const res = await register({
          full_name: fullName,
          email,
          password,
          requested_role: isExaminerRequest ? 'examiner' : 'student',
          admin_secret_key: isExaminerRequest ? adminSecretKey : undefined,
        });

        if (res.success) {
          setSuccessMsg(`Account created successfully as ${res.data.user.role}! Logging in...`);
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(res.data.user);
            if (onClose) onClose();
          }, 500);
        } else {
          setErrorMsg(res.message || 'Registration failed');
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '440px', padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={22} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {mode === 'super_admin' ? 'Super Admin Portal' : mode === 'login' ? 'Candidate & Examiner Login' : 'Create New Account'}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: 0 }}>
                {mode === 'super_admin' ? 'Master Supabase Schema Controller' : 'Protected by Supabase Authentication'}
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: '50%', padding: '0.35rem' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Mode Switch Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 'var(--radius-md)',
          padding: '0.25rem',
          marginBottom: '1.5rem',
          gap: '0.2rem'
        }}>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            style={{
              padding: '0.5rem 0.25rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'login' ? 'var(--primary)' : 'transparent',
              color: mode === 'login' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            style={{
              padding: '0.5rem 0.25rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'register' ? 'var(--primary)' : 'transparent',
              color: mode === 'register' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('super_admin');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            style={{
              padding: '0.5rem 0.25rem',
              borderRadius: '8px',
              border: 'none',
              background: mode === 'super_admin' ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'transparent',
              color: mode === 'super_admin' ? '#ffffff' : '#c084fc',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            Super Admin
          </button>
        </div>

        {/* Quick Demo Fill Pills */}
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.65rem 0.85rem',
          background: 'rgba(99, 102, 241, 0.08)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(99, 102, 241, 0.2)'
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '0.4rem', fontWeight: 600 }}>
            🚀 Instant Demo Logins (Click to autofill):
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="badge"
              style={{ cursor: 'pointer', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.25rem 0.5rem' }}
              onClick={() => {
                setMode('login');
                setEmail('examiner@examsphere.io');
                setPassword('admin123');
                setErrorMsg('');
              }}
            >
              👩‍🏫 Examiner (examiner@examsphere.io)
            </button>
            <button
              type="button"
              className="badge"
              style={{ cursor: 'pointer', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '0.25rem 0.5rem' }}
              onClick={() => {
                setMode('super_admin');
                setEmail('superadmin@examsphere.io');
                setPassword('admin123');
                setFullName('Super Administrator');
                setAdminSecretKey('SUPER_ADMIN_2026');
                setErrorMsg('');
              }}
            >
              🛡️ Super Admin
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            borderRadius: 'var(--radius-md)',
            color: '#fb7185',
            fontSize: '0.82rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={16} flexShrink={0} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 'var(--radius-md)',
            color: '#34d399',
            fontSize: '0.82rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <CheckCircle size={16} flexShrink={0} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(mode === 'register' || mode === 'super_admin') && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Full Name {mode === 'super_admin' && '(Optional)'}
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder={mode === 'super_admin' ? 'Super Administrator' : 'e.g. John Doe'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2.3rem' }}
                  required={mode === 'register'}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                style={{ paddingLeft: '2.3rem' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                style={{ paddingLeft: '2.3rem' }}
                required
              />
            </div>
          </div>

          {/* Super Admin Master Key Field */}
          {mode === 'super_admin' && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem'
            }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#c084fc', marginBottom: '0.35rem' }}>
                Super Admin Master Security Key *
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={15} color="#c084fc" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="password"
                  placeholder="Enter SUPER_ADMIN_2026..."
                  value={adminSecretKey}
                  onChange={(e) => setAdminSecretKey(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2.3rem', fontSize: '0.85rem' }}
                  required
                />
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.4rem', margin: '0.4rem 0 0 0' }}>
                Grants unlimited authority to provision examiners and alter schema roles. (Default Key: <code>SUPER_ADMIN_2026</code>)
              </p>
            </div>
          )}

          {/* Examiner Request with Admin Authorization Key */}
          {mode === 'register' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                <input
                  type="checkbox"
                  checked={isExaminerRequest}
                  onChange={(e) => setIsExaminerRequest(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#6366f1' }}
                />
                <span>Register as Instructor / Examiner</span>
              </label>

              {isExaminerRequest ? (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#c084fc', marginBottom: '0.3rem' }}>
                    Admin Authorization Passcode *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={15} color="#c084fc" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="password"
                      placeholder="Enter Admin Authorization Key..."
                      value={adminSecretKey}
                      onChange={(e) => setAdminSecretKey(e.target.value)}
                      className="input"
                      style={{ paddingLeft: '2.3rem', fontSize: '0.85rem' }}
                      required={isExaminerRequest}
                    />
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem', margin: '0.35rem 0 0 0' }}>
                    Examiner accounts require admin approval. (Default Key: <code>EXAM_ADMIN_2026</code>)
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', margin: '0.4rem 0 0 0' }}>
                  Standard accounts are registered with candidate access. Candidates cannot shift to examiner role.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{
              width: '100%',
              marginTop: '0.5rem',
              background: mode === 'super_admin' ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : undefined
            }}
          >
            {loading ? 'Authenticating with Supabase...' : (
              mode === 'super_admin' ? 'Authenticate Super Admin & Open Console' :
              mode === 'login' ? 'Sign In to Account' : 'Complete Registration'
            )}
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
