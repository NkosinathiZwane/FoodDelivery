import { useState, type FormEvent } from 'react';
import type { CartItem, CheckoutPaymentInput, PaymentMethod } from '../types.ts';
import { formatZarFromCents } from '../utils/marketplace.ts';
import {
  PAYMENT_METHODS,
  SA_EFT_BANKS,
  calculateCartTotals,
  validateCheckoutInput,
  validatePaymentInput,
} from '../utils/orders.ts';

interface CartModalProps {
  open: boolean;
  cart: CartItem[];
  submitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onUpdateQty: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onSubmitOrder: (address: string, payment: CheckoutPaymentInput) => Promise<void>;
}

export function CartModal({
  open,
  cart,
  submitting,
  serverError,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onSubmitOrder,
}: CartModalProps) {
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [eftBank, setEftBank] = useState<string>(SA_EFT_BANKS[0]);
  const [snapCode, setSnapCode] = useState('HAZY-QR-8421');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!open) return null;

  const totals = calculateCartTotals(cart);
  const errorToShow = validationError || serverError;

  const fillTestCard = () => {
    setCardHolder('Thabo Shabalala');
    setCardNumber('4242 4242 4242 4242');
    setCardExpiry('08/29');
    setCardCvv('424');
    setValidationError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const check = validateCheckoutInput(
      cart.map((c) => ({ itemId: c.itemId, qty: c.qty })),
      address
    );
    if (!check.valid) {
      setValidationError(check.error);
      return;
    }

    const paymentInput: CheckoutPaymentInput = {
      method: paymentMethod,
      cardHolder,
      cardNumber,
      cardExpiry,
      cardCvv,
      eftBank,
      snapCode,
    };
    const paymentCheck = validatePaymentInput(paymentInput);
    if (!paymentCheck.valid) {
      setValidationError(paymentCheck.error);
      return;
    }

    await onSubmitOrder(check.address, paymentInput);
  };

  const submitLabel = submitting
    ? 'Processing Payment & Sending Order...'
    : paymentMethod === 'cash'
    ? `Confirm Cash Order (${formatZarFromCents(totals.totalCents)})`
    : `Pay ${formatZarFromCents(totals.totalCents)} & Place Order`;

  return (
    <div
      id="cart-modal"
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 id="cart-modal-title">
            Your <span className="gold-text">HazyEats</span> Black Bag
          </h2>
          <button
            type="button"
            className="close-btn"
            aria-label="Close black bag"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div id="cart-items-container">
          {cart.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Your black bag is empty.</p>
          ) : (
            cart.map((item) => (
              <div key={item.itemId} className="menu-item">
                <div>
                  <div style={{ fontSize: '0.75rem' }} className="gold-text">
                    {item.storeName}
                  </div>
                  <div style={{ fontWeight: 700 }}>
                    {item.itemName} (x{item.qty})
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {formatZarFromCents(item.priceCents * item.qty)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '4px 9px' }}
                    aria-label={`Decrease quantity of ${item.itemName}`}
                    onClick={() => onUpdateQty(item.itemId, -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '4px 9px' }}
                    aria-label={`Increase quantity of ${item.itemName}`}
                    onClick={() => onUpdateQty(item.itemId, 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '4px 10px' }}
                    aria-label={`Remove ${item.itemName}`}
                    onClick={() => onRemoveItem(item.itemId)}
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
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
              color: 'var(--text-muted)',
            }}
          >
            <span>Multi-Store Flat Delivery (Shabalala)</span>
            <span>{formatZarFromCents(totals.deliveryFeeCents)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '1.15rem',
              fontWeight: 800,
              marginBottom: '14px',
            }}
          >
            <span>Total</span>
            <span className="gold-text" id="cart-grand-total">
              {formatZarFromCents(totals.totalCents)}
            </span>
          </div>

          {errorToShow && <div className="form-error">{errorToShow}</div>}

          <div className="form-group">
            <label htmlFor="delivery-address">
              Delivery Address in Shabalala / Hazyview
            </label>
            <input
              type="text"
              id="delivery-address"
              placeholder="e.g. House 412, Shabalala Trust (Near Primary School)"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (validationError) setValidationError(null);
              }}
            />
          </div>

          <div className="form-group">
            <label id="payment-options-label">Payment Method</label>
            <div
              className="payment-methods-grid"
              role="radiogroup"
              aria-labelledby="payment-options-label"
            >
              {PAYMENT_METHODS.map((option) => {
                const selected = paymentMethod === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`payment-option-btn ${selected ? 'active' : ''}`}
                    onClick={() => {
                      setPaymentMethod(option.id);
                      setValidationError(null);
                    }}
                  >
                    <span className="payment-option-title">{option.label}</span>
                    <span className="payment-option-sub">{option.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {paymentMethod === 'card' && (
            <div className="payment-details-panel">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                }}
              >
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Secure Card Payment
                </span>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={fillTestCard}
                >
                  Use Test Card
                </button>
              </div>
              <div className="form-group">
                <label htmlFor="pay-card-holder">Cardholder Name</label>
                <input
                  type="text"
                  id="pay-card-holder"
                  placeholder="Name on card"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="pay-card-number">Card Number</label>
                <input
                  type="text"
                  id="pay-card-number"
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="pay-card-expiry">Expiry (MM/YY)</label>
                  <input
                    type="text"
                    id="pay-card-expiry"
                    placeholder="08/29"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="pay-card-cvv">CVV</label>
                  <input
                    type="password"
                    id="pay-card-cvv"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="424"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {paymentMethod === 'eft' && (
            <div className="payment-details-panel">
              <div className="form-group" style={{ marginBottom: '6px' }}>
                <label htmlFor="pay-eft-bank">Select Your South African Bank</label>
                <select
                  id="pay-eft-bank"
                  value={eftBank}
                  onChange={(e) => setEftBank(e.target.value)}
                >
                  {SA_EFT_BANKS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Instant EFT verifies settlement immediately so participating restaurants can start
                preparing your order right away.
              </p>
            </div>
          )}

          {paymentMethod === 'snapscan' && (
            <div className="payment-details-panel">
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label htmlFor="pay-snap-code">SnapScan / Zapper Payment Reference</label>
                <input
                  type="text"
                  id="pay-snap-code"
                  value={snapCode}
                  onChange={(e) => setSnapCode(e.target.value)}
                />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Scan &amp; confirm {formatZarFromCents(totals.totalCents)} to dispatch paid order
                tickets to each restaurant immediately.
              </p>
            </div>
          )}

          {paymentMethod === 'cash' && (
            <div className="payment-details-panel">
              <p style={{ fontSize: '0.82rem', color: '#fcf6ba', margin: 0 }}>
                Have {formatZarFromCents(totals.totalCents)} cash ready for your driver upon
                delivery in Shabalala / Hazyview.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn-gold"
            style={{ width: '100%', marginTop: '6px' }}
            disabled={submitting || cart.length === 0}
          >
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
