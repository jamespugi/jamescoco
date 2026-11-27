
import 'dotenv/config';
import mysql from 'mysql2/promise';

async function dropDatabase() {
  let connection;

  try {
    if (process.argv.includes('--confirm') !== true ||
        process.env.ALLOW_DATABASE_DROP !== 'true') {
      throw new Error(
        'Blocked. Set ALLOW_DATABASE_DROP=true and use --confirm.'
      );
    }

    const database = process.env.DB_NAME;
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD || process.env.DB_PASS;
    const port = Number(process.env.DB_PORT || 3306);

    if (!database || !user) {
      throw new Error('Missing database configuration.');
    }

    const protectedDatabases = [
      'mysql',
      'information_schema',
      'performance_schema',
      'sys'
    ];

    if (protectedDatabases.includes(database.toLowerCase())) {
      throw new Error('System databases cannot be dropped.');
    }

    console.log(`Connecting to database: ${database}`);

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

    const [views] = await connection.execute(
      `SELECT TABLE_NAME
       FROM information_schema.VIEWS
       WHERE TABLE_SCHEMA = ?`,
      [database]
    );

    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      for (const row of views) {
        const name = row.TABLE_NAME.replace(/`/g, '``');
        await connection.query(`DROP VIEW IF EXISTS \`${name}\``);
        console.log(`Dropped view: ${row.TABLE_NAME}`);
      }

      for (const row of tables) {
        const name = row.TABLE_NAME.replace(/`/g, '``');
        await connection.query(`DROP TABLE IF EXISTS \`${name}\``);
        console.log(`Dropped table: ${row.TABLE_NAME}`);
      }
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    console.log('================================');
    console.log('DATABASE DROP COMPLETED');
    console.log(`Database ${database} still exists.`);
    console.log('All tables and views were removed.');
    console.log('================================');

  } catch (error) {
    console.error('DATABASE DROP FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

dropDatabase();
