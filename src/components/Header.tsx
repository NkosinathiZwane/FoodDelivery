import type { UserProfile } from '../types.ts';

interface HeaderProps {
  user: UserProfile | null;
  onNavigate: (view: 'marketplace' | 'dashboard') => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onLogout: () => void;
}

export function Header({ user, onNavigate, onOpenAuth, onLogout }: HeaderProps) {
  return (
    <header className="hazy-header">
      <button
        type="button"
        className="brand"
        onClick={() => onNavigate('marketplace')}
        aria-label="HazyEats home"
      >
        <div className="bag-icon" aria-hidden="true">
          🛍️
        </div>
        <span>
          Hazy<span className="gold-text">Eats</span>
        </span>
      </button>

      <nav className="nav-actions" aria-label="Primary navigation">
        {!user ? (
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => onOpenAuth('signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              className="btn-gold"
              onClick={() => onOpenAuth('signup')}
            >
              Sign Up
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => onNavigate('marketplace')}
            >
              Browse Stores
            </button>
            <button
              type="button"
              className="btn-gold"
              onClick={() => onNavigate('dashboard')}
            >
              {user.role.toUpperCase()} Dashboard
            </button>
            <button type="button" className="btn-outline" onClick={onLogout}>
              Logout
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
