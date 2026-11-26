import { initializeDatabase, pool, importSqlFile } from './db.js';

async function run() {
  try {
    const importPath = process.env.IMPORT_SQL_PATH;
    if (importPath) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('IMPORT_SQL_PATH is disabled for production migrations. Import the backup separately into an empty database.');
      }

      const result = await importSqlFile(importPath);
      if (result.skipped) {
        console.log(`SQL import skipped: ${result.reason}`);
      } else {
        console.log('SQL import completed.');
      }
    }

    await initializeDatabase({ createDatabase: process.env.NODE_ENV !== 'production' });
    console.log('Database migrations applied successfully.');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

run();
