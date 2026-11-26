import assert from 'node:assert/strict';
import test from 'node:test';
import { createMysqlConfig } from './databaseConfig.js';

test('reads Railway MySQL service variables', () => {
  const config = createMysqlConfig({
    NODE_ENV: 'production',
    MYSQLHOST: 'mysql.railway.internal',
    MYSQLPORT: '3306',
    MYSQLUSER: 'app_user',
    MYSQLPASSWORD: 'secret',
    MYSQLDATABASE: 'railway',
  });

  assert.equal(config.database, 'railway');
  assert.equal(config.poolConfig.host, 'mysql.railway.internal');
  assert.equal(config.poolConfig.port, 3306);
  assert.equal(config.poolConfig.user, 'app_user');
  assert.equal(config.poolConfig.password, 'secret');
});

test('reads underscore-separated MySQL container variables', () => {
  const config = createMysqlConfig({
    NODE_ENV: 'production',
    MYSQL_HOST: 'mysql',
    MYSQL_PORT: '3307',
    MYSQL_USER: 'app_user',
    MYSQL_PASSWORD: 'secret',
    MYSQL_DATABASE: 'cocolytics',
  });

  assert.equal(config.database, 'cocolytics');
  assert.equal(config.poolConfig.host, 'mysql');
  assert.equal(config.poolConfig.port, 3307);
  assert.equal(config.poolConfig.user, 'app_user');
  assert.equal(config.poolConfig.password, 'secret');
});

test('parses a MySQL URL and decodes its credentials', () => {
  const config = createMysqlConfig({
    NODE_ENV: 'production',
    MYSQL_URL: 'mysql://app%40user:p%40ss%3Aword@db.example.com:3307/cocolytics',
    DB_HOST: '',
    DB_PORT: '',
    DB_USER: '',
    DB_PASSWORD: '',
    DB_NAME: '',
  });

  assert.equal(config.database, 'cocolytics');
  assert.equal(config.poolConfig.user, 'app@user');
  assert.equal(config.poolConfig.password, 'p@ss:word');
  assert.equal(config.poolConfig.port, 3307);
});

test('requires explicit credentials in production', () => {
  assert.throws(
    () => createMysqlConfig({ NODE_ENV: 'production' }),
    /Missing production database configuration/
  );
});

test('keeps localhost defaults for development', () => {
  const config = createMysqlConfig({ NODE_ENV: 'development' });

  assert.equal(config.poolConfig.host, 'localhost');
  assert.equal(config.poolConfig.user, 'root');
  assert.equal(config.database, 'new_cocolytics');
});
