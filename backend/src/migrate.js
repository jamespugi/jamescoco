import { initializeDatabase, pool, importSqlFile } from './db.js';
import fs from 'node:fs/promises';
import path from 'node:path';

async function run() {
  try {
    // attempt automatic SQL import if dump exists or IMPORT_SQL_PATH provided
    const importPath = process.env.IMPORT_SQL_PATH || path.resolve(process.cwd(), 'new_cocolytics.sql');
    try {
      await fs.access(importPath);
      console.log(`Found SQL dump at ${importPath} — importing before migrations...`);
      try {
        const res = await importSqlFile(importPath);
        if (res && res.skipped) {
          console.log(`SQL import skipped: ${res.reason}`);
        } else if (res && res.imported) {
          console.log('SQL import completed.');
        } else {
          console.log('SQL import finished with unknown status.');
        }
      } catch (importErr) {
        // By default, don't abort migrations on import errors. Set FAIL_ON_IMPORT=true to rethrow.
        if (process.env.FAIL_ON_IMPORT === 'true') {
          throw importErr;
        }
        console.warn('SQL import failed but migrations will continue:', importErr.message);
      }
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        console.log('No SQL dump found — skipping automatic import.');
      } else {
        // other access/read errors — surface them
        console.warn('Skipping SQL import due to:', err.message || err);
      }
    }

    await initializeDatabase();
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
