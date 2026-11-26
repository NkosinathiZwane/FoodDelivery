import { useState } from 'react';
import type { BuyerOrder, Profile } from '../types';
import {
  formatOrderStatus,
  formatSaDateTime,
  formatStorePartStatus,
  formatZar,
  getTimelineSteps,
  toTelHref,
  toWhatsAppUrl,
} from '../utils/format';

interface BuyerDashboardProps {
  profile: Profile;
  orders: BuyerOrder[];
  loading: boolean;
  onStartNewOrder: () => void;
  onCancelOrder: (orderId: string) => Promise<void>;
}

function statusBadgeClass(status: BuyerOrder['status']): string {
  if (status === 'delivered') return 'badge-delivered';
  if (status === 'cancelled') return 'badge-cancelled';
  if (status === 'ready_for_pickup' || status === 'out_for_delivery') return 'badge-ready';
  return 'badge-pending';
}

export function BuyerDashboard({
  profile,
  orders,
  loading,
  onStartNewOrder,
  onCancelOrder,
}: BuyerDashboardProps) {
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const activeOrders = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  );
  const pastOrders = orders.filter(
    (o) => o.status === 'delivered' || o.status === 'cancelled'
  );

  async function handleCancelConfirm(orderId: string) {
    setBusyOrderId(orderId);
    try {
      await onCancelOrder(orderId);
      setConfirmCancelId(null);
    } finally {
      setBusyOrderId(null);
    }
  }

  function renderOrderCard(order: BuyerOrder) {
    const canCancel =
      order.status === 'placed' &&
      !order.parts.some((p) => p.status === 'accepted' || p.status === 'ready');
    const timeline = getTimelineSteps(order.status);

    return (
      <div key={order.id} className="order-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <div>
            <strong>
              {order.code} • {order.parts.map((p) => p.store_name).join(' + ')}
            </strong>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Placed {formatSaDateTime(order.created_at)}
            </div>
          </div>
          <span className={`badge ${statusBadgeClass(order.status)}`}>
            {formatOrderStatus(order.status)}
          </span>
        </div>

        {order.status !== 'cancelled' && (
          <div className="timeline">
            {timeline.map((step) => (
              <div
                key={step.key}
                className={`timeline-step ${
                  step.state === 'done'
                    ? 'done'
                    : step.state === 'current'
                      ? 'current'
                      : ''
                }`}
              >
                {step.label}
              </div>
            ))}
          </div>
        )}

        <div style={{ margin: '10px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {order.parts.map((part) => (
            <span
              key={part.id}
              className={`badge ${
                part.status === 'ready'
                  ? 'badge-ready'
                  : part.status === 'rejected'
                    ? 'badge-cancelled'
                    : 'badge-pending'
              }`}
            >
              {part.store_name}: {formatStorePartStatus(part.status)}
              {part.status === 'rejected' && part.reason ? ` (${part.reason})` : ''}
            </span>
          ))}
        </div>

        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <div>
            Items:{' '}
            {order.items
              .map((i) => `${i.qty}x ${i.name} (${i.store_name})`)
              .join(', ')}
          </div>
          <div>
            Address: {order.address}
            {order.notes ? ` • Notes: ${order.notes}` : ''}
          </div>
          <div>
            Subtotal: {formatZar(order.subtotal)} • Delivery:{' '}
            {formatZar(order.delivery_fee)} • Total:{' '}
            <strong className="gold-text">{formatZar(order.total)}</strong>
          </div>
        </div>

        {order.driver && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                Driver: <span className="gold-text">{order.driver.name}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {order.driver.vehicle || 'HazyEats Delivery Partner'}
              </div>
            </div>
            {order.driver.phone && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a className="btn-outline" href={toTelHref(order.driver.phone)}>
                  Call Driver
                </a>
                <a
                  className="btn-gold"
                  href={toWhatsAppUrl(
                    order.driver.phone,
                    `Hi ${order.driver.name}, checking on HazyEats order ${order.code}`
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp Driver
                </a>
              </div>
            )}
          </div>
        )}

        {canCancel && (
          <div className="modal-actions">
            {confirmCancelId === order.id ? (
              <>
                <button
                  type="button"
                  className="btn-danger-outline"
                  disabled={busyOrderId === order.id}
                  onClick={() => handleCancelConfirm(order.id)}
                >
                  {busyOrderId === order.id ? 'Cancelling...' : 'Confirm Cancel Order'}
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setConfirmCancelId(null)}
                >
                  Keep Order
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => setConfirmCancelId(order.id)}
              >
                Cancel Order
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2>
        Welcome back, <span className="gold-text">{profile.name}</span>
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
        Track your multi-store orders to Shabalala in real time.
      </p>
      <button
        type="button"
        className="btn-gold"
        style={{ marginBottom: 24 }}
        onClick={onStartNewOrder}
      >
        + Start New Multi-Store Order
      </button>

      {loading ? (
        <div className="skeleton-card" />
      ) : (
        <>
          <h3 style={{ marginBottom: 12 }}>Active Orders ({activeOrders.length})</h3>
          {activeOrders.length === 0 ? (
            <div className="empty-state">
              No active orders right now. Browse Hazyview &amp; Shabalala stores to place one.
            </div>
          ) : (
            activeOrders.map(renderOrderCard)
          )}

          <h3 style={{ margin: '26px 0 12px' }}>Order History ({pastOrders.length})</h3>
          {pastOrders.length === 0 ? (
            <div className="empty-state">No completed or cancelled orders yet.</div>
          ) : (
            pastOrders.map(renderOrderCard)
          )}
        </>
      )}
    </div>
  );
}
