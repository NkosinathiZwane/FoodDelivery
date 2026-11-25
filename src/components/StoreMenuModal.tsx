import type { CartItem, StoreDTO } from '../types.ts';
import { formatZarFromCents } from '../utils/marketplace.ts';

interface StoreMenuModalProps {
  store: StoreDTO | null;
  cart: CartItem[];
  onClose: () => void;
  onAddItem: (store: StoreDTO, item: StoreDTO['menu'][number]) => void;
}

export function StoreMenuModal({
  store,
  cart,
  onClose,
  onAddItem,
}: StoreMenuModalProps) {
  if (!store) return null;

  return (
    <div
      id="menu-modal"
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 id="menu-modal-title">
            {store.name} <span className="gold-text">Menu</span>
          </h2>
          <button
            type="button"
            className="close-btn"
            aria-label="Close store menu"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <p
          id="menu-modal-sub"
          style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '14px' }}
        >
          {store.category} • Combine items from multiple stores in one R20 delivery.
        </p>

        <div id="menu-items-list">
          {store.menu.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No menu items available yet.</p>
          ) : (
            store.menu.map((item) => {
              const inBagQty =
                cart.find((c) => c.itemId === item.id)?.qty ?? 0;
              return (
                <div key={item.id} className="menu-item">
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.name}</div>
                    <div className="gold-text" style={{ fontSize: '0.92rem' }}>
                      {formatZarFromCents(item.priceCents)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-gold"
                    style={{ padding: '7px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    aria-label={`Add ${item.name} to bag`}
                    onClick={() => onAddItem(store, item)}
                  >
                    {inBagQty > 0 ? `+ Add (${inBagQty})` : '+ Add'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
