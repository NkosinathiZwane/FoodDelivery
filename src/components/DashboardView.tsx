import { useState, type FormEvent } from 'react';
import type {
  AdminOverviewDTO,
  DriverApplicationDTO,
  DriverApplicationStatus,
  OrderDTO,
  OrderMessageDTO,
  StorePrepStatus,
  UserProfile,
} from '../types.ts';
import { formatZarFromCents, validateVendorPayload } from '../utils/marketplace.ts';
import { ORDER_STATUS, areAllStoresReady } from '../utils/orders.ts';
import { OrderChatPanel } from './OrderChatPanel.tsx';
import { OrderStatusTracker } from './OrderStatusTracker.tsx';

interface DashboardViewProps {
  user: UserProfile;
  orders: OrderDTO[];
  realtimeMessagesByOrder: Record<string, OrderMessageDTO[]>;
  adminOverview: AdminOverviewDTO | null;
  driverApplications: DriverApplicationDTO[];
  loading: boolean;
  error: string | null;
  onStartNewOrder: () => void;
  onOpenDriverOnboarding: () => void;
  onUpdateDriverAppStatus: (
    applicationId: string,
    status: DriverApplicationStatus
  ) => Promise<void>;
  onUpdateStorePrepStatus: (
    orderId: string,
    status: 'Preparing' | 'Ready',
    storeName: string
  ) => Promise<void>;
  onAcceptDelivery: (orderId: string) => Promise<void>;
  onCompleteDelivery: (orderId: string) => Promise<void>;
  onOnboardVendor: (payload: {
    name: string;
    category: string;
    dishName: string;
    priceZar: number;
  }) => Promise<void>;
  onAddStoreMenuItem: (
    storeName: string,
    payload: { name: string; priceZar: number }
  ) => Promise<void>;
}

