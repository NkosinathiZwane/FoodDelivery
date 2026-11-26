import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { MenuItem, MenuItemGroup, Store, StoreOrderPartView } from '../types';
import {
  formatSaDateTime,
  formatStorePartStatus,
  formatZar,
  isSameSaDay,
  menuGroupLabel,
  sortMenuItems,
} from '../utils/format';

interface StoreDashboardProps {
  store: Store | null;
  orders: StoreOrderPartView[];
  loading: boolean;
  onRespondOrderPart: (partId: string, action: 'accept' | 'reject' | 'ready', reason?: string) => Promise<void>;
  onToggleStoreOpen: (isOpen: boolean) => Promise<void>;
  onUpdateStoreDetails: (patch: { name: string; category: string; delivery_time: string; logo_url: string }) => Promise<void>;
  onSaveMenuItem: (params: {
    id?: string;
    name: string;
    price: number;
    item_group: MenuItemGroup;
    image_url?: string;
    is_available?: boolean;
  }) => Promise<void>;
  onToggleItemAvailability: (itemId: string, isAvailable: boolean) => Promise<void>;
  onDeleteMenuItem: (itemId: string) => Promise<void>;
  onUploadAsset: (folder: 'logos' | 'items', file: File) => Promise<string>;
}

export function StoreDashboard({
  store,
  orders,
  loading,
  onRespondOrderPart,
  onToggleStoreOpen,
  onUpdateStoreDetails,
  onSaveMenuItem,
  onToggleItemAvailability,
  onDeleteMenuItem,
  onUploadAsset,
}: StoreDashboardProps) {
  const [tab, setTab] = useState<'orders' | 'menu' | 'settings'>('orders');
  const [rejectingPartId, setRejectingPartId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Menu Editor state
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemGroup, setItemGroup] = useState<MenuItemGroup>('main');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Store Settings state
  const [storeName, setStoreName] = useState(store?.name || '');
  const [storeCategory, setStoreCategory] = useState(store?.category || 'Restaurant');
  const [deliveryTime, setDeliveryTime] = useState(store?.delivery_time || '30–45 min');
  const [logoUrl, setLogoUrl] = useState(store?.logo_url || '');

  useEffect(() => {
    if (store) {
      setStoreName(store.name);
      setStoreCategory(store.category);
      setDeliveryTime(store.delivery_time);
      setLogoUrl(store.logo_url);
    }
  }, [store]);

  if (loading && !store) {
    return <div className="skeleton-card" />;
  }

  if (!store) {
    return (
      <div className="empty-state">
        No store profile is linked to this account yet. Contact HazyEats support if you need help linking your vendor account.
      </div>
    );
  }

  const todayOrders = orders.filter(
    (o) => isSameSaDay(o.created_at) && o.part_status !== 'rejected' && o.order_status !== 'cancelled'
  );
  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.store_subtotal), 0);
  const sortedMenu = sortMenuItems(store.menu);

  function startEditItem(item: MenuItem) {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemPrice(String(item.price));
    setItemGroup(item.item_group);
    setItemImageUrl(item.image_url);
  }

  function resetItemForm() {
    setEditingItemId(undefined);
    setItemName('');
    setItemPrice('');
    setItemGroup('main');
    setItemImageUrl('');
  }

  async function handleMenuSubmit(e: FormEvent) {
    e.preventDefault();
    const numericPrice = Number(itemPrice);
    if (!itemName.trim() || Number.isNaN(numericPrice) || numericPrice < 0) return;

    setBusyAction('menu-save');
    try {
      await onSaveMenuItem({
        id: editingItemId,
        name: itemName.trim(),
        price: numericPrice,
        item_group: itemGroup,
        image_url: itemImageUrl,
        is_available: true,
      });
      resetItemForm();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleItemPhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const publicUrl = await onUploadAsset('items', file);
      setItemImageUrl(publicUrl);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const publicUrl = await onUploadAsset('logos', file);
      setLogoUrl(publicUrl);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSettingsSubmit(e: FormEvent) {
    e.preventDefault();
    setBusyAction('store-save');
    try {
      await onUpdateStoreDetails({
        name: storeName.trim(),
        category: storeCategory,
        delivery_time: deliveryTime.trim() || '30–45 min',
        logo_url: logoUrl.trim(),
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div>
      <h2>
        Store Console: <span className="gold-text">{store.name}</span>
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>
        Accept incoming orders, mark portions ready for driver pickup, and manage your menu.
      </p>

      {!store.is_approved && (
        <div className="menu-lock-note" style={{ marginBottom: 18 }}>
          Your store is awaiting admin approval before appearing in the public HazyEats marketplace.
        </div>
      )}

      <div className="switch-row">
        <div>
          <strong>Store Availability</strong>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {store.is_open ? 'Open for customer orders' : 'Closed — customers cannot checkout items from your store'}
          </div>
        </div>
        <button
          type="button"
          className={store.is_open ? 'btn-gold' : 'btn-outline'}
          onClick={() => onToggleStoreOpen(!store.is_open)}
        >
          {store.is_open ? 'Store Open' : 'Store Closed'}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Today&apos;s Orders</div>
          <div className="stat-val">{todayOrders.length}</div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Today&apos;s Revenue</div>
          <div className="stat-val gold-text">{formatZar(todayRevenue)}</div>
        </div>
        <div className="stat-card">
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Menu Items</div>
          <div className="stat-val">{store.menu.filter((m) => m.is_available).length}</div>
        </div>
      </div>

      <div className="dash-tabs">
        <button
          type="button"
          className={`chip ${tab === 'orders' ? 'active' : ''}`}
          onClick={() => setTab('orders')}
        >
          Incoming Orders ({orders.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === 'menu' ? 'active' : ''}`}
          onClick={() => setTab('menu')}
        >
          Menu Manager ({store.menu.length})
        </button>
        <button
          type="button"
          className={`chip ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Store Details &amp; Logo
        </button>
      </div>

      {tab === 'orders' && (
        <div>
          {orders.length === 0 ? (
            <div className="empty-state">No incoming orders for {store.name} yet.</div>
          ) : (
            orders.map((part) => (
              <div key={part.part_id} className="order-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>{part.order_code}</strong> • Customer: {part.buyer_first_name} •{' '}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      {formatSaDateTime(part.created_at)}
                    </span>
                    <div style={{ marginTop: 6, fontSize: '0.9rem' }}>
                      Prepare:{' '}
                      <strong>
                        {part.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                      </strong>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Portion Total:{' '}
                      <span className="gold-text">{formatZar(part.store_subtotal)}</span>
                      {part.reason ? ` • Reason: ${part.reason}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {part.order_status === 'cancelled' ? (
                      <span className="badge badge-cancelled">Order Cancelled</span>
                    ) : part.part_status === 'ready' ? (
                      <span className="badge badge-ready">Marked Ready</span>
                    ) : part.part_status === 'rejected' ? (
                      <span className="badge badge-cancelled">Declined</span>
                    ) : (
                      <>
                        <span className="badge badge-pending">
                          {formatStorePartStatus(part.part_status)}
                        </span>
                        {part.part_status === 'pending' && (
                          <button
                            type="button"
                            className="btn-gold"
                            disabled={busyAction === part.part_id}
                            onClick={async () => {
                              setBusyAction(part.part_id);
                              try {
                                await onRespondOrderPart(part.part_id, 'accept');
                              } finally {
                                setBusyAction(null);
                              }
                            }}
                          >
                            Accept Order
                          </button>
                        )}
                        {part.part_status === 'accepted' && (
                          <button
                            type="button"
                            className="btn-gold"
                            disabled={busyAction === part.part_id}
                            onClick={async () => {
                              setBusyAction(part.part_id);
                              try {
                                await onRespondOrderPart(part.part_id, 'ready');
                              } finally {
                                setBusyAction(null);
                              }
                            }}
                          >
                            Mark Ready for Pickup
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-danger-outline"
                          onClick={() => {
                            setRejectingPartId(part.part_id);
                            setRejectReason('');
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {rejectingPartId === part.part_id && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="form-group">
                      <label htmlFor={`reject-${part.part_id}`}>Reason for declining</label>
                      <input
                        id={`reject-${part.part_id}`}
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. Out of chicken wings right now"
                      />
                    </div>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="btn-danger-outline"
                        disabled={busyAction === part.part_id || rejectReason.trim().length < 3}
                        onClick={async () => {
                          setBusyAction(part.part_id);
                          try {
                            await onRespondOrderPart(part.part_id, 'reject', rejectReason);
                            setRejectingPartId(null);
                            setRejectReason('');
                          } finally {
                            setBusyAction(null);
                          }
                        }}
                      >
                        Confirm Reject
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => setRejectingPartId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'menu' && (
        <div>
          <div className="order-card" style={{ maxWidth: 560 }}>
            <h3 style={{ marginBottom: 12 }}>
              {editingItemId ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h3>
            <form onSubmit={handleMenuSubmit}>
              <div className="form-group">
                <label htmlFor="mi-name">Item Name</label>
                <input
                  id="mi-name"
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Streetwise 2 with Chips"
                />
              </div>
              <div className="form-group">
                <label htmlFor="mi-price">Price (ZAR)</label>
                <input
                  id="mi-price"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  placeholder="46.90"
                />
              </div>
              <div className="form-group">
                <label htmlFor="mi-group">Menu Group</label>
                <select
                  id="mi-group"
                  value={itemGroup}
                  onChange={(e) => setItemGroup(e.target.value as MenuItemGroup)}
                >
                  <option value="main">Main Meal</option>
                  <option value="side">Side Dish</option>
                  <option value="extra">Extra / Add-on</option>
                  <option value="drink">Drink / Bundle</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="mi-photo">Item Photo (Upload to Storage)</label>
                <input
                  id="mi-photo"
                  type="file"
                  accept="image/*"
                  onChange={handleItemPhotoUpload}
                />
                {uploadingPhoto && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Uploading photo...
                  </div>
                )}
                {itemImageUrl && (
                  <img
                    src={itemImageUrl}
                    alt="Item preview"
                    className="item-thumb"
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="submit"
                  className="btn-gold"
                  disabled={busyAction === 'menu-save' || uploadingPhoto}
                >
                  {editingItemId ? 'Save Changes' : 'Add Menu Item'}
                </button>
                {editingItemId && (
                  <button type="button" className="btn-outline" onClick={resetItemForm}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="order-card">
            <h3 style={{ marginBottom: 10 }}>Current Menu ({sortedMenu.length})</h3>
            {sortedMenu.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No items added yet.</p>
            ) : (
              sortedMenu.map((item) => (
                <div key={item.id} className="menu-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="item-thumb" />
                    )}
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {item.name}{' '}
                        <span className="badge badge-pending" style={{ marginLeft: 6 }}>
                          {menuGroupLabel(item.item_group)}
                        </span>
                      </div>
                      <div className="gold-text" style={{ fontSize: '0.9rem' }}>
                        {formatZar(item.price)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={item.is_available ? 'btn-outline' : 'btn-danger-outline'}
                      onClick={() => onToggleItemAvailability(item.id, !item.is_available)}
                    >
                      {item.is_available ? 'Available' : 'Sold out'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      onClick={() => startEditItem(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger-outline"
                      onClick={() => onDeleteMenuItem(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="order-card" style={{ maxWidth: 540 }}>
          <h3 style={{ marginBottom: 14 }}>Edit Store Details</h3>
          <form onSubmit={handleSettingsSubmit}>
            <div className="form-group">
              <label htmlFor="sd-name">Store Name</label>
              <input
                id="sd-name"
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="sd-cat">Category</label>
              <select
                id="sd-cat"
                value={storeCategory}
                onChange={(e) => setStoreCategory(e.target.value)}
              >
                <option value="Fast food">Fast food</option>
                <option value="Pizza">Pizza</option>
                <option value="Restaurant">Restaurant</option>
                <option value="Groceries">Groceries</option>
                <option value="Community">Community</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="sd-time">Estimated Prep &amp; Delivery Time</label>
              <input
                id="sd-time"
                type="text"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                placeholder="30–45 min"
              />
            </div>
            <div className="form-group">
              <label htmlFor="sd-logo">Upload Store Logo</label>
              <input id="sd-logo" type="file" accept="image/*" onChange={handleLogoUpload} />
              {logoUrl && (
                <div style={{ marginTop: 10 }}>
                  <img src={logoUrl} alt="Store logo preview" className="store-logo-img" />
                </div>
              )}
            </div>
            <button
              type="submit"
              className="btn-gold"
              disabled={busyAction === 'store-save' || uploadingPhoto}
            >
              {busyAction === 'store-save' ? 'Saving...' : 'Save Store Details'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
