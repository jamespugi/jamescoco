import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isAdminSignupCodeConfigured,
  matchesAdminSignupCode,
} from './adminSignupInvite.js';

const validCode = 'a'.repeat(32);

test('requires a 32-byte one-time admin signup code', () => {
  assert.equal(isAdminSignupCodeConfigured('a'.repeat(31)), false);
  assert.equal(isAdminSignupCodeConfigured(validCode), true);
  assert.equal(isAdminSignupCodeConfigured('a'.repeat(257)), false);
});

test('admin signup code matching is exact and safely rejects invalid inputs', () => {
  assert.equal(matchesAdminSignupCode(validCode, validCode), true);
  assert.equal(matchesAdminSignupCode(`${validCode} `, validCode), false);
  assert.equal(matchesAdminSignupCode('short', validCode), false);
  assert.equal(matchesAdminSignupCode(validCode, 'short'), false);
  assert.equal(matchesAdminSignupCode(undefined, validCode), false);
});
