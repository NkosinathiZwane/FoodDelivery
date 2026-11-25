import { useEffect, useState, type FormEvent } from 'react';
import {
  Bike,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ShieldCheck,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  loginWithEmail,
  registerWithEmail,
  syncGoogleSession,
} from '../services/api.ts';
import { INITIAL_STORES_SEED } from '../db/catalog.ts';
import { PROTOTYPE_USERS_SEED } from '../db/seedUsers.ts';
import type { UserProfile, UserRole } from '../types.ts';
import {
  validateSignInInput,
  validateSignUpInput,
  type AuthFormErrors,
} from '../utils/marketplace.ts';

interface AuthModalProps {
  open: boolean;
  initialMode: 'signin' | 'signup';
  initialRole: UserRole;
  notice?: string | null;
  prefill?: { name?: string; email?: string; phone?: string; vehicle?: string } | null;
  onClose: () => void;
  onAuthenticated: (user: UserProfile) => void;
  onOpenDriverOnboarding?: () => void;
}

const ROLE_OPTIONS: Array<{
  id: UserRole;
  label: string;
  subtitle: string;
  Icon: typeof ShoppingBag;
}> = [
  {
    id: 'buyer',
    label: 'Customer',
    subtitle: 'Order food & track delivery',
    Icon: ShoppingBag,
  },
  {
    id: 'driver',
    label: 'Driver Partner',
    subtitle: 'Deliver & earn R20 per trip',
    Icon: Bike,
  },
  {
    id: 'store',
    label: 'Store / Restaurant',
    subtitle: 'Manage paid kitchen orders',
    Icon: Store,
  },
  {
    id: 'admin',
    label: 'System Admin',
    subtitle: 'Requires access code',
    Icon: ShieldCheck,
  },
];

