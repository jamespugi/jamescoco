
import 'dotenv/config';
import {
  initializeDatabase,
  pool,
  importSqlFile,
} from './db.js';

async function run() {
  let exitCode = 0;

  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const importPath = process.env.IMPORT_SQL_PATH;

    console.log('Starting CocoLytics database migration...');
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

    if (importPath) {
      if (isProduction) {
        throw new Error(
          'IMPORT_SQL_PATH is disabled in production. Import database backups separately.'
        );
      }

      console.log('Importing SQL file...');

      const result = await importSqlFile(importPath);

      if (result.skipped) {
        console.log(`SQL import skipped: ${result.reason}`);
      } else {
        console.log('SQL import completed.');
      }
    }

    console.log('Initializing database...');

    await initializeDatabase({
      createDatabase: !isProduction,
    });

    console.log('Database migrations applied successfully.');
  } catch (error) {
    exitCode = 1;
    console.error('Migration failed:', error?.message || error);
  } finally {
    try {
      await pool.end();
      console.log('Database connection closed.');
    } catch (error) {
      exitCode = 1;
      console.error('Failed to close database connection:', error.message);
    }

    process.exitCode = exitCode;
  }
}

run();
