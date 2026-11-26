import { useEffect, useState, type FormEvent } from 'react';
import { validateAuthForm } from '../utils/format';

interface AuthModalProps {
  open: boolean;
  initialMode: 'signin' | 'signup';
  initialRole: 'buyer' | 'driver' | 'store';
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (params: {
    email: string;
    password: string;
    name: string;
    phone: string;
    role: 'buyer' | 'driver' | 'store';
    vehicle?: string;
    storeName?: string;
  }) => Promise<{ needsEmailConfirmation: boolean }>;
  onGoogleSignIn: () => Promise<void>;
  onForgotPassword: (email: string) => Promise<void>;
}

export function AuthModal({
  open,
  initialMode,
  initialRole,
  onClose,
  onSignIn,
  onSignUp,
  onGoogleSignIn,
  onForgotPassword,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [role, setRole] = useState<'buyer' | 'driver' | 'store'>(initialRole);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setRole(initialRole);
      setErrorText('');
      setInfoText('');
    }
  }, [open, initialMode, initialRole]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorText('');
    setInfoText('');

    const validationError = validateAuthForm({
      mode,
      email,
      password,
      name,
      phone,
      role,
      vehicle,
      storeName,
    });
    if (validationError) {
      setErrorText(validationError);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'forgot') {
        await onForgotPassword(email);
        setInfoText('Password reset email sent. Check your inbox to choose a new password.');
      } else if (mode === 'signup') {
        const res = await onSignUp({
          email,
          password,
          name,
          phone,
          role,
          vehicle,
          storeName,
        });
        if (res.needsEmailConfirmation) {
          setInfoText('Account created. Check your inbox to confirm your email before signing in.');
        } else {
          onClose();
        }
      } else {
        await onSignIn(email, password);
        onClose();
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleClick() {
    setErrorText('');
    setBusy(true);
    try {
      await onGoogleSignIn();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Unable to start Google sign-in.');
      setBusy(false);
    }
  }

  return (
    <div
      id="auth-modal"
      className="modal-backdrop open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 id="auth-title">
            {mode === 'signup'
              ? 'Create HazyEats Account'
              : mode === 'forgot'
                ? 'Reset Password'
                : 'Sign In to HazyEats'}
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close authentication modal">
            &times;
          </button>
        </div>

        {mode !== 'forgot' && (
          <>
            <button type="button" className="btn-google" disabled={busy} onClick={handleGoogleClick}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              Continue with Google
            </button>
            <div className="divider">— OR USE EMAIL &amp; PASSWORD —</div>
          </>
        )}

        <form id="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <div id="signup-fields">
              <div className="form-group">
                <label htmlFor="auth-name">Full Name</label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nkosinathi Mokoena"
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-phone">Phone Number (WhatsApp / Call)</label>
                <input
                  id="auth-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 072 555 1234"
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth-role">Account Role</label>
                <select
                  id="auth-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'buyer' | 'driver' | 'store')}
                >
                  <option value="buyer">Customer (Order Food to Shabalala)</option>
                  <option value="driver">Driver / Delivery Partner (Car / Motorbike)</option>
                  <option value="store">Store / Community Vendor</option>
                </select>
              </div>

              {role === 'driver' && (
                <div className="form-group">
                  <label htmlFor="auth-vehicle">Vehicle Type &amp; Registration</label>
                  <input
                    id="auth-vehicle"
                    type="text"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                    placeholder="e.g. Honda Ace 125 Bike / VW Polo - MP 442 GP"
                  />
                </div>
              )}

              {role === 'store' && (
                <div className="form-group">
                  <label htmlFor="auth-store-name">Store / Business Name</label>
                  <input
                    id="auth-store-name"
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Shabalala Kota Hub"
                  />
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="form-group">
              <label htmlFor="auth-pass">Password (min 8 characters)</label>
              <input
                id="auth-pass"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          )}

          {errorText && <div className="form-error">{errorText}</div>}
          {infoText && (
            <div style={{ color: '#4ade80', fontSize: '0.84rem', marginBottom: 10 }}>
              {infoText}
            </div>
          )}

          <button type="submit" className="btn-gold" style={{ width: '100%' }} disabled={busy}>
            {busy
              ? 'Please wait...'
              : mode === 'signup'
                ? 'Create Account'
                : mode === 'forgot'
                  ? 'Send Reset Link'
                  : 'Sign In'}
          </button>
        </form>

        <div
          style={{
            textAlign: 'center',
            marginTop: 14,
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {mode === 'signin' && (
            <>
              <button
                type="button"
                className="close-btn"
                style={{ fontSize: '0.84rem', color: 'var(--gold-flat)' }}
                onClick={() => {
                  setMode('forgot');
                  setErrorText('');
                  setInfoText('');
                }}
              >
                Forgot your password?
              </button>
              <div>
                New to HazyEats?{' '}
                <button
                  type="button"
                  className="close-btn"
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => {
                    setMode('signup');
                    setErrorText('');
                    setInfoText('');
                  }}
                >
                  <span className="gold-text">Create an Account</span>
                </button>
              </div>
            </>
          )}

          {mode !== 'signin' && (
            <div>
              Already have an account?{' '}
              <button
                type="button"
                className="close-btn"
                style={{ fontSize: '0.85rem' }}
                onClick={() => {
                  setMode('signin');
                  setErrorText('');
                  setInfoText('');
                }}
              >
                <span className="gold-text">Sign In</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
