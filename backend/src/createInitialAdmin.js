import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { normalizeEmail, isValidEmail } from './services/contactService.js';

const email = normalizeEmail(process.env.INITIAL_ADMIN_EMAIL || '');
const password = String(process.env.INITIAL_ADMIN_PASSWORD || '');
const fullName = String(process.env.INITIAL_ADMIN_FULL_NAME || 'CocoLytics Administrator').trim();

if (!email || !isValidEmail(email)) {
  throw new Error('Set INITIAL_ADMIN_EMAIL to a valid admin email address.');
}

if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
  throw new Error('Set INITIAL_ADMIN_PASSWORD to at least 8 characters with uppercase, lowercase, and a number.');
}

async function main() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);
    const [existingRows] = await connection.execute(
      'SELECT id, email, role, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    let userId;
    if (existingRows.length) {
      userId = existingRows[0].id;
      await connection.execute(
        `
          UPDATE users
          SET
            password_hash = ?,
            role = 'admin',
            status = 'accepted_client',
            is_archived = 0,
            archived_at = NULL,
            is_email_verified = 1,
            email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)
          WHERE id = ?
        `,
        [passwordHash, userId]
      );
    } else {
      const [result] = await connection.execute(
        `
          INSERT INTO users (
            full_name,
            email,
            password_hash,
            role,
            status,
            is_archived,
            is_email_verified,
            email_verified_at
          )
          VALUES (?, ?, ?, 'admin', 'accepted_client', 0, 1, CURRENT_TIMESTAMP)
        `,
        [fullName, email, passwordHash]
      );
      userId = result.insertId;
    }

    await connection.commit();

    const [verifiedRows] = await connection.execute(
      `
        SELECT id, email, role, status, is_archived, password_hash
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );
    const verifiedUser = verifiedRows[0];

    if (!verifiedUser || verifiedUser.email !== email || verifiedUser.role !== 'admin') {
      throw new Error('Admin account verification failed.');
    }

    const passwordMatches = await bcrypt.compare(password, verifiedUser.password_hash);
    if (!passwordMatches) {
      throw new Error('Bcrypt password verification failed.');
    }

    console.info('Initial admin account ready.');
    console.info(`Email: ${verifiedUser.email}`);
    console.info(`Role: ${verifiedUser.role}`);
    console.info(`Status: ${verifiedUser.status}`);
    console.info(`Archived: ${Boolean(verifiedUser.is_archived) ? 'yes' : 'no'}`);
    console.info(`Password bcrypt hash verified: ${verifiedUser.password_hash.startsWith('$2') ? 'yes' : 'no'}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

await main();
