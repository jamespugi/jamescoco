const MIGRATIONS_TABLE = 'schema_migrations';

export function assertSafeMigrationHistory(tableNames, appliedMigrationNames) {
  const applicationTables = tableNames.filter((name) => name !== MIGRATIONS_TABLE);

  if (!tableNames.includes(MIGRATIONS_TABLE) && applicationTables.length > 0) {
    throw new Error(
      'Refusing to migrate a non-empty database without schema_migrations history. Restore the migration history from the backup or review the database before migrating.'
    );
  }

  if (tableNames.includes(MIGRATIONS_TABLE) && applicationTables.length > 0 && appliedMigrationNames.length === 0) {
    throw new Error(
      'Refusing to migrate a populated database with an empty schema_migrations table. Review or restore the migration history before migrating.'
    );
  }
}

export function getPendingMigrationNames(migrationFiles, appliedMigrationNames) {
  const files = [...migrationFiles].sort();
  const applied = new Set(appliedMigrationNames);
  const unknownMigrations = [...applied].filter((file) => !files.includes(file));

  if (unknownMigrations.length > 0) {
    throw new Error(
      `Migration history contains entries that are not present in this release: ${unknownMigrations.join(', ')}.`
    );
  }

  const latestAppliedIndex = files.reduce(
    (latestIndex, file, index) => (applied.has(file) ? index : latestIndex),
    -1
  );
  const missingEarlierMigrations = files
    .slice(0, latestAppliedIndex + 1)
    .filter((file) => !applied.has(file));

  if (missingEarlierMigrations.length > 0) {
    throw new Error(
      `Migration history has gaps before its latest applied migration: ${missingEarlierMigrations.join(', ')}.`
    );
  }

  return files.filter((file) => !applied.has(file));
}
