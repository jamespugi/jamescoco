import test from 'node:test';
import assert from 'node:assert/strict';
import { getContactChannel, isValidEmail, normalizeEmail, normalizePhoneNumber } from './contactService.js';
import { generateNumericOtp } from './otpService.js';

test('email contacts are normalized and validated', () => {
  assert.equal(normalizeEmail('  User@Example.com '), 'user@example.com');
  assert.equal(isValidEmail('User@Example.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(getContactChannel('user@example.com'), 'email');
});

test('phone contacts require E.164 and allow common formatting separators', () => {
  assert.equal(normalizePhoneNumber('+63 917-123-4567'), '+639171234567');
  assert.equal(normalizePhoneNumber('09171234567'), '');
  assert.equal(normalizePhoneNumber('+012345678'), '');
  assert.equal(getContactChannel('+639171234567'), 'phone');
});

test('SMS OTPs are six numeric digits', () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    assert.match(generateNumericOtp(), /^\d{6}$/);
  }
});
