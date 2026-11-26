import { useState, type FormEvent } from 'react';
import type { AdminDashboardData } from '../types';
import { formatOrderStatus, formatSaDateTime, formatZar } from '../utils/format';

interface AdminDashboardProps {
  data: AdminDashboardData | null;
  loading: boolean;
  currentUserId: string;
  onSetStoreApproval: (storeId: string, approved: boolean) => Promise<void>;
  onOnboardVendor: (params: {
    name: string;
    category: string;
    dishName: string;
    price: number;
    ownerEmail?: string;
  }) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  onReassignDriver: (orderId: string, driverId: string) => Promise<void>;
  onSetUserActive: (userId: string, active: boolean) => Promise<void>;
}

export function AdminDashboard({
  data,
  loading,
  currentUserId,
  onSetStoreApproval,
  onOnboardVendor,
  onCancelOrder,
  onReassignDriver,
  onSetUserActive,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<'stores' | 'orders' | 'users' | 'onboard'>('stores');
  const [driverPick, setDriverPick] = useState<Record<string, string>>({});

  // Onboard vendor form state
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('Community');
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !data) {
    return <div className="skeleton-card" />;
  }

  if (!data) {
    return <div className="empty-state">Unable to load admin data right now.</div>;
  }

  async function handleOnboard(e: FormEvent) {
    e.preventDefault();
    const numericPrice = Number(dishPrice);
    if (!vendorName.trim() || !dishName.trim() || Number.isNaN(numericPrice) || numericPrice < 0) {
      return;
    }
    setBusy(true);
    try {
      await onOnboardVendor({
        name: vendorName,
        category: vendorCategory,
        dishName,
        price: numericPrice,
        ownerEmail,
      });
      setVendorName('');
      setDishName('');
      setDishPrice('');
      setOwnerEmail('');
      setTab('stores');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>
        ZikCode <span className="gold-text">Admin Command Center</span>
      </h2>

      <div className="stat-grid" style={{ marginTop: 18 }}>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total GMV</div>
          <div className="stat-val gold-text">{formatZar(data.stats.gmv)}</div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Stores</div>
          <div className="stat-val">{data.stats.stores}</div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Registered Users</div>
          <div className="stat-val">{data.stats.users}</div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Orders</div>
          <div className="stat-val">{data.stats.orders}</div>
        </div>
      </div>

      <div className="dash-tabs">
        <button
          type="button"
          className={`chip ${tab === 'stores' ? 'active' : ''}`}
          onClick={() => setTab('stores')}
        >
          Stores ({data.stores.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === 'orders' ? 'active' : ''}`}
          onClick={() => setTab('orders')}
        >
          Orders ({data.orders.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          Users ({data.users.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === 'onboard' ? 'active' : ''}`}
          onClick={() => setTab('onboard')}
        >
          Onboard Vendor
        </button>
      </div>

      {tab === 'stores' && (
        <div>
          {data.stores.map((s) => (
            <div key={s.id} className="order-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <strong>{s.name}</strong> • {s.category} • {s.delivery_time}
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {s.owner_email ? `Owner: ${s.owner_name} (${s.owner_email})` : 'Managed Catalog Store'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${s.is_approved ? 'badge-ready' : 'badge-pending'}`}>
                    {s.is_approved ? 'Approved' : 'Pending Approval'}
                  </span>
                  <button
                    type="button"
                    className={s.is_approved ? 'btn-danger-outline' : 'btn-gold'}
                    onClick={() => onSetStoreApproval(s.id, !s.is_approved)}
                  >
                    {s.is_approved ? 'Suspend' : 'Approve Store'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'orders' && (
        <div>
          {data.orders.map((ord) => {
            const selectedDriver = driverPick[ord.id] ?? ord.driver_id ?? '';
            return (
              <div key={ord.id} className="order-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <strong>{ord.code}</strong> • {ord.buyer_name} •{' '}
                    <span className="gold-text">{formatZar(ord.total)}</span>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {ord.address} • {formatSaDateTime(ord.created_at)} • Driver:{' '}
                      {ord.driver_name || 'Unassigned'}
                    </div>
                  </div>
                  <span className="badge badge-pending">{formatOrderStatus(ord.status)}</span>
                </div>

                {ord.status !== 'delivered' && ord.status !== 'cancelled' && (
                  <div className="modal-actions">
                    <select
                      aria-label={`Select driver for ${ord.code}`}
                      value={selectedDriver}
                      onChange={(e) =>
                        setDriverPick((prev) => ({ ...prev, [ord.id]: e.target.value }))
                      }
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: '#09090b',
                        border: '1px solid var(--border-subtle)',
                        color: '#fff',
                      }}
                    >
                      <option value="">Choose driver...</option>
                      {data.drivers.map((drv) => (
                        <option key={drv.id} value={drv.id}>
                          {drv.name} ({drv.is_online ? 'Online' : 'Offline'})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={!selectedDriver}
                      onClick={() => onReassignDriver(ord.id, selectedDriver)}
                    >
                      Assign Driver
                    </button>
                    <button
                      type="button"
                      className="btn-danger-outline"
                      onClick={() => onCancelOrder(ord.id)}
                    >
                      Cancel Order
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'users' && (
        <div>
          {data.users.map((u) => (
            <div key={u.id} className="order-card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <strong>{u.name}</strong> ({u.role.toUpperCase()})
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {u.email} • {u.phone || 'No phone'} • Joined {formatSaDateTime(u.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${u.is_active ? 'badge-ready' : 'badge-cancelled'}`}>
                    {u.is_active ? 'Active' : 'Suspended'}
                  </span>
                  {u.id !== currentUserId && (
                    <button
                      type="button"
                      className={u.is_active ? 'btn-danger-outline' : 'btn-gold'}
                      onClick={() => onSetUserActive(u.id, !u.is_active)}
                    >
                      {u.is_active ? 'Suspend User' : 'Reactivate'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'onboard' && (
        <div className="order-card" style={{ maxWidth: 540 }}>
          <h3 style={{ marginBottom: 12 }}>Onboard New Shabalala / Hazyview Vendor</h3>
          <form onSubmit={handleOnboard}>
            <div className="form-group">
              <label htmlFor="v-name">Vendor / Business Name</label>
              <input
                id="v-name"
                type="text"
                required
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Shabalala Bunny Chow Express"
              />
            </div>
            <div className="form-group">
              <label htmlFor="v-cat">Category</label>
              <select
                id="v-cat"
                value={vendorCategory}
                onChange={(e) => setVendorCategory(e.target.value)}
              >
                <option value="Community">Community</option>
                <option value="Fast food">Fast food</option>
                <option value="Pizza">Pizza</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Groceries">Groceries</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="v-dish">Signature Dish Name</label>
              <input
                id="v-dish"
                type="text"
                required
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder="e.g. Quarter Mutton Bunny Chow"
              />
            </div>
            <div className="form-group">
              <label htmlFor="v-price">Price (ZAR)</label>
              <input
                id="v-price"
                type="number"
                step="0.01"
                min="0"
                required
                value={dishPrice}
                onChange={(e) => setDishPrice(e.target.value)}
                placeholder="45"
              />
            </div>
            <div className="form-group">
              <label htmlFor="v-owner-email">Owner Email (Optional)</label>
              <input
                id="v-owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@example.com"
              />
            </div>
            <button type="submit" className="btn-gold" disabled={busy}>
              {busy ? 'Publishing...' : 'Add Vendor & Publish Live'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
