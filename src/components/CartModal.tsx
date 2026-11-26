import { useState, type FormEvent } from 'react';
import type { CartItem, Profile } from '../types';
import { calculateCartTotals, formatZar, validateCheckoutForm } from '../utils/format';

interface CartModalProps {
  open: boolean;
  cart: CartItem[];
  profile: Profile | null;
  submitting: boolean;
  onClose: () => void;
  onUpdateQty: (menuItemId: string, delta: number) => void;
  onRemoveItem: (menuItemId: string) => void;
  onCheckout: (address: string, phone: string, notes: string) => Promise<void>;
  onRequireSignIn: () => void;
}

export function CartModal({
  open,
  cart,
  profile,
  submitting,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onCheckout,
  onRequireSignIn,
}: CartModalProps) {
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [notes, setNotes] = useState('');
  const [errorText, setErrorText] = useState('');

  if (!open) return null;

  const { subtotal, deliveryFee, total } = calculateCartTotals(cart);
  const resolvedPhone = phone || profile?.phone || '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorText('');

    if (!profile) {
      onClose();
      onRequireSignIn();
      return;
    }

    const validationError = validateCheckoutForm(address, resolvedPhone, cart);
    if (validationError) {
      setErrorText(validationError);
      return;
    }

    try {
      await onCheckout(address, resolvedPhone, notes);
      setNotes('');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Unable to place your order.');
    }
  }

  return (
    <div
      id="cart-modal"
      className="modal-backdrop open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2>
            Your <span className="gold-text">HazyEats</span> Black Bag
          </h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close bag">
            &times;
          </button>
        </div>

        <div id="cart-items-container">
          {cart.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Your black bag is empty.</p>
          ) : (
            cart.map((item) => (
              <div key={item.menuItemId} className="menu-item">
                <div>
                  <div style={{ fontSize: '0.75rem' }} className="gold-text">
                    {item.storeName}
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {item.itemName} (x{item.qty})
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {formatZar(item.price * item.qty)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '4px 10px' }}
                    onClick={() => onUpdateQty(item.menuItemId, -1)}
                    aria-label={`Decrease ${item.itemName}`}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '4px 10px' }}
                    onClick={() => onUpdateQty(item.menuItemId, 1)}
                    aria-label={`Increase ${item.itemName}`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="btn-danger-outline"
                    style={{ padding: '4px 10px' }}
                    onClick={() => onRemoveItem(item.menuItemId)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 6,
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            <span>Items Subtotal</span>
            <span>{formatZar(subtotal)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            <span>Multi-Store Flat Delivery (Shabalala)</span>
            <span>{formatZar(deliveryFee)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1.15rem',
              fontWeight: 800,
              marginBottom: 14,
            }}
          >
            <span>Total</span>
            <span className="gold-text" id="cart-grand-total">
              {formatZar(total)}
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="delivery-address">Delivery Address in Shabalala / Hazyview</label>
            <input
              id="delivery-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. House 412, Shabalala Trust (Near Primary School)"
            />
          </div>

          <div className="form-group">
            <label htmlFor="delivery-phone">Contact Phone (Call / WhatsApp)</label>
            <input
              id="delivery-phone"
              type="tel"
              value={resolvedPhone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 072 555 1234"
            />
          </div>

          <div className="form-group">
            <label htmlFor="delivery-notes">Delivery Notes (Optional)</label>
            <input
              id="delivery-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Grey gate next to spaza shop"
            />
          </div>

          {errorText && <div className="form-error">{errorText}</div>}

          <button
            type="submit"
            className="btn-gold"
            style={{ width: '100%' }}
            disabled={submitting || cart.length === 0}
          >
            {submitting ? 'Placing Multi-Store Order...' : 'Place Multi-Store Order'}
          </button>
        </form>
      </div>
    </div>
  );
}
