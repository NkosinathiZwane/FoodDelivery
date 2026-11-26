import { useState } from 'react';
import type { AppNotification, Profile } from '../types';
import { formatSaDateTime } from '../utils/format';

interface HeaderProps {
  profile: Profile | null;
  activeView: 'marketplace' | 'dashboard';
  notifications: AppNotification[];
  onSwitchView: (view: 'marketplace' | 'dashboard') => void;
  onOpenAuth: (mode: 'signin' | 'signup', defaultRole?: 'buyer' | 'driver' | 'store') => void;
  onLogout: () => void;
  onMarkNotificationsRead: () => void;
}

export function Header({
  profile,
  activeView,
  notifications,
  onSwitchView,
  onOpenAuth,
  onLogout,
  onMarkNotificationsRead,
}: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function toggleNotifs() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next && unreadCount > 0) {
      onMarkNotificationsRead();
    }
  }

  return (
    <header>
      <div className="brand" onClick={() => onSwitchView('marketplace')}>
        <div className="bag-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 7h12l1 13H5L6 7Z" />
            <path d="M9 7V5a3 3 0 0 1 6 0v2" />
          </svg>
        </div>
        <span>
          Hazy<span className="gold-text">Eats</span>
        </span>
      </div>

      <div className="nav-actions" id="nav-actions">
        {!profile ? (
          <>
            <button type="button" className="btn-outline" onClick={() => onOpenAuth('signin')}>
              Sign In
            </button>
            <button type="button" className="btn-gold" onClick={() => onOpenAuth('signup')}>
              Sign Up
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-outline" onClick={toggleNotifs}>
              Alerts{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
            <button
              type="button"
              className={activeView === 'marketplace' ? 'btn-gold' : 'btn-outline'}
              onClick={() => onSwitchView('marketplace')}
            >
              Browse Stores
            </button>
            <button
              type="button"
              className={activeView === 'dashboard' ? 'btn-gold' : 'btn-outline'}
              onClick={() => onSwitchView('dashboard')}
            >
              {profile.role.toUpperCase()} Dashboard
            </button>
            <button type="button" className="btn-outline" onClick={onLogout}>
              Logout
            </button>

            {notifOpen && (
              <div className="notif-popover">
                <div className="modal-header" style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: '0.92rem' }}>Live Alerts</strong>
                  <button type="button" className="close-btn" onClick={() => setNotifOpen(false)}>
                    &times;
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    No notifications yet.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.84rem',
                      }}
                    >
                      <div>{n.text}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: 2 }}>
                        {formatSaDateTime(n.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
