import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDobMask,
  formatPhoneMask,
  isValidBirthDateMmDdYyyy,
  isValidFormattedPhone,
  validateDriverOnboarding,
} from './driverOnboarding.ts';
import type { DriverOnboardingPayload } from '../types.ts';

const VALID_SIGNATURE = 'data:image/png;base64,' + 'A'.repeat(64);

function makeValidPayload(): DriverOnboardingPayload {
  return {
    firstName: 'Sipho',
    lastName: 'Dlamini',
    email: 'sipho@shabalala.co.za',
    phone: '(072) 555-1234',
    streetAddress: 'House 412, Shabalala Trust',
    streetAddressLine2: 'Near Primary School',
    city: 'Hazyview',
    stateProvince: 'Mpumalanga',
    postalCode: '1242',
    dateOfBirth: '05-14-1996',
    emergencyContactName: 'Thandi Dlamini (Sister)',
    emergencyContactPhone: '(071) 222-3333',
    preferredArea: 'Shabalala & Hazyview CBD',
    vehicleType: 'Motorbike / Scooter',
    driversLicenseType: 'Code A (Motorcycle > 125cc)',
    availability: 'Mon–Sun, 08:00–20:00',
    hasPriorExperience: true,
    documents: [],
    signatureDataUrl: VALID_SIGNATURE,
  };
}

test('formatPhoneMask and isValidFormattedPhone enforce (000) 000-0000 format', () => {
  assert.equal(formatPhoneMask('0725551234'), '(072) 555-1234');
  assert.equal(isValidFormattedPhone('(072) 555-1234'), true);
  assert.equal(isValidFormattedPhone('0725551234'), false);
});

test('formatDobMask and isValidBirthDateMmDdYyyy validate MM-DD-YYYY dates', () => {
  assert.equal(formatDobMask('05141996'), '05-14-1996');
  assert.equal(isValidBirthDateMmDdYyyy('05-14-1996'), true);
  assert.equal(isValidBirthDateMmDdYyyy('13-14-1996'), false);
  assert.equal(isValidBirthDateMmDdYyyy('02-30-1996'), false);
  assert.equal(isValidBirthDateMmDdYyyy('05-14-2020'), false);
});

test('validateDriverOnboarding requires all fields including driversLicenseType and signature', () => {
  assert.deepEqual(validateDriverOnboarding(makeValidPayload()), { valid: true });

  const missing = makeValidPayload();
  missing.phone = '072';
  missing.driversLicenseType = '';
  missing.signatureDataUrl = '';
  missing.streetAddress = '';

  const res = validateDriverOnboarding(missing);
  assert.equal(res.valid, false);
  if (!res.valid) {
    assert.match(res.errors.phone, /\(000\) 000-0000/);
    assert.equal(res.errors.streetAddress, 'This field is required.');
    assert.equal(res.errors.driversLicenseType, 'This field is required.');
    assert.ok(res.errors.signature);
  }
});
