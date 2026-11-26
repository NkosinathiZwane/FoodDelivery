import type { CartItem, MenuItem, MenuItemGroup, Store } from '../types';
import {
  canAddMenuItemToCart,
  formatZar,
  menuGroupLabel,
  sortMenuItems,
  storeHasMainInCart,
} from '../utils/format';

interface StoreMenuModalProps {
  store: Store | null;
  cart: CartItem[];
  onClose: () => void;
  onAddItem: (store: Store, item: MenuItem) => void;
}

const GROUP_ORDER: MenuItemGroup[] = ['main', 'side', 'extra', 'drink'];

export function StoreMenuModal({ store, cart, onClose, onAddItem }: StoreMenuModalProps) {
  if (!store) return null;

  const sortedItems = sortMenuItems(store.menu);
  const hasMain = storeHasMainInCart(cart, store.id);
  const hasAddonItems = sortedItems.some((item) => item.item_group !== 'main');

  return (
    <div
      id="menu-modal"
      className="modal-backdrop open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 id="menu-modal-title">
            {store.name} <span className="gold-text">Menu</span>
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close menu">
            &times;
          </button>
        </div>

        <p id="menu-modal-sub" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 14 }}>
          {store.category} • Combine items from multiple stores in one R20 delivery.
          {!store.is_open ? ' (Currently closed for new orders)' : ''}
        </p>

        {hasAddonItems && !hasMain && store.is_open && (
          <div className="menu-lock-note">
            Add a main meal from {store.name} first before adding sides, extras, or drinks.
          </div>
        )}

        <div id="menu-items-list">
          {sortedItems.length === 0 ? (
            <div className="empty-state">No menu items published for this store yet.</div>
          ) : (
            GROUP_ORDER.map((groupKey) => {
              const groupItems = sortedItems.filter((item) => item.item_group === groupKey);
              if (groupItems.length === 0) return null;

              return (
                <div key={groupKey}>
                  <div className="menu-section-title">{menuGroupLabel(groupKey)}</div>
                  {groupItems.map((item) => {
                    const eligibility = canAddMenuItemToCart(cart, store.id, item, store.is_open);
                    const inCartQty =
                      cart.find((c) => c.menuItemId === item.id)?.qty ?? 0;

                    return (
                      <div key={item.id} className="menu-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {item.image_url && (
                            <img src={item.image_url} alt={item.name} className="item-thumb" />
                          )}
                          <div>
                            <div style={{ fontWeight: 700 }}>
                              {item.name}{' '}
                              {!item.is_available && (
                                <span className="badge badge-cancelled" style={{ marginLeft: 6 }}>
                                  Sold out
                                </span>
                              )}
                            </div>
                            <div className="gold-text" style={{ fontSize: '0.92rem' }}>
                              {formatZar(item.price)}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-gold"
                          style={{ padding: '7px 14px', fontSize: '0.85rem', flexShrink: 0 }}
                          disabled={!eligibility.allowed}
                          title={eligibility.reason || 'Add to black bag'}
                          onClick={() => onAddItem(store, item)}
                        >
                          {!store.is_open
                            ? 'Closed'
                            : !item.is_available
                              ? 'Sold out'
                              : item.item_group !== 'main' && !hasMain
                                ? 'Needs Main'
                                : inCartQty > 0
                                  ? `+ Add (${inCartQty})`
                                  : '+ Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
