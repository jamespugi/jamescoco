import dotenv from 'dotenv';
import { lookup } from 'node:dns/promises';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { createMysqlConfig } from './databaseConfig.js';
import { assertSafeMigrationHistory, getPendingMigrationNames } from './migrationSafety.js';
import { getMysqlConnectionErrorMessage } from './mysqlConnectionErrors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { baseConfig, database: DB_NAME, poolConfig } = createMysqlConfig();
const MIGRATIONS_TABLE = 'schema_migrations';
const DEMO_DATA_MIGRATIONS = new Set([
  '023_seed_demo_traders.sql',
  '026_seed_demo_monthly_prices.sql',
  '027_refresh_demo_operations_data.sql',
  '028_rename_demo_coconut_product.sql',
  '029_use_cocolumber_for_demo_products.sql',
  '030_seed_empty_trader_inventory.sql',
]);

const migrationsDir = path.resolve(__dirname, '../../database/migrations');

export const pool = mysql.createPool(poolConfig);

export async function verifyDatabaseConnection() {
  let addresses;

  try {
    addresses = await lookup(poolConfig.host, { all: true });
  } catch (error) {
    const message = getMysqlConnectionErrorMessage(error, {
      host: poolConfig.host,
      port: poolConfig.port,
      database: DB_NAME,
    });
    throw new Error(`MySQL DNS diagnostic failed: ${message}`, { cause: error });
  }

  console.info(
    `MySQL DNS resolved ${poolConfig.host} to ${addresses.map(({ address }) => address).join(', ')}.`
  );

  try {
    await pool.query('SELECT 1');
  } catch (error) {
    const message = getMysqlConnectionErrorMessage(error, {
      host: poolConfig.host,
      port: poolConfig.port,
      database: DB_NAME,
    });
    throw new Error(`MySQL connection diagnostic failed: ${message}`, { cause: error });
  }

  console.info(`MySQL connection verified at ${poolConfig.host}:${poolConfig.port}/${DB_NAME}.`);
}

function quoteIdentifier(identifier) {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection(baseConfig);
  await connection.query(`CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(DB_NAME)}`);
  await connection.end();
}

async function ensureMigrationsTable() {
  const [tableRows] = await pool.query(`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.tables
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  `);
  const tableNames = tableRows.map((row) => row.tableName);
  const hasMigrationsTable = tableNames.includes(MIGRATIONS_TABLE);
  const [migrationRows] = hasMigrationsTable
    ? await pool.query(`SELECT name FROM ${MIGRATIONS_TABLE}`)
    : [[]];

  assertSafeMigrationHistory(
    tableNames,
    migrationRows.map((row) => row.name)
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function getPendingMigrations() {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const [rows] = await pool.query(`SELECT name FROM ${MIGRATIONS_TABLE}`);
  return getPendingMigrationNames(files, rows.map((row) => row.name));
}

async function applyMigration(filename) {
  if (DEMO_DATA_MIGRATIONS.has(filename)) {
    await pool.execute(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, [filename]);
    console.log(`Skipped demo-data migration ${filename}.`);
    return;
  }

  const migrationPath = path.join(migrationsDir, filename);
  const sql = await readFile(migrationPath, 'utf8');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query(sql);
    await connection.execute(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, [filename]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw new Error(`Migration ${filename} failed: ${error.message}`);
  } finally {
    connection.release();
  }
}

export async function runMigrations() {
  await verifyDatabaseConnection();
  await ensureMigrationsTable();
  const pendingMigrations = await getPendingMigrations();

  for (const filename of pendingMigrations) {
    await applyMigration(filename);
  }
}

export async function initializeDatabase({ createDatabase = process.env.NODE_ENV !== 'production' } = {}) {
  if (createDatabase) {
    await ensureDatabaseExists();
  }

  await runMigrations();
}

export async function importSqlFile(filePath) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SQL dump imports are disabled in production migrations. Import backups separately into an empty database.');
  }

  let sql;
  try {
    sql = await readFile(filePath, 'utf8');
  } catch (err) {
    throw new Error(`SQL file not found at ${filePath}`);
  }

  if (process.env.NODE_ENV !== 'production') {
    await ensureDatabaseExists();
  }

  const connection = await mysql.createConnection({ ...baseConfig, database: DB_NAME });
  try {
    // if DB already has tables, skip import unless explicitly forced
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ?`,
      [DB_NAME]
    );
    const tableCount = rows && rows[0] ? Number(rows[0].cnt) : 0;
    if (tableCount > 0 && process.env.FORCE_IMPORT !== 'true') {
      return { skipped: true, reason: `Database ${DB_NAME} already contains ${tableCount} table(s).` };
    }

    // Pre-process dump to make imports idempotent: add IF NOT EXISTS and remove USE statements
    let cleanedSql = sql
      .replace(/CREATE\s+DATABASE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE DATABASE IF NOT EXISTS ')
      .replace(/CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+`[^`]+`[^;]*;/gi, '')
      .replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
      .replace(/USE\s+`[^`]+`\s*;/gi, '');

    await connection.query(cleanedSql);
    return { imported: true };
  } catch (error) {
    throw new Error(`Import failed: ${error.message}`);
  } finally {
    try { await connection.end(); } catch (e) {}
  }
}
