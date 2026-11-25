import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './auth.ts';

test('hashPassword and verifyPassword validate matching and non-matching passwords', () => {
  const hash = hashPassword('Demo@1234');
  assert.ok(hash.includes(':'));
  assert.equal(verifyPassword('Demo@1234', hash), true);
  assert.equal(verifyPassword('WrongPass', hash), false);
  assert.equal(verifyPassword('Demo@1234', null), false);
});

test('signSessionToken and verifySessionToken roundtrip and reject tampering', () => {
  const token = signSessionToken({
    uid: 'local:123',
    email: 'buyer@hazyeats.demo',
    role: 'buyer',
  });
  const decoded = verifySessionToken(token);
  assert.ok(decoded);
  assert.equal(decoded.email, 'buyer@hazyeats.demo');
  assert.equal(decoded.role, 'buyer');

  const tampered = token.slice(0, -4) + 'aaaa';
  assert.equal(verifySessionToken(tampered), null);

  const expired = signSessionToken(
    { uid: 'local:123', email: 'buyer@hazyeats.demo', role: 'buyer' },
    -10
  );
  assert.equal(verifySessionToken(expired), null);
});
