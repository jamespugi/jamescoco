import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'new_cocolytics';
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

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  });

  try {
    if (process.env.FORCE_IMPORT === 'true') {
      await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\`;`);
    }
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.changeUser({ database: DB_NAME });

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
    try { await connection.end(); } catch (e) {}
    process.exit(1);
  }
}

main();
