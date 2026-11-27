
import 'dotenv/config';
import mysql from 'mysql2/promise';

const CONFIRM_FLAG = '--confirm';
const confirmEnabled = process.argv.includes(CONFIRM_FLAG);
const allowTruncate = process.env.ALLOW_DATABASE_TRUNCATE === 'true';

const excludedTables = [
  'migrations',
  '_migrations',
  'knex_migrations',
  'SequelizeMeta',
  'prisma_migrations'
];

async function truncateDatabase() {
  let connection;

  try {
    if (!confirmEnabled || !allowTruncate) {
      throw new Error(
        'Operation blocked. Set ALLOW_DATABASE_TRUNCATE=true and run with --confirm.'
      );
    }

    const database = process.env.DB_NAME;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD || process.env.DB_PASS;
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT || 3306);

    if (!database || !user) {
      throw new Error('Missing DB_NAME or DB_USER environment variable.');
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Invalid DB_PORT.');
    }

    if (['mysql', 'information_schema', 'performance_schema', 'sys'].includes(database.toLowerCase())) {
      throw new Error('System databases cannot be truncated.');
    }

    console.log('====================================');
    console.log('      COCO LYTICS DATABASE RESET');
    console.log('====================================');
    console.log(`Database: ${database}`);
    console.log(`Host: ${host}`);
    console.log('Connecting to MySQL...');

    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 15000
    });

    const [tables] = await connection.execute(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       AND TABLE_TYPE = 'BASE TABLE'`,
      [database]
    );

    const tableNames = tables
      .map(row => row.TABLE_NAME)
      .filter(name => !excludedTables.includes(name));

    if (tableNames.length === 0) {
      console.log('No eligible tables found.');
      return;
    }

    console.log(`Found ${tableNames.length} tables to truncate.`);

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      for (const table of tableNames) {
        const escapedTable = '`' + table.replace(/`/g, '``') + '`';

        await connection.query(`TRUNCATE TABLE ${escapedTable}`);

        console.log(`Truncated: ${table}`);
      }
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log('====================================');
    console.log('DATABASE TRUNCATION COMPLETED');
    console.log('Table structures were preserved.');
    console.log('Migration history tables were excluded.');
    console.log('====================================');

  } catch (error) {
    console.error('DATABASE TRUNCATION FAILED:');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

truncateDatabase();