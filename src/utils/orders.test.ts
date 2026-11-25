import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_STATUS,
  areAllStoresReady,
  calculateCartTotals,
  canDriverAcceptOrder,
  canUserMessageOrder,
  computeStatusAfterStoreReady,
  getOrderTrackingState,
  mergeOrderMessagesIdempotent,
  resolveOrderStepIndex,
  validateCheckoutInput,
  validateOrderMessage,
  validatePaymentInput,
} from './orders.ts';

test('calculateCartTotals computes multi-store totals with single R20 delivery fee', () => {
  const empty = calculateCartTotals([]);
  assert.equal(empty.totalCents, 0);
  assert.equal(empty.deliveryFeeCents, 0);

  const filled = calculateCartTotals([
    { priceCents: 4690, qty: 1 },
    { priceCents: 2500, qty: 2 },
  ]);
  assert.equal(filled.itemCount, 3);
  assert.equal(filled.subtotalCents, 9690);
  assert.equal(filled.deliveryFeeCents, 2000);
  assert.equal(filled.totalCents, 11690);
});

test('multi-store readiness unlocks driver pickup only when every store is ready', () => {
  const partial = { KFC: true, "Zakhele's Kota & Chips": false };
  assert.equal(areAllStoresReady(partial), false);
  assert.equal(
    computeStatusAfterStoreReady(partial, ORDER_STATUS.PREPARING),
    ORDER_STATUS.PREPARING
  );
  assert.equal(canDriverAcceptOrder(partial, ORDER_STATUS.PREPARING, null), false);

  const complete = { KFC: true, "Zakhele's Kota & Chips": true };
  assert.equal(areAllStoresReady(complete), true);
  assert.equal(
    computeStatusAfterStoreReady(complete, ORDER_STATUS.PREPARING),
    ORDER_STATUS.READY_FOR_PICKUP
  );
  assert.equal(
    canDriverAcceptOrder(complete, ORDER_STATUS.READY_FOR_PICKUP, null),
    true
  );
  assert.equal(
    canDriverAcceptOrder(complete, ORDER_STATUS.READY_FOR_PICKUP, 'Sipho Driver'),
    false
  );
});

test('validateCheckoutInput rejects empty bags or missing delivery address', () => {
  assert.equal(validateCheckoutInput([], 'House 412 Shabalala').valid, false);
  assert.equal(validateCheckoutInput([{ itemId: 'k1', qty: 1 }], 'abc').valid, false);
  assert.deepEqual(
    validateCheckoutInput([{ itemId: 'k1', qty: 2 }], '  House 412, Shabalala Trust  '),
    { valid: true, address: 'House 412, Shabalala Trust' }
  );
});

test('getOrderTrackingState maps order lifecycle to 4 visual progress stages', () => {
  const preparing = getOrderTrackingState({
    status: ORDER_STATUS.PREPARING,
    stores: ['KFC', 'Chicken Licken'],
    storeReadiness: { KFC: true, 'Chicken Licken': false },
    driverName: null,
  });
  assert.equal(preparing.activeStepIndex, 0);
  assert.equal(preparing.progressPercent, 0);
  assert.equal(preparing.isDelivered, false);
  assert.equal(preparing.readyStoreCount, 1);
  assert.equal(preparing.totalStoreCount, 2);
  assert.deepEqual(
    preparing.steps.map((s) => s.status),
    ['active', 'upcoming', 'upcoming', 'upcoming']
  );

  const ready = getOrderTrackingState({
    status: ORDER_STATUS.READY_FOR_PICKUP,
    stores: ['KFC', 'Chicken Licken'],
    storeReadiness: { KFC: true, 'Chicken Licken': true },
    driverName: null,
  });
  assert.equal(ready.activeStepIndex, 1);
  assert.equal(ready.progressPercent, 33);
  assert.deepEqual(
    ready.steps.map((s) => s.status),
    ['completed', 'active', 'upcoming', 'upcoming']
  );

  const outForDelivery = getOrderTrackingState({
    status: ORDER_STATUS.OUT_FOR_DELIVERY,
    stores: ['KFC', 'Chicken Licken'],
    storeReadiness: { KFC: true, 'Chicken Licken': true },
    driverName: 'Sipho Driver',
  });
  assert.equal(outForDelivery.activeStepIndex, 2);
  assert.equal(outForDelivery.progressPercent, 67);
  assert.deepEqual(
    outForDelivery.steps.map((s) => s.status),
    ['completed', 'completed', 'active', 'upcoming']
  );

  const delivered = getOrderTrackingState({
    status: ORDER_STATUS.DELIVERED,
    stores: ['KFC', 'Chicken Licken'],
    storeReadiness: { KFC: true, 'Chicken Licken': true },
    driverName: 'Sipho Driver',
  });
  assert.equal(delivered.activeStepIndex, 3);
  assert.equal(delivered.progressPercent, 100);
  assert.equal(delivered.isDelivered, true);
  assert.deepEqual(
    delivered.steps.map((s) => s.status),
    ['completed', 'completed', 'completed', 'completed']
  );

  assert.equal(resolveOrderStepIndex('Unknown Status', {}, null), 0);
});

