import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterStores,
  formatZarFromCents,
  validateEmail,
  validateVendorPayload,
} from './marketplace.ts';
import type { StoreDTO } from '../types.ts';

const SAMPLE_STORES: StoreDTO[] = [
  {
    id: 'kfc',
    name: 'KFC',
    category: 'Fast food',
    time: '30–45 min',
    isCommunity: false,
    logo: '',
    menu: [
      { id: 'k1', storeId: 'kfc', name: 'Streetwise 2 with Chips', priceCents: 4690, price: 46.9, available: true },
    ],
  },
  {
    id: 'zakheles',
    name: "Zakhele's Kota & Chips",
    category: 'Community',
    time: '25–40 min',
    isCommunity: true,
    logo: '',
    menu: [
      { id: 'z1', storeId: 'zakheles', name: 'Classic Kota', priceCents: 2500, price: 25.0, available: true },
    ],
  },
];

test('formatZarFromCents formats integer cents cleanly', () => {
  assert.equal(formatZarFromCents(4690), 'R46.90');
  assert.equal(formatZarFromCents(2000), 'R20.00');
  assert.equal(formatZarFromCents(0), 'R0.00');
});

test('filterStores filters by category and menu item text', () => {
  assert.equal(filterStores(SAMPLE_STORES, '', 'All').length, 2);
  assert.equal(filterStores(SAMPLE_STORES, '', 'Community').length, 1);
  assert.equal(filterStores(SAMPLE_STORES, 'Streetwise', 'All')[0]?.id, 'kfc');
  assert.equal(filterStores(SAMPLE_STORES, 'Kota', 'Fast food').length, 0);
});

test('validateEmail accepts valid emails and rejects invalid ones', () => {
  assert.equal(validateEmail('buyer@hazyeats.demo'), true);
  assert.equal(validateEmail('not-an-email'), false);
});

test('validateVendorPayload validates vendor inputs strictly', () => {
  assert.deepEqual(
    validateVendorPayload({ name: 'A', category: 'Community', dishName: 'Kota', priceZar: 35 }),
    { valid: false, error: 'Vendor name must be at least 2 characters.' }
  );
  assert.deepEqual(
    validateVendorPayload({ name: 'Shabalala Grill', category: 'Community', dishName: 'Kota', priceZar: 0 }),
    { valid: false, error: 'Price must be between R1 and R5000.' }
  );
  assert.deepEqual(
    validateVendorPayload({ name: 'Shabalala Grill', category: 'Community', dishName: 'King Kota', priceZar: 45 }),
    { valid: true }
  );
});

import { INITIAL_STORES_SEED } from '../db/catalog.ts';

test('INITIAL_STORES_SEED provides at least 10 authentic items with unique IDs and drinks/sides for every store', () => {
  assert.equal(INITIAL_STORES_SEED.length >= 16, true);

  const seenStoreIds = new Set<string>();
  const seenMenuIds = new Set<string>();
  const drinkKeywords = /(cola|drink|shake|krusher|cappuccino|latte|tea|juice|water|pepsi|energy|powerade|soda|smoothie|beer|appletiser)/i;

  for (const store of INITIAL_STORES_SEED) {
    assert.equal(seenStoreIds.has(store.id), false, `Duplicate store id: ${store.id}`);
    seenStoreIds.add(store.id);

    assert.equal(
      store.menu.length >= 10,
      true,
      `Expected ${store.name} (${store.id}) to have >= 10 items, got ${store.menu.length}`
    );

    let hasDrink = false;
    for (const item of store.menu) {
      assert.equal(seenMenuIds.has(item.id), false, `Duplicate menu item id: ${item.id}`);
      seenMenuIds.add(item.id);
      assert.equal(Number.isInteger(item.priceCents) && item.priceCents > 0, true);
      if (drinkKeywords.test(item.name)) {
        hasDrink = true;
      }
    }

    assert.equal(hasDrink, true, `Expected ${store.name} to include drinks`);
  }
});

import {
  PROTOTYPE_DRIVER_PROFILES_SEED,
  PROTOTYPE_USERS_SEED,
} from '../db/seedUsers.ts';

test('prototype user and driver seed data provides >=10 saved users, driver vehicle/license details, and store logins', () => {
  assert.equal(PROTOTYPE_USERS_SEED.length >= 10, true);

  const buyers = PROTOTYPE_USERS_SEED.filter((u) => u.role === 'buyer');
  const drivers = PROTOTYPE_USERS_SEED.filter((u) => u.role === 'driver');
  const stores = PROTOTYPE_USERS_SEED.filter((u) => u.role === 'store');

  assert.equal(buyers.length >= 4, true);
  assert.equal(drivers.length >= 4, true);
  assert.equal(stores.length >= 16, true);
  assert.equal(PROTOTYPE_DRIVER_PROFILES_SEED.length >= 4, true);

  for (const d of drivers) {
    assert.equal(d.vehicle.trim().length > 0, true);
    const matchingProfile = PROTOTYPE_DRIVER_PROFILES_SEED.find(
      (p) => p.userEmail === d.email
    );
    assert.ok(matchingProfile, `Expected full saved driver profile for ${d.email}`);
    assert.equal(matchingProfile.driversLicenseType.length > 0, true);
  }
});

import { validateSignInInput, validateSignUpInput } from './marketplace.ts';

test('validateSignInInput validates email and password strictly', () => {
  const invalid = validateSignInInput({ email: 'bad-email', password: '123' });
  assert.equal(invalid.valid, false);
  if (!invalid.valid) {
    assert.ok(invalid.fieldErrors.email);
    assert.ok(invalid.fieldErrors.password);
  }

  const valid = validateSignInInput({ email: 'buyer@hazyeats.demo', password: 'Demo@1234' });
  assert.deepEqual(valid, { valid: true });
});

test('validateSignUpInput validates profile fields, role extras, and password confirmation', () => {
  const missingDriverVehicle = validateSignUpInput({
    name: 'Thabo Nkosi',
    phone: '072 111 2233',
    role: 'driver',
    vehicle: '',
    storeName: '',
    adminCode: '',
    email: 'thabo@example.com',
    password: 'Password1!',
    confirmPassword: 'Mismatch!',
  });
  assert.equal(missingDriverVehicle.valid, false);
  if (!missingDriverVehicle.valid) {
    assert.ok(missingDriverVehicle.fieldErrors.vehicle);
    assert.ok(missingDriverVehicle.fieldErrors.confirmPassword);
  }

  const validStoreSignup = validateSignUpInput({
    name: 'Lindiwe Sibeko',
    phone: '082 555 9010',
    role: 'store',
    vehicle: '',
    storeName: 'KFC',
    adminCode: '',
    email: 'lindiwe@kfc.demo',
    password: 'Password1!',
    confirmPassword: 'Password1!',
  });
  assert.deepEqual(validStoreSignup, { valid: true });
});

