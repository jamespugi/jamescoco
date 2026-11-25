import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { createMysqlConfig } from './databaseConfig.js';

const { baseConfig, database: DB_NAME } = createMysqlConfig();
const IMPORT_SOURCE_DB_NAME = process.env.IMPORT_SOURCE_DB_NAME || 'new_cocolytics';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selectDatabaseSection(sql) {
  const databaseName = escapeRegExp(IMPORT_SOURCE_DB_NAME);
  const marker = new RegExp(
    '-- Database:\\s*(?:`' + databaseName + '`|' + databaseName + ')\\s*\\r?\\n',
    'i'
  );
  const match = marker.exec(sql);

  if (!match) {
    return sql;
  }

  const sectionStart = match.index + match[0].length;
  const nextDatabase = /\r?\n--\s*Database:\s*/gi;
  nextDatabase.lastIndex = sectionStart;
  const nextMatch = nextDatabase.exec(sql);

  return sql.slice(sectionStart, nextMatch ? nextMatch.index : sql.length);
}

async function main() {
  const argPath = process.argv[2];
  const sqlPath = argPath ? path.resolve(argPath) : path.resolve(process.cwd(), 'new_cocolytics.sql');

  try {
    await fs.access(sqlPath);
  } catch (err) {
    console.error(`SQL file not found at: ${sqlPath}`);
    console.error('Provide the path as the first argument, or place the file as `new_cocolytics.sql` in the backend folder.');
    process.exit(1);
  }

  const sql = await fs.readFile(sqlPath, 'utf8');

  let connection;
  try {
    if (process.env.NODE_ENV === 'production' && process.env.FORCE_IMPORT === 'true') {
      throw new Error('FORCE_IMPORT is disabled in production to protect existing database contents.');
    }

    if (process.env.FORCE_IMPORT === 'true') {
      connection = await mysql.createConnection(baseConfig);
      await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\`;`);
      await connection.query(`CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await connection.changeUser({ database: DB_NAME });
    } else if (process.env.NODE_ENV !== 'production') {
      connection = await mysql.createConnection(baseConfig);
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await connection.changeUser({ database: DB_NAME });
    } else {
      connection = await mysql.createConnection({ ...baseConfig, database: DB_NAME });
    }

    const [existingTables] = await connection.query(
      'SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ?',
      [DB_NAME]
    );
    if (Number(existingTables[0].count) > 0) {
      throw new Error(`Refusing to import into non-empty database ${DB_NAME}.`);
    }

    const databaseSql = selectDatabaseSection(sql)
      .replace(/CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+`[^`]+`[^;]*;/gi, '')
      .replace(/USE\s+`[^`]+`\s*;/gi, `USE \`${DB_NAME}\`;`)
      .replace(/\/\*!\d+\s+SET\s+(?:CHARACTER_SET_CLIENT|CHARACTER_SET_RESULTS|COLLATION_CONNECTION)\s*=\s*@OLD_[^*]+\*\/;?/gi, '');
    console.log(`Importing SQL from ${sqlPath} into database ${DB_NAME}...`);
    await connection.query(databaseSql);
    console.log('Import completed successfully.');
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error.message);
    if (connection) {
      try { await connection.end(); } catch {}
    }
    process.exit(1);
  }
}

main();
