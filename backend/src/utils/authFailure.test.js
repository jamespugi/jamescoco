import assert from 'node:assert/strict';
import test from 'node:test';
import { respondToAuthFailure } from './authFailure.js';

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('reports database connection failures as service unavailable', () => {
  const response = createResponse();

  respondToAuthFailure(response, { code: 'ECONNREFUSED' }, 'Login', 'Could not log in.');

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'DATABASE_UNAVAILABLE');
});

test('keeps non-connection failures on their operation fallback', () => {
  const response = createResponse();

  respondToAuthFailure(response, { code: 'ER_BAD_FIELD_ERROR' }, 'Login', 'Could not log in.');

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: 'Could not log in.' });
});
