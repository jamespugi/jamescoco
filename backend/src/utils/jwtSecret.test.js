import assert from 'node:assert/strict';
import test from 'node:test';
import { getJwtSecret } from './jwtSecret.js';

test('requires a strong JWT secret in production', () => {
  assert.throws(() => getJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET/);
  assert.throws(
    () => getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'change-this-secret' }),
    /JWT_SECRET/
  );
  assert.throws(
    () => getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }),
    /JWT_SECRET/
  );
});

test('accepts a configured production secret and keeps the local default', () => {
  const productionSecret = 'a-random-production-secret-at-least-32-characters';

  assert.equal(getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: productionSecret }), productionSecret);
  assert.equal(getJwtSecret({ NODE_ENV: 'development' }), 'change-this-secret');
});
