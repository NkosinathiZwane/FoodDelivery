import { useState, type FormEvent } from 'react';
import type { Profile } from '../types';

interface GoogleOnboardingModalProps {
  profile: Profile | null;
  onComplete: (params: {
    role: 'buyer' | 'driver' | 'store';
    name: string;
    phone: string;
    vehicle?: string;
    storeName?: string;
    storeCategory?: string;
  }) => Promise<void>;
}

export function GoogleOnboardingModal({ profile, onComplete }: GoogleOnboardingModalProps) {
  const [role, setRole] = useState<'buyer' | 'driver' | 'store'>('buyer');
  const [name, setName] = useState(profile?.name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [vehicle, setVehicle] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeCategory, setStoreCategory] = useState('Restaurant');
  const [errorText, setErrorText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!profile || !profile.needs_onboarding) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorText('');
    setBusy(true);
    try {
      await onComplete({
        role,
        name: name || profile?.name || 'HazyEats Member',
        phone,
        vehicle,
        storeName,
        storeCategory,
      });
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Unable to save account details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop open">
      <div className="modal">
        <div className="modal-header">
          <h2>
            Complete Your <span className="gold-text">HazyEats</span> Profile
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginBottom: 16 }}>
          Tell us how you will use HazyEats and add your contact number for deliveries.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="onboard-name">Full Name</label>
            <input
              id="onboard-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="onboard-phone">Phone Number (WhatsApp / Call)</label>
            <input
              id="onboard-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 072 555 1234"
            />
          </div>

          <div className="form-group">
            <label htmlFor="onboard-role">Account Role</label>
            <select
              id="onboard-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'buyer' | 'driver' | 'store')}
            >
              <option value="buyer">Customer (Order Food to Shabalala)</option>
              <option value="driver">Driver / Delivery Partner</option>
              <option value="store">Store / Community Vendor</option>
            </select>
          </div>

          {role === 'driver' && (
            <div className="form-group">
              <label htmlFor="onboard-vehicle">Vehicle Type &amp; Registration</label>
              <input
                id="onboard-vehicle"
                type="text"
                required
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder="e.g. Honda Ace 125 Bike - MP 442 GP"
              />
            </div>
          )}

          {role === 'store' && (
            <>
              <div className="form-group">
                <label htmlFor="onboard-store-name">Store / Business Name</label>
                <input
                  id="onboard-store-name"
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Shabalala Kota Hub"
                />
              </div>
              <div className="form-group">
                <label htmlFor="onboard-store-cat">Store Category</label>
                <select
                  id="onboard-store-cat"
                  value={storeCategory}
                  onChange={(e) => setStoreCategory(e.target.value)}
                >
                  <option value="Community">Community</option>
                  <option value="Fast food">Fast food</option>
                  <option value="Pizza">Pizza</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Groceries">Groceries</option>
                </select>
              </div>
            </>
          )}

          {errorText && <div className="form-error">{errorText}</div>}

          <button type="submit" className="btn-gold" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Saving...' : 'Continue to HazyEats'}
          </button>
        </form>
      </div>
    </div>
  );
}