export function AuthModal({
  open,
  initialMode,
  initialRole,
  notice,
  prefill,
  onClose,
  onAuthenticated,
  onOpenDriverOnboarding,
}: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [storeName, setStoreName] = useState('KFC');
  const [customStoreName, setCustomStoreName] = useState('');
  const [selectedPrototypeEmail, setSelectedPrototypeEmail] = useState('spur@hazyeats.demo');
  const [adminCode, setAdminCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPrototypes, setShowPrototypes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFormErrors>({});

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setRole(initialRole);
      setError(null);
      setFieldErrors({});
      setConfirmPassword('');
      setPassword('');
      setAdminCode('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setShowPrototypes(false);
      if (prefill) {
        setName(prefill.name ?? '');
        setEmail(prefill.email ?? '');
        setPhone(prefill.phone ?? '');
        setVehicle(prefill.vehicle ?? '');
      } else {
        setName('');
        setEmail('');
        setPhone('');
        setVehicle('');
      }
    }
  }, [open, initialMode, initialRole, prefill]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isSignup = mode === 'signup';

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setError(null);
    setFieldErrors({});
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const clearFieldError = (field: keyof AuthFormErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (error) setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const resolvedStoreName =
      role === 'store'
        ? storeName === '__custom__'
          ? customStoreName.trim()
          : storeName.trim()
        : '';

    if (isSignup) {
      const check = validateSignUpInput({
        name,
        phone,
        role,
        vehicle,
        storeName: resolvedStoreName,
        adminCode,
        email,
        password,
        confirmPassword,
      });
      if (!check.valid) {
        setFieldErrors(check.fieldErrors);
        setError(check.error);
        return;
      }
    } else {
      const check = validateSignInInput({ email, password });
      if (!check.valid) {
        setFieldErrors(check.fieldErrors);
        setError(check.error);
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignup) {
        const res = await registerWithEmail({
          email: email.trim(),
          password,
          name: name.trim(),
          phone: phone.trim(),
          role,
          vehicle: vehicle.trim(),
          storeName: resolvedStoreName,
          adminCode: adminCode.trim(),
        });
        onAuthenticated(res.user);
      } else {
        const res = await loginWithEmail(email.trim(), password);
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const resolvedStoreName =
        storeName === '__custom__' ? customStoreName.trim() : storeName.trim();
      const { user } = await syncGoogleSession(idToken, {
        role: isSignup && role !== 'admin' ? role : undefined,
        phone: phone.trim() || undefined,
        vehicle: vehicle.trim() || undefined,
        storeName: isSignup && role === 'store' ? resolvedStoreName || undefined : undefined,
      });
      onAuthenticated(user);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google Sign-In could not be completed. Use email and password above.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      const res = await loginWithEmail(demoEmail, 'Demo@1234');
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="auth-modal"
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal auth-modal">
        <div className="modal-header">
          <h2 id="auth-title">
            {isSignup ? 'Create Your HazyEats Account' : 'Sign In to HazyEats'}
          </h2>
          <button
            type="button"
            className="close-btn"
            aria-label="Close authentication modal"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <p className="auth-subtitle">
          {isSignup
            ? 'Set up a customer, driver, or partner restaurant profile in Hazyview.'
            : 'Access your orders, restaurant kitchen queue, or driver dispatch.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            id="tab-signin"
            aria-selected={!isSignup}
            className={`auth-tab ${!isSignup ? 'active' : ''}`}
            onClick={() => switchMode('signin')}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            id="tab-signup"
            aria-selected={isSignup}
            className={`auth-tab ${isSignup ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Create Account
          </button>
        </div>

        {notice && !error && (
          <div
            style={{
              background: 'rgba(212, 175, 55, 0.14)',
              border: '1px solid rgba(212, 175, 55, 0.45)',
              color: '#fcf6ba',
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '14px',
            }}
          >
            {notice}
          </div>
        )}

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <form id="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <div id="signup-fields">
              <div className="form-group">
                <label id="auth-role-label">Account Role</label>
                <div
                  className="auth-role-grid"
                  role="radiogroup"
                  aria-labelledby="auth-role-label"
                >
                  {ROLE_OPTIONS.map(({ id, label, subtitle, Icon }) => {
                    const selected = role === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={`auth-role-card ${selected ? 'active' : ''}`}
                        onClick={() => {
                          setRole(id);
                          setFieldErrors({});
                          setError(null);
                        }}
                      >
                        <Icon size={17} className="auth-role-icon" aria-hidden="true" />
                        <span>
                          <span className="auth-role-title">{label}</span>
                          <span className="auth-role-desc">{subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="auth-name">Full Name</label>
                  <input
                    type="text"
                    id="auth-name"
                    autoComplete="name"
                    required
                    placeholder="e.g. Nkosinathi Mokoena"
                    className={fieldErrors.name ? 'auth-input-error' : ''}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearFieldError('name');
                    }}
                  />
                  {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="auth-phone">Phone Number</label>
                  <input
                    type="tel"
                    id="auth-phone"
                    autoComplete="tel"
                    required
                    placeholder="e.g. 072 555 1234"
                    className={fieldErrors.phone ? 'auth-input-error' : ''}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      clearFieldError('phone');
                    }}
                  />
                  {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
                </div>
              </div>

              {role === 'driver' && (
                <div id="driver-extra" className="form-group">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                    }}
                  >
                    <label htmlFor="auth-vehicle" style={{ marginBottom: 0 }}>
                      Vehicle Type &amp; Registration
                    </label>
                    {onOpenDriverOnboarding && (
                      <button
                        type="button"
                        className="gold-text"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '0.78rem',
                        }}
                        onClick={onOpenDriverOnboarding}
                      >
                        Full Driver Onboarding &rarr;
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    id="auth-vehicle"
                    placeholder="e.g. Honda Ace 125 Bike - MP 442 GP"
                    className={fieldErrors.vehicle ? 'auth-input-error' : ''}
                    value={vehicle}
                    onChange={(e) => {
                      setVehicle(e.target.value);
                      clearFieldError('vehicle');
                    }}
                  />
                  {fieldErrors.vehicle && <div className="field-error">{fieldErrors.vehicle}</div>}
                </div>
              )}

              {role === 'store' && (
                <div id="store-extra" className="form-group">
                  <label htmlFor="auth-store-name">Restaurant / Store Name</label>
                  <select
                    id="auth-store-name"
                    value={storeName}
                    onChange={(e) => {
                      setStoreName(e.target.value);
                      clearFieldError('storeName');
                    }}
                  >
                    {INITIAL_STORES_SEED.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                    <option value="__custom__">Other / New Partner Business...</option>
                  </select>
                  {storeName === '__custom__' && (
                    <input
                      type="text"
                      id="auth-store-custom-name"
                      style={{ marginTop: '8px' }}
                      placeholder="Enter your business name"
                      className={fieldErrors.storeName ? 'auth-input-error' : ''}
                      value={customStoreName}
                      onChange={(e) => {
                        setCustomStoreName(e.target.value);
                        clearFieldError('storeName');
                      }}
                    />
                  )}
                  {fieldErrors.storeName && (
                    <div className="field-error">{fieldErrors.storeName}</div>
                  )}
                </div>
              )}

              {role === 'admin' && (
                <div className="form-group">
                  <label htmlFor="auth-admin-code">Admin Access Code</label>
                  <input
                    type="password"
                    id="auth-admin-code"
                    placeholder="Required for new admin accounts"
                    className={fieldErrors.adminCode ? 'auth-input-error' : ''}
                    value={adminCode}
                    onChange={(e) => {
                      setAdminCode(e.target.value);
                      clearFieldError('adminCode');
                    }}
                  />
                  {fieldErrors.adminCode && (
                    <div className="field-error">{fieldErrors.adminCode}</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <input
              type="email"
              id="auth-email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className={fieldErrors.email ? 'auth-input-error' : ''}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError('email');
              }}
            />
            {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
          </div>

          {isSignup ? (
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="auth-pass">Password</label>
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="auth-pass"
                    autoComplete="new-password"
                    required
                    placeholder="Min. 6 characters"
                    className={fieldErrors.password ? 'auth-input-error' : ''}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError('password');
                    }}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="auth-pass-confirm">Confirm Password</label>
                <div className="password-input-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="auth-pass-confirm"
                    autoComplete="new-password"
                    required
                    placeholder="Re-enter password"
                    className={fieldErrors.confirmPassword ? 'auth-input-error' : ''}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearFieldError('confirmPassword');
                    }}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    aria-label={
                      showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                    }
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <div className="field-error">{fieldErrors.confirmPassword}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="auth-pass">Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="auth-pass"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className={fieldErrors.password ? 'auth-input-error' : ''}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError('password');
                  }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
            </div>
          )}

          <button
            type="submit"
            className="btn-gold"
            style={{ width: '100%', minHeight: '42px', marginTop: '4px' }}
            id="auth-submit-btn"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : isSignup
              ? 'Create Account'
              : 'Sign In'}
          </button>
        </form>

        <div className="divider">— OR —</div>

        <button
          type="button"
          className="btn-google"
          style={{ marginBottom: 0 }}
          disabled={loading}
          onClick={handleGoogleSignIn}
        >
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

        {!isSignup && (
          <div className="auth-proto-box">
            <button
              type="button"
              className="auth-proto-toggle"
              aria-expanded={showPrototypes}
              onClick={() => setShowPrototypes((prev) => !prev)}
            >
              <span>
                Quick Prototype Logins ({PROTOTYPE_USERS_SEED.length} Saved Accounts)
              </span>
              {showPrototypes ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </button>

            {showPrototypes && (
              <div className="auth-proto-panel">
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '10px 0 8px' }}>
                  All saved prototype accounts use password <code>Demo@1234</code>:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    disabled={loading}
                    onClick={() => handleDemoLogin('buyer@hazyeats.demo')}
                  >
                    Demo Buyer
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    disabled={loading}
                    onClick={() => handleDemoLogin('driver@hazyeats.demo')}
                  >
                    Demo Driver
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    disabled={loading}
                    onClick={() => handleDemoLogin('store@hazyeats.demo')}
                  >
                    Demo KFC Store
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    disabled={loading}
                    onClick={() => handleDemoLogin('admin@hazyeats.demo')}
                  >
                    Demo Admin
                  </button>
                </div>

                <div
                  style={{
                    marginTop: '10px',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <label htmlFor="prototype-account-select" className="sr-only">
                    Select saved prototype user, driver, or restaurant account
                  </label>
                  <select
                    id="prototype-account-select"
                    value={selectedPrototypeEmail}
                    onChange={(e) => setSelectedPrototypeEmail(e.target.value)}
                    style={{
                      flex: '1 1 200px',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      background: '#121215',
                      border: '1px solid var(--border-subtle)',
                      color: '#fafafa',
                      fontSize: '0.78rem',
                    }}
                  >
                    <optgroup label="Customers (5)">
                      {PROTOTYPE_USERS_SEED.filter((u) => u.role === 'buyer').map((u) => (
                        <option key={u.uid} value={u.email}>
                          {u.name} — {u.email}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Drivers with Saved Details (4)">
                      {PROTOTYPE_USERS_SEED.filter((u) => u.role === 'driver').map((u) => (
                        <option key={u.uid} value={u.email}>
                          {u.name} ({u.vehicle}) — {u.email}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Restaurants & Stores (16)">
                      {PROTOTYPE_USERS_SEED.filter((u) => u.role === 'store').map((u) => (
                        <option key={u.uid} value={u.email}>
                          {u.storeName} — {u.email}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Admin (1)">
                      {PROTOTYPE_USERS_SEED.filter((u) => u.role === 'admin').map((u) => (
                        <option key={u.uid} value={u.email}>
                          {u.name} — {u.email}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <button
                    type="button"
                    className="btn-gold"
                    style={{ padding: '7px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                    disabled={loading}
                    onClick={() => handleDemoLogin(selectedPrototypeEmail)}
                  >
                    Log In Selected
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