export function DashboardView({
  user,
  orders,
  realtimeMessagesByOrder,
  adminOverview,
  driverApplications,
  loading,
  error,
  onStartNewOrder,
  onOpenDriverOnboarding,
  onUpdateDriverAppStatus,
  onUpdateStorePrepStatus,
  onAcceptDelivery,
  onCompleteDelivery,
  onOnboardVendor,
  onAddStoreMenuItem,
}: DashboardViewProps) {
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Admin onboard vendor form state
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState('Community');
  const [vendorDish, setVendorDish] = useState('');
  const [vendorPrice, setVendorPrice] = useState('');
  const [vendorBusy, setVendorBusy] = useState(false);
  const [vendorNotice, setVendorNotice] = useState<string | null>(null);
  const [vendorError, setVendorError] = useState<string | null>(null);

  // Store add menu item form state
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishBusy, setDishBusy] = useState(false);
  const [dishNotice, setDishNotice] = useState<string | null>(null);
  const [dishError, setDishError] = useState<string | null>(null);

  const runOrderAction = async (orderId: string, fn: () => Promise<void>) => {
    setActionError(null);
    setBusyOrderId(orderId);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleVendorSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setVendorError(null);
    setVendorNotice(null);

    const priceNum = Number(vendorPrice);
    const check = validateVendorPayload({
      name: vendorName,
      category: vendorCategory,
      dishName: vendorDish,
      priceZar: priceNum,
    });
    if (!check.valid) {
      setVendorError(check.error);
      return;
    }

    setVendorBusy(true);
    try {
      await onOnboardVendor({
        name: vendorName.trim(),
        category: vendorCategory,
        dishName: vendorDish.trim(),
        priceZar: priceNum,
      });
      setVendorNotice(`${vendorName.trim()} is now live on HazyEats!`);
      setVendorName('');
      setVendorDish('');
      setVendorPrice('');
    } catch (err) {
      setVendorError(err instanceof Error ? err.message : 'Failed to publish vendor.');
    } finally {
      setVendorBusy(false);
    }
  };

  const handleAddMenuItemSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDishError(null);
    setDishNotice(null);

    const storeTitle = user.storeName || 'KFC';
    const priceNum = Number(dishPrice);
    if (dishName.trim().length < 2 || !Number.isFinite(priceNum) || priceNum <= 0) {
      setDishError('Please enter a valid dish name and positive ZAR price.');
      return;
    }

    setDishBusy(true);
    try {
      await onAddStoreMenuItem(storeTitle, {
        name: dishName.trim(),
        priceZar: priceNum,
      });
      setDishNotice(`Added "${dishName.trim()}" to ${storeTitle}'s live menu.`);
      setDishName('');
      setDishPrice('');
    } catch (err) {
      setDishError(err instanceof Error ? err.message : 'Failed to add menu item.');
    } finally {
      setDishBusy(false);
    }
  };

  return (
    <main id="view-dashboard" className="dashboard-panel">
      {(error || actionError) && (
        <div className="form-error" style={{ marginBottom: '18px' }}>
          {actionError || error}
        </div>
      )}

      {user.role === 'buyer' && (
        <>
          <h2>
            Welcome back, <span className="gold-text">{user.name}</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Track your multi-store orders to Shabalala in real time.
          </p>
          <button
            type="button"
            className="btn-gold"
            style={{ marginBottom: '20px' }}
            onClick={onStartNewOrder}
          >
            + Start New Multi-Store Order
          </button>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading your orders...</p>
          ) : orders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>
              No orders yet. Click above to order from Hazyview!
            </p>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className={`order-card ${
                  o.status !== ORDER_STATUS.DELIVERED ? 'order-card-active' : ''
                }`}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <strong>
                    {o.id} • {o.stores.join(' + ')}
                  </strong>
                  <span
                    className={`badge ${
                      o.status === ORDER_STATUS.DELIVERED
                        ? 'badge-delivered'
                        : o.status === ORDER_STATUS.READY_FOR_PICKUP
                        ? 'badge-ready'
                        : 'badge-pending'
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Items: {o.items.map((i) => `${i.qty}x ${i.itemName} (${i.storeName})`).join(', ')}
                  <br />
                  Address: {o.address} • Total:{' '}
                  <strong className="gold-text">{formatZarFromCents(o.totalCents)}</strong>
                  <br />
                  Payment:{' '}
                  <strong style={{ color: '#fafafa' }}>
                    {o.paymentStatus} ({o.paymentDetails})
                  </strong>
                  {o.paymentReference ? ` • Ref: ${o.paymentReference}` : ''}
                  {o.driverName && (
                    <>
                      <br />
                      Assigned Driver: <strong>{o.driverName}</strong>
                    </>
                  )}
                </div>

                <OrderStatusTracker order={o} />

                <OrderChatPanel
                  order={o}
                  currentUser={user}
                  realtimeMessages={realtimeMessagesByOrder[o.id] ?? []}
                />
              </div>
            ))
          )}
        </>
      )}

      {user.role === 'store' && (
        <>
          <h2>
            Restaurant Console:{' '}
            <span className="gold-text">{user.storeName || 'KFC'}</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Paid and confirmed orders appear below automatically. Notify the system when kitchen
            preparations begin and once your order is ready for driver pickup.
          </p>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading store orders...</p>
          ) : orders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              No paid orders received for this store yet.
            </p>
          ) : (
            orders.map((o) => {
              const myStore = user.storeName || 'KFC';
              const prepStatus: StorePrepStatus =
                o.storePrepStatuses?.[myStore] ??
                (o.storeReadiness[myStore] ? 'Ready' : 'Received');
              const storeItems = o.items.filter((i) => i.storeName === myStore);
              const otherStores = o.stores.filter((s) => s !== myStore);

              return (
                <div key={o.id} className="order-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 280px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flexWrap: 'wrap',
                          marginBottom: '6px',
                        }}
                      >
                        <strong>{o.id}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          for {o.buyerName} ({o.createdAt})
                        </span>
                        <span
                          className={`badge ${
                            o.paymentStatus === 'Paid' ? 'badge-ready' : 'badge-pending'
                          }`}
                        >
                          {o.paymentStatus === 'Paid'
                            ? `✓ Paid • ${o.paymentDetails}`
                            : `💵 ${o.paymentDetails}`}
                        </span>
                      </div>

                      <div style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        Prepare:{' '}
                        <strong>
                          {storeItems.map((i) => `${i.qty}x ${i.itemName}`).join(', ')}
                        </strong>
                      </div>

                      <div
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.8rem',
                          marginTop: '4px',
                        }}
                      >
                        Payment Ref: <code>{o.paymentReference || 'Confirmed'}</code>
                        {otherStores.length > 0 && (
                          <>
                            {' '}
                            • Multi-store order with:{' '}
                            {otherStores
                              .map(
                                (s) =>
                                  `${s} (${
                                    o.storePrepStatuses?.[s] ??
                                    (o.storeReadiness[s] ? 'Ready' : 'Received')
                                  })`
                              )
                              .join(', ')}
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {prepStatus === 'Received' && (
                        <>
                          <span className="badge badge-pending">Received (Paid)</span>
                          <button
                            type="button"
                            className="btn-gold"
                            disabled={busyOrderId === o.id}
                            onClick={() =>
                              runOrderAction(o.id, () =>
                                onUpdateStorePrepStatus(o.id, 'Preparing', myStore)
                              )
                            }
                          >
                            {busyOrderId === o.id ? 'Updating...' : 'Begin Preparations'}
                          </button>
                          <button
                            type="button"
                            className="btn-outline"
                            disabled={busyOrderId === o.id}
                            onClick={() =>
                              runOrderAction(o.id, () =>
                                onUpdateStorePrepStatus(o.id, 'Ready', myStore)
                              )
                            }
                          >
                            Mark Ready
                          </button>
                        </>
                      )}

                      {prepStatus === 'Preparing' && (
                        <>
                          <span className="badge badge-preparing">Preparations Started</span>
                          <button
                            type="button"
                            className="btn-gold"
                            disabled={busyOrderId === o.id}
                            onClick={() =>
                              runOrderAction(o.id, () =>
                                onUpdateStorePrepStatus(o.id, 'Ready', myStore)
                              )
                            }
                          >
                            {busyOrderId === o.id
                              ? 'Updating...'
                              : 'Mark Ready for Pickup'}
                          </button>
                        </>
                      )}

                      {prepStatus === 'Ready' && (
                        <span className="badge badge-ready">✓ Order Ready for Pickup</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="order-card" style={{ maxWidth: '540px', marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px', fontWeight: 700 }}>
              Add Menu Item to {user.storeName || 'KFC'}
            </h3>
            {dishError && <div className="form-error">{dishError}</div>}
            {dishNotice && <div className="form-success">{dishNotice}</div>}
            <form onSubmit={handleAddMenuItemSubmit}>
              <div className="form-group">
                <label htmlFor="store-dish-name">Item Name</label>
                <input
                  type="text"
                  id="store-dish-name"
                  required
                  placeholder="e.g. Zinger Burger Meal"
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="store-dish-price">Price (ZAR)</label>
                <input
                  type="number"
                  id="store-dish-price"
                  step="0.01"
                  required
                  placeholder="69.90"
                  value={dishPrice}
                  onChange={(e) => setDishPrice(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-gold" disabled={dishBusy}>
                {dishBusy ? 'Saving...' : 'Publish Menu Item'}
              </button>
            </form>
          </div>
        </>
      )}

      {user.role === 'driver' && (
        <>
          <h2>
            Driver Dispatch: <span className="gold-text">{user.name}</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Multi-store rule: Pickup unlocks once <strong>every store</strong> in an order
            marks their food ready.
          </p>

          <div className="stat-grid" style={{ maxWidth: '520px' }}>
            <div className="stat-card">
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Completed Trips
              </div>
              <div className="stat-val">
                {
                  orders.filter(
                    (o) =>
                      o.driverName === user.name && o.status === ORDER_STATUS.DELIVERED
                  ).length
                }
              </div>
            </div>
            <div className="stat-card">
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Fees Earned
              </div>
              <div className="stat-val gold-text">
                {formatZarFromCents(
                  orders.filter(
                    (o) =>
                      o.driverName === user.name && o.status === ORDER_STATUS.DELIVERED
                  ).length * 2000
                )}
              </div>
            </div>
          </div>

          <div className="order-card" style={{ marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong>Saved Driver Profile &amp; Vehicle Details</strong>
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    marginTop: '6px',
                    lineHeight: 1.55,
                  }}
                >
                  Phone: <strong style={{ color: '#fafafa' }}>{user.phone || 'Not set'}</strong>{' '}
                  • Registered Vehicle:{' '}
                  <strong style={{ color: '#fafafa' }}>
                    {user.vehicle || driverApplications[0]?.vehicleType || 'Not set'}
                  </strong>
                  {driverApplications.length > 0 && (
                    <>
                      <br />
                      Application <code>{driverApplications[0].id}</code> • License:{' '}
                      <strong style={{ color: '#fafafa' }}>
                        {driverApplications[0].driversLicenseType}
                      </strong>{' '}
                      • Preferred Area: {driverApplications[0].preferredArea}
                      <br />
                      Availability: {driverApplications[0].availability}
                    </>
                  )}
                </div>
              </div>
              {driverApplications.length > 0 ? (
                <span
                  className={`badge ${
                    driverApplications[0].status === 'Approved'
                      ? 'badge-ready'
                      : 'badge-pending'
                  }`}
                >
                  {driverApplications[0].status}
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={onOpenDriverOnboarding}
                >
                  Complete Onboarding Form
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading dispatch queue...</p>
          ) : orders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No active orders in queue.</p>
          ) : (
            orders.map((o) => {
              const allReady = areAllStoresReady(o.storeReadiness);
              const totalStores = o.stores.length || Object.keys(o.storeReadiness).length;
              const readyStores = Object.values(o.storeReadiness).filter(Boolean).length;
              return (
                <div key={o.id} className="order-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <strong>{o.id}</strong> • Route:{' '}
                      <strong>
                        {o.stores.join(' → ')} → {o.address}
                      </strong>
                      <br />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Store Status ({readyStores}/{totalStores} Ready):{' '}
                        {o.stores
                          .map((storeName) => {
                            const prep =
                              o.storePrepStatuses?.[storeName] ??
                              (o.storeReadiness[storeName] ? 'Ready' : 'Received');
                            return `${storeName}: ${prep}`;
                          })
                          .join(' | ')}
                      </span>
                    </div>

                    <div>
                      {o.status === ORDER_STATUS.DELIVERED ? (
                        <span className="badge badge-delivered">
                          Delivered (R20 Earned)
                        </span>
                      ) : o.driverName === user.name ? (
                        <button
                          type="button"
                          className="btn-gold"
                          disabled={busyOrderId === o.id}
                          onClick={() =>
                            runOrderAction(o.id, () => onCompleteDelivery(o.id))
                          }
                        >
                          {busyOrderId === o.id
                            ? 'Confirming...'
                            : 'Confirm Delivered to Customer'}
                        </button>
                      ) : o.driverName ? (
                        <span className="badge badge-delivered">
                          Claimed by {o.driverName}
                        </span>
                      ) : allReady ? (
                        <button
                          type="button"
                          className="btn-gold"
                          disabled={busyOrderId === o.id}
                          onClick={() =>
                            runOrderAction(o.id, () => onAcceptDelivery(o.id))
                          }
                        >
                          {busyOrderId === o.id
                            ? 'Accepting...'
                            : 'Start Pickup (All Stores Ready • R20 Fee)'}
                        </button>
                      ) : (
                        <span className="badge badge-pending">
                          Pickup Locked ({readyStores}/{totalStores} Stores Ready)
                        </span>
                      )}
                    </div>
                  </div>

                  {(o.driverId === user.id || o.driverName === user.name) && (
                    <OrderChatPanel
                      order={o}
                      currentUser={user}
                      realtimeMessages={realtimeMessagesByOrder[o.id] ?? []}
                    />
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {user.role === 'admin' && (
        <>
          <h2>
            ZikCode <span className="gold-text">Admin Command Center</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
            Real-time marketplace metrics, vendor onboarding, and live multi-store order flow.
          </p>

          <div className="stat-grid">
            <div className="stat-card">
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Total GMV
              </div>
              <div className="stat-val gold-text">
                {loading && !adminOverview
                  ? '…'
                  : formatZarFromCents(
                      adminOverview?.totalGmvCents ??
                        orders.reduce((sum, o) => sum + o.totalCents, 0)
                    )}
              </div>
            </div>
            <div className="stat-card">
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Active Stores
              </div>
              <div className="stat-val">
                {loading && !adminOverview ? '…' : adminOverview?.activeStores ?? '—'}
              </div>
            </div>
            <div className="stat-card">
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Registered Users
              </div>
              <div className="stat-val">
                {loading && !adminOverview ? '…' : adminOverview?.registeredUsers ?? '—'}
              </div>
            </div>
            <div className="stat-card">
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Total Orders
              </div>
              <div className="stat-val">
                {loading && !adminOverview
                  ? '…'
                  : adminOverview?.totalOrders ?? orders.length}
              </div>
            </div>
          </div>

          <div className="order-card" style={{ maxWidth: '540px', marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px', fontWeight: 700 }}>
              Onboard New Shabalala / Hazyview Vendor
            </h3>
            {vendorError && <div className="form-error">{vendorError}</div>}
            {vendorNotice && <div className="form-success">{vendorNotice}</div>}

            <form onSubmit={handleVendorSubmit}>
              <div className="form-group">
                <label htmlFor="v-name">Vendor / Business Name</label>
                <input
                  type="text"
                  id="v-name"
                  required
                  placeholder="e.g. Shabalala Bunny Chow Express"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
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
                  type="text"
                  id="v-dish"
                  required
                  placeholder="e.g. Quarter Mutton Bunny Chow"
                  value={vendorDish}
                  onChange={(e) => setVendorDish(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="v-price">Price (ZAR)</label>
                <input
                  type="number"
                  id="v-price"
                  step="0.01"
                  required
                  placeholder="45"
                  value={vendorPrice}
                  onChange={(e) => setVendorPrice(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-gold" disabled={vendorBusy}>
                {vendorBusy ? 'Publishing...' : 'Add Vendor & Publish Live'}
              </button>
            </form>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '12px', fontWeight: 700 }}>
              Driver Onboarding Applications ({driverApplications.length})
            </h3>
            {driverApplications.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No driver onboarding applications submitted yet.
              </p>
            ) : (
              driverApplications.map((app) => (
                <div key={app.id} className="order-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flex: '1 1 320px' }}>
                      <strong>
                        {app.firstName} {app.lastName}
                      </strong>{' '}
                      • <code>{app.id}</code>
                      <div
                        style={{
                          fontSize: '0.84rem',
                          color: 'var(--text-muted)',
                          marginTop: '4px',
                          lineHeight: 1.55,
                        }}
                      >
                        {app.email} • {app.phone} • DOB: {app.dateOfBirth}
                        <br />
                        Address: {app.streetAddress}
                        {app.streetAddressLine2 ? `, ${app.streetAddressLine2}` : ''},{' '}
                        {app.city}, {app.stateProvince} {app.postalCode}
                        <br />
                        Area: <strong>{app.preferredArea}</strong> • Vehicle:{' '}
                        <strong>{app.vehicleType}</strong> • License:{' '}
                        <strong>{app.driversLicenseType}</strong>
                        <br />
                        Availability: {app.availability} • Prior Experience:{' '}
                        {app.hasPriorExperience ? 'Yes' : 'No'}
                        <br />
                        Emergency: {app.emergencyContactName} ({app.emergencyContactPhone})
                        {app.documents.length > 0 && (
                          <>
                            <br />
                            Documents: {app.documents.map((d) => d.fileName).join(', ')}
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '8px',
                      }}
                    >
                      <span
                        className={`badge ${
                          app.status === 'Approved'
                            ? 'badge-ready'
                            : app.status === 'Rejected'
                            ? 'badge-delivered'
                            : 'badge-pending'
                        }`}
                      >
                        {app.status}
                      </span>
                      {app.signatureDataUrl && (
                        <img
                          src={app.signatureDataUrl}
                          alt={`${app.firstName} ${app.lastName} signature`}
                          style={{
                            height: '38px',
                            background: '#09090b',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            padding: '2px 6px',
                          }}
                        />
                      )}
                      {app.status === 'Pending Review' && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn-gold"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            disabled={busyOrderId === app.id}
                            onClick={() =>
                              runOrderAction(app.id, () =>
                                onUpdateDriverAppStatus(app.id, 'Approved')
                              )
                            }
                          >
                            Approve Driver
                          </button>
                          <button
                            type="button"
                            className="btn-outline"
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            disabled={busyOrderId === app.id}
                            onClick={() =>
                              runOrderAction(app.id, () =>
                                onUpdateDriverAppStatus(app.id, 'Rejected')
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {orders.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '12px', fontWeight: 700 }}>Live Order Stream</h3>
              {orders.slice(0, 10).map((o) => (
                <div key={o.id} className="order-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <strong>{o.id}</strong> • {o.buyerName} • {o.stores.join(' + ')}
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        {o.address} • {formatZarFromCents(o.totalCents)}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        o.status === ORDER_STATUS.DELIVERED
                          ? 'badge-delivered'
                          : o.status === ORDER_STATUS.READY_FOR_PICKUP
                          ? 'badge-ready'
                          : 'badge-pending'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