test('validateOrderMessage, canUserMessageOrder, and mergeOrderMessagesIdempotent enforce messaging rules', () => {
  assert.equal(validateOrderMessage('   ').valid, false);
  assert.equal(validateOrderMessage('a'.repeat(501)).valid, false);
  assert.deepEqual(validateOrderMessage('  At the blue gate  '), {
    valid: true,
    body: 'At the blue gate',
  });

  assert.deepEqual(canUserMessageOrder({ buyerId: 10, driverId: null }, 10), {
    allowed: false,
    reason: 'driver_unassigned',
  });
  assert.deepEqual(canUserMessageOrder({ buyerId: 10, driverId: 22 }, 99), {
    allowed: false,
    reason: 'forbidden',
  });
  assert.deepEqual(canUserMessageOrder({ buyerId: 10, driverId: 22 }, 10), {
    allowed: true,
    senderRole: 'buyer',
  });
  assert.deepEqual(canUserMessageOrder({ buyerId: 10, driverId: 22 }, 22), {
    allowed: true,
    senderRole: 'driver',
  });

  const msg1 = {
    id: 1,
    orderId: 'ORD-1',
    senderId: 10,
    senderName: 'Thabo',
    senderRole: 'buyer' as const,
    body: 'Hello',
    createdAt: '10:00',
    createdAtIso: '2026-11-25T10:00:00.000Z',
  };
  const merged = mergeOrderMessagesIdempotent([msg1], msg1);
  assert.equal(merged.length, 1);
  const merged2 = mergeOrderMessagesIdempotent(merged, { ...msg1, id: 2, body: 'On my way!' });
  assert.equal(merged2.length, 2);
});

test('validatePaymentInput validates card, Instant EFT, SnapScan, and Cash on Delivery options', () => {
  assert.equal(
    validatePaymentInput({
      method: 'card',
      cardHolder: 'T',
      cardNumber: '123',
      cardExpiry: '99/99',
      cardCvv: '1',
    }).valid,
    false
  );

  const validCard = validatePaymentInput({
    method: 'card',
    cardHolder: 'Thabo Shabalala',
    cardNumber: '4242 4242 4242 4242',
    cardExpiry: '08/29',
    cardCvv: '424',
  });
  assert.deepEqual(validCard, {
    valid: true,
    method: 'card',
    paymentStatus: 'Paid',
    paymentDetails: 'Visa •••• 4242',
  });

  assert.equal(validatePaymentInput({ method: 'eft', eftBank: '' }).valid, false);
  assert.deepEqual(validatePaymentInput({ method: 'eft', eftBank: 'Capitec Bank' }), {
    valid: true,
    method: 'eft',
    paymentStatus: 'Paid',
    paymentDetails: 'Capitec Bank Instant EFT',
  });

  assert.deepEqual(validatePaymentInput({ method: 'snapscan', snapCode: 'HAZY-88' }), {
    valid: true,
    method: 'snapscan',
    paymentStatus: 'Paid',
    paymentDetails: 'SnapScan / Zapper (HAZY-88)',
  });

  assert.deepEqual(validatePaymentInput({ method: 'cash' }), {
    valid: true,
    method: 'cash',
    paymentStatus: 'Cash on Delivery',
    paymentDetails: 'Cash on Delivery (Doorstep)',
  });
});

test('getOrderTrackingState preserves Received, Preparing, and Ready per-store statuses', () => {
  const state = getOrderTrackingState({
    status: ORDER_STATUS.PREPARING,
    stores: ['KFC', 'Spur'],
    storeReadiness: { KFC: true, Spur: false },
    storePrepStatuses: { KFC: 'Ready', Spur: 'Preparing' },
    driverName: null,
  });

  assert.equal(state.activeStepIndex, 0);
  assert.deepEqual(state.storeBreakdown, [
    { storeName: 'KFC', ready: true, prepStatus: 'Ready' },
    { storeName: 'Spur', ready: false, prepStatus: 'Preparing' },
  ]);
});


