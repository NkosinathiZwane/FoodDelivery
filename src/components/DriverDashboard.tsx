import { useState } from 'react';
import type { DriverDashboardData, Profile } from '../types';
import {
  formatSaDateTime,
  formatZar,
  isSameSaDay,
  toTelHref,
  toWhatsAppUrl,
} from '../utils/format';

interface DriverDashboardProps {
  profile: Profile;
  data: DriverDashboardData;
  loading: boolean;
  onToggleOnline: (online: boolean) => Promise<void>;
  onAcceptJob: (orderId: string) => Promise<void>;
  onUpdateStatus: (orderId: string, status: 'out_for_delivery' | 'delivered') => Promise<void>;
}

export function DriverDashboard({
  profile,
  data,
  loading,
  onToggleOnline,
  onAcceptJob,
  onUpdateStatus,
}: DriverDashboardProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const todayEarnings = data.history
    .filter((h) => isSameSaDay(h.delivered_at))
    .reduce((sum, h) => sum + Number(h.delivery_fee || 20), 0);
  const totalEarnings = data.history.reduce(
    (sum, h) => sum + Number(h.delivery_fee || 20),
    0
  );

  return (
    <div>
      <h2>
        Driver Dispatch: <span className="gold-text">{profile.name}</span>
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>
        Multi-store rule: Pickup unlocks once <strong>every store</strong> in an order marks their food ready.
      </p>

      <div className="switch-row">
        <div>
          <strong>Duty Status</strong>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {profile.is_online
              ? 'Online — receiving live ready_for_pickup delivery jobs'
              : 'Offline — go online to see available pickup jobs'}
          </div>
        </div>
        <button
          type="button"
          className={profile.is_online ? 'btn-gold' : 'btn-outline'}
          onClick={() => onToggleOnline(!profile.is_online)}
        >
          {profile.is_online ? 'Online' : 'Offline'}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Today&apos;s Earnings</div>
          <div className="stat-val gold-text">{formatZar(todayEarnings)}</div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Earnings</div>
          <div className="stat-val">{formatZar(totalEarnings)}</div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Completed Trips</div>
          <div className="stat-val">{data.history.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton-card" />
      ) : (
        <>
          <h3 style={{ marginBottom: 12 }}>Active Assigned Deliveries ({data.active.length})</h3>
          {data.active.length === 0 ? (
            <div className="empty-state">No active delivery assigned to you.</div>
          ) : (
            data.active.map((job) => (
              <div key={job.id} className="order-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <strong>
                    {job.code} • {job.stores.map((s) => s.store_name).join(' → ')}
                  </strong>
                  <span className="badge badge-pickup">
                    {job.status === 'out_for_delivery' ? 'Out for Delivery' : 'Ready for Pickup'}
                  </span>
                </div>

                <div style={{ marginBottom: 12 }}>
                  {job.stores.map((store) => (
                    <div
                      key={store.store_id}
                      style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 4 }}
                    >
                      <strong style={{ color: 'var(--text-main)' }}>{store.store_name}:</strong>{' '}
                      {store.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    paddingTop: 10,
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '0.88rem',
                    lineHeight: 1.55,
                  }}
                >
                  <div>
                    Customer: <strong>{job.buyer_name}</strong>
                  </div>
                  <div>
                    Address: <strong>{job.address}</strong>
                  </div>
                  {job.notes && (
                    <div style={{ color: 'var(--text-muted)' }}>Notes: {job.notes}</div>
                  )}
                </div>

                <div className="modal-actions">
                  {job.buyer_phone && (
                    <>
                      <a className="btn-outline" href={toTelHref(job.buyer_phone)}>
                        Call Customer
                      </a>
                      <a
                        className="btn-outline"
                        href={toWhatsAppUrl(
                          job.buyer_phone,
                          `Hi ${job.buyer_name}, this is ${profile.name} from HazyEats with order ${job.code}.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp Customer
                      </a>
                    </>
                  )}

                  {job.status === 'ready_for_pickup' ? (
                    <button
                      type="button"
                      className="btn-gold"
                      disabled={busyId === job.id}
                      onClick={async () => {
                        setBusyId(job.id);
                        try {
                          await onUpdateStatus(job.id, 'out_for_delivery');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      Picked Up
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-gold"
                      disabled={busyId === job.id}
                      onClick={async () => {
                        setBusyId(job.id);
                        try {
                          await onUpdateStatus(job.id, 'delivered');
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      Confirm Delivered
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          <h3 style={{ margin: '24px 0 12px' }}>Available Jobs ({data.available.length})</h3>
          {!profile.is_online ? (
            <div className="empty-state">Switch Online above to view and accept ready pickup jobs.</div>
          ) : data.available.length === 0 ? (
            <div className="empty-state">No orders waiting for pickup right now.</div>
          ) : (
            data.available.map((job) => (
              <div key={job.id} className="order-card">
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
                    <strong>{job.code}</strong> • Route:{' '}
                    <strong>{job.stores.map((s) => s.store_name).join(' → ')}</strong>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {job.stores
                        .map(
                          (s) =>
                            `${s.store_name} (${s.items.map((i) => `${i.qty}x ${i.name}`).join(', ')})`
                        )
                        .join(' | ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-gold"
                    disabled={busyId === job.id}
                    onClick={async () => {
                      setBusyId(job.id);
                      try {
                        await onAcceptJob(job.id);
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    Accept Pickup ({formatZar(job.delivery_fee)} Fee)
                  </button>
                </div>
              </div>
            ))
          )}

          <h3 style={{ margin: '24px 0 12px' }}>Delivery History ({data.history.length})</h3>
          {data.history.length === 0 ? (
            <div className="empty-state">Completed deliveries will appear here.</div>
          ) : (
            data.history.map((item) => (
              <div key={item.id} className="order-card">
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
                    <strong>{item.code}</strong> • {item.store_names.join(' + ')}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Delivered {formatSaDateTime(item.delivered_at)}
                    </div>
                  </div>
                  <span className="badge badge-delivered">
                    Delivered ({formatZar(item.delivery_fee)} Earned)
                  </span>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
