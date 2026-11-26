import assert from 'node:assert/strict';
import test from 'node:test';
import type { CartItem, MenuItem } from '../types.ts';
import {
  calculateCartTotals,
  canAddMenuItemToCart,
  formatZar,
  getTimelineSteps,
  removeCartItemCleanly,
  sortMenuItems,
  toWhatsAppUrl,
  validateAuthForm,
  validateCheckoutForm,
} from './format.ts';

test('formatZar formats South African Rand accurately', () => {
  assert.equal(formatZar(0), 'R0.00');
  assert.equal(formatZar(46.9), 'R46.90');
  assert.equal(formatZar('189.9'), 'R189.90');
});

test('toWhatsAppUrl normalizes ZA 0xx numbers to 27xx', () => {
  assert.equal(toWhatsAppUrl('072 987 6543'), 'https://wa.me/27729876543');
  assert.equal(toWhatsAppUrl('+27 71 234 5678'), 'https://wa.me/27712345678');
});

test('sortMenuItems groups mains before sides/extras/drinks and orders sizes logically', () => {
  const items: MenuItem[] = [
    { id: '1', store_id: 's1', name: '330ml Soft Drink Can', price: 15, item_group: 'drink', image_url: '', is_available: true, sort_order: 1 },
    { id: '2', store_id: 's1', name: 'Large Slap Chips', price: 45, item_group: 'side', image_url: '', is_available: true, sort_order: 1 },
    { id: '3', store_id: 's1', name: 'Small Slap Chips', price: 25, item_group: 'side', image_url: '', is_available: true, sort_order: 1 },
    { id: '4', store_id: 's1', name: 'Large Crammed-Crust Triple-Decker', price: 189.9, item_group: 'main', image_url: '', is_available: true, sort_order: 1 },
    { id: '5', store_id: 's1', name: 'Medium Chicken & Mushroom', price: 99.9, item_group: 'main', image_url: '', is_available: true, sort_order: 1 },
  ];
  const sorted = sortMenuItems(items);
  assert.deepEqual(
    sorted.map((i) => i.name),
    [
      'Medium Chicken & Mushroom',
      'Large Crammed-Crust Triple-Decker',
      'Small Slap Chips',
      'Large Slap Chips',
      '330ml Soft Drink Can',
    ]
  );
});

test('canAddMenuItemToCart enforces main-before-addon per store and blocks closed/sold-out items', () => {
  const emptyCart: CartItem[] = [];
  assert.equal(
    canAddMenuItemToCart(emptyCart, 'kfc', { item_group: 'drink', is_available: true }, true).allowed,
    false
  );
  assert.equal(
    canAddMenuItemToCart(emptyCart, 'kfc', { item_group: 'main', is_available: false }, true).allowed,
    false
  );
  assert.equal(
    canAddMenuItemToCart(emptyCart, 'kfc', { item_group: 'main', is_available: true }, false).allowed,
    false
  );

  const cartWithKfcMain: CartItem[] = [
    {
      storeId: 'kfc',
      storeName: 'KFC',
      menuItemId: 'k1',
      itemName: 'Streetwise 2 with Chips',
      price: 46.9,
      itemGroup: 'main',
      qty: 1,
    },
  ];
  assert.equal(
    canAddMenuItemToCart(cartWithKfcMain, 'kfc', { item_group: 'drink', is_available: true }, true).allowed,
    true
  );
  // Another store still needs its own main
  assert.equal(
    canAddMenuItemToCart(cartWithKfcMain, 'zakheles', { item_group: 'side', is_available: true }, true).allowed,
    false
  );
});

test('removeCartItemCleanly clears dependent sides/drinks when removing the last main for that store', () => {
  const cart: CartItem[] = [
    { storeId: 'zakheles', storeName: "Zakhele's Kota & Chips", menuItemId: 'z1', itemName: 'Classic Kota', price: 25, itemGroup: 'main', qty: 1 },
    { storeId: 'zakheles', storeName: "Zakhele's Kota & Chips", menuItemId: 'z7', itemName: '330ml Soft Drink Can', price: 15, itemGroup: 'drink', qty: 1 },
    { storeId: 'kfc', storeName: 'KFC', menuItemId: 'k1', itemName: 'Streetwise 2', price: 46.9, itemGroup: 'main', qty: 1 },
  ];
  const next = removeCartItemCleanly(cart, 'z1');
  assert.deepEqual(next.map((c) => c.menuItemId), ['k1']);
});

test('calculateCartTotals applies flat R20 fee regardless of store count', () => {
  const totals = calculateCartTotals([
    { storeId: 'kfc', storeName: 'KFC', menuItemId: 'k1', itemName: 'Streetwise 2', price: 46.9, itemGroup: 'main', qty: 1 },
    { storeId: 'zakheles', storeName: "Zakhele's", menuItemId: 'z1', itemName: 'Classic Kota', price: 25, itemGroup: 'main', qty: 2 },
  ]);
  assert.equal(totals.itemCount, 3);
  assert.equal(totals.subtotal, 96.9);
  assert.equal(totals.deliveryFee, 20);
  assert.equal(totals.total, 116.9);
});

test('validateAuthForm enforces 8-character password and excludes admin on public signup', () => {
  assert.ok(validateAuthForm({ mode: 'signin', email: 'a@b.com', password: 'short' }));
  assert.equal(validateAuthForm({ mode: 'signin', email: 'a@b.com', password: 'ValidPassword8' }), null);
  assert.ok(
    validateAuthForm({
      mode: 'signup',
      email: 'a@b.com',
      password: 'ValidPassword8',
      name: 'Test User',
      phone: '0725551234',
      role: 'admin',
    })
  );
  assert.equal(
    validateAuthForm({
      mode: 'signup',
      email: 'a@b.com',
      password: 'ValidPassword8',
      name: 'Test Driver',
      phone: '0725551234',
      role: 'driver',
      vehicle: 'Honda Bike',
    }),
    null
  );
});

test('validateCheckoutForm and getTimelineSteps reflect order rules accurately', () => {
  assert.ok(validateCheckoutForm('123 Main', '0725551234', []));
  assert.ok(
    validateCheckoutForm('Short', '0725551234', [
      { storeId: 'kfc', storeName: 'KFC', menuItemId: 'k1', itemName: 'Streetwise 2', price: 46.9, itemGroup: 'main', qty: 1 },
    ]) === null
  );
  const steps = getTimelineSteps('ready_for_pickup');
  assert.equal(steps.find((s) => s.key === 'preparing')?.state, 'done');
  assert.equal(steps.find((s) => s.key === 'ready_for_pickup')?.state, 'current');
});
