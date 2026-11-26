import assert from 'node:assert/strict';
import test from 'node:test';
import { getMysqlConnectionErrorMessage } from './mysqlConnectionErrors.js';

const config = {
  host: 'MYSQL',
  port: 3306,
  database: 'cocolyntiks',
};

test('explains unresolved MySQL hostnames without inventing a replacement host', () => {
  const message = getMysqlConnectionErrorMessage({ code: 'EAI_AGAIN' }, config);

  assert.match(message, /Cannot resolve MySQL hostname "MYSQL"/);
  assert.match(message, /exact internal hostname provided by Dokploy/);
  assert.match(message, /share a Docker network/);
});

test('explains MySQL network connection failures', () => {
  const message = getMysqlConnectionErrorMessage({ code: 'ECONNREFUSED' }, config);

  assert.match(message, /MYSQL:3306/);
  assert.match(message, /DB_HOST, DB_PORT/);
});

test('explains credential and database errors without exposing error details', () => {
  const credentialError = getMysqlConnectionErrorMessage(
    { code: 'ER_ACCESS_DENIED_ERROR', message: 'password=do-not-log' },
    config
  );
  const databaseError = getMysqlConnectionErrorMessage({ code: 'ER_BAD_DB_ERROR' }, config);

  assert.match(credentialError, /DB_USER, DB_PASSWORD/);
  assert.doesNotMatch(credentialError, /do-not-log/);
  assert.match(databaseError, /cocolyntiks/);
  assert.match(databaseError, /DB_NAME/);
});
