import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeMigrationHistory, getPendingMigrationNames } from './migrationSafety.js';

test('allows an empty database to initialize migration history', () => {
  assert.doesNotThrow(() => assertSafeMigrationHistory([], []));
  assert.deepEqual(getPendingMigrationNames(['002_second.sql', '001_first.sql'], []), [
    '001_first.sql',
    '002_second.sql',
  ]);
});

test('refuses to migrate existing tables without migration history', () => {
  assert.throws(
    () => assertSafeMigrationHistory(['users', 'products'], []),
    /non-empty database without schema_migrations history/
  );
});

test('refuses to migrate populated databases with empty migration history', () => {
  assert.throws(
    () => assertSafeMigrationHistory(['schema_migrations', 'users'], []),
    /populated database with an empty schema_migrations table/
  );
});

test('allows tracked history and returns only later migrations', () => {
  assert.doesNotThrow(() =>
    assertSafeMigrationHistory(['schema_migrations', 'users'], ['001_first.sql', '002_second.sql'])
  );
  assert.deepEqual(
    getPendingMigrationNames(
      ['003_third.sql', '001_first.sql', '002_second.sql'],
      ['001_first.sql', '002_second.sql']
    ),
    ['003_third.sql']
  );
});

test('refuses to apply migrations when recorded history has a gap', () => {
  assert.throws(
    () => getPendingMigrationNames(
      ['001_first.sql', '002_second.sql', '003_third.sql'],
      ['001_first.sql', '003_third.sql']
    ),
    /Migration history has gaps/
  );
});

test('refuses migration history entries that are unknown to this release', () => {
  assert.throws(
    () => getPendingMigrationNames(['001_first.sql', '002_second.sql'], ['legacy_migration.sql']),
    /not present in this release/
  );
});
