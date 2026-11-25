import { pool } from '../db.js';
import { getContactChannel, normalizeEmail, normalizePhoneNumber } from '../services/contactService.js';

export async function createClientUser({ fullName, email, phone, passwordHash, staffReason = '' }) {
  const [result] = await pool.execute(
    `
      INSERT INTO users (full_name, email, phone, password_hash, role, status, staff_reason, is_email_verified, email_verified_at, is_phone_verified)
      VALUES (?, ?, ?, ?, 'client', 'pending_client', ?, 0, NULL, 0)
    `,
    [
      String(fullName).trim(),
      email ? normalizeEmail(email) : null,
      phone || null,
      passwordHash,
      String(staffReason || '').trim() || null,
    ]
  );

  return result.insertId;
}

export async function createGoogleUser(fullName, email, passwordHash, googleId) {
  const [result] = await pool.execute(
    `
      INSERT INTO users (full_name, email, password_hash, google_id, role, status, staff_reason, is_email_verified, email_verified_at)
      VALUES (?, ?, ?, ?, 'client', 'pending_client', '', 1, CURRENT_TIMESTAMP)
    `,
    [String(fullName).trim(), normalizeEmail(email), passwordHash, googleId]
  );

  return result.insertId;
}

export async function findUserByGoogleId(googleId) {
  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email, phone, password_hash, role, status, is_email_verified, email_verified_at, is_phone_verified, is_archived, archived_at, created_at
      FROM users
      WHERE google_id = ?
      LIMIT 1
    `,
    [googleId]
  );

  return rows[0] || null;
}

export async function linkGoogleIdToUser(id, googleId) {
  await pool.execute(
    `
      UPDATE users
      SET google_id = ?, is_email_verified = 1, email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)
      WHERE id = ?
    `,
    [googleId, id]
  );
}

export async function findUserForLogin(identifier) {
  const channel = getContactChannel(identifier);
  const value = channel === 'email'
    ? normalizeEmail(identifier)
    : normalizePhoneNumber(identifier);
  const correctedEmail = value.replace(',', '.');

  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email, phone, password_hash, role, status, is_email_verified, email_verified_at, is_phone_verified, is_archived, archived_at, created_at
      FROM users
      WHERE (email IN (?, ?) AND ? = 'email')
        OR (phone = ? AND ? = 'phone')
      LIMIT 1
    `,
    [value, correctedEmail, channel, value, channel]
  );

  return rows[0] || null;
}

export async function findUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        full_name,
        email,
        phone,
        password_hash,
        role,
        status,
        is_email_verified,
        email_verified_at,
        is_phone_verified,
        is_archived,
        archived_at,
        created_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [normalizedEmail]
  );

  return rows[0] || null;
}

export async function findUserByPhone(phone) {
  const normalizedPhone = normalizePhoneNumber(phone);
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        full_name,
        email,
        phone,
        password_hash,
        role,
        status,
        is_email_verified,
        email_verified_at,
        is_phone_verified,
        is_archived,
        archived_at,
        created_at
      FROM users
      WHERE phone = ?
      LIMIT 1
    `,
    [normalizedPhone]
  );

  return rows[0] || null;
}

export async function findUserByContact(contact, channel = getContactChannel(contact)) {
  return channel === 'phone' ? findUserByPhone(contact) : findUserByEmail(contact);
}

export async function findUserById(id) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        full_name,
        email,
        phone,
        password_hash,
        role,
        status,
        is_email_verified,
        email_verified_at,
        is_phone_verified,
        profile_name,
        profile_description,
        contact_number,
        business_address,
        staff_reason,
        profile_image_path,
        gcash_qr_path,
        is_archived,
        archived_at,
        last_seen_at,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function updateUserLastSeenById(id, seenAt = new Date()) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET last_seen_at = ?
      WHERE id = ?
    `,
    [seenAt, id]
  );

  return result.affectedRows;
}

export async function markUserEmailVerifiedById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET is_email_verified = 1, email_verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function markUserPhoneVerifiedById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET is_phone_verified = 1
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function updateUserPasswordHashById(id, passwordHash) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [passwordHash, id]
  );

  return result.affectedRows;
}

export async function createOtpCode({ userId, recipient, channel = 'email', purpose, otpHash, expiresAt }) {
  const normalizedRecipient = channel === 'email'
    ? normalizeEmail(recipient)
    : normalizePhoneNumber(recipient);

  await pool.execute(
    `
      UPDATE user_otp_codes
      SET used_at = CURRENT_TIMESTAMP
      WHERE recipient = ?
        AND channel = ?
        AND purpose = ?
        AND used_at IS NULL
    `,
    [normalizedRecipient, channel, purpose]
  );

  const [result] = await pool.execute(
    `
      INSERT INTO user_otp_codes (user_id, email, channel, recipient, purpose, otp_hash, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      channel === 'email' ? normalizedRecipient : null,
      channel,
      normalizedRecipient,
      purpose,
      otpHash,
      expiresAt,
    ]
  );

  return result.insertId;
}

export async function findLatestActiveOtpCode(recipient, purpose, channel = 'email') {
  const normalizedRecipient = channel === 'email'
    ? normalizeEmail(recipient)
    : normalizePhoneNumber(recipient);
  const [rows] = await pool.execute(
    `
      SELECT id, user_id, email, channel, recipient, purpose, otp_hash, expires_at, verified_at, used_at, created_at
      FROM user_otp_codes
      WHERE recipient = ?
        AND channel = ?
        AND purpose = ?
        AND used_at IS NULL
      ORDER BY id DESC
      LIMIT 1
    `,
    [normalizedRecipient, channel, purpose]
  );

  return rows[0] || null;
}

export async function findOtpCodeById(id) {
  const [rows] = await pool.execute(
    `
      SELECT id, user_id, email, channel, recipient, purpose, otp_hash, expires_at, verified_at, used_at, created_at
      FROM user_otp_codes
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

export async function markOtpCodeVerifiedById(id) {
  const [result] = await pool.execute(
    `
      UPDATE user_otp_codes
      SET verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function markOtpCodeUsedById(id) {
  const [result] = await pool.execute(
    `
      UPDATE user_otp_codes
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function findAllNonAdminUsers() {
  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email, role, status, profile_name, contact_number, staff_reason, is_archived, archived_at, created_at
      FROM users
      WHERE role != 'admin'
      ORDER BY created_at DESC
    `
  );

  return rows;
}

export async function acceptPendingClientById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET status = 'accepted_client'
      WHERE id = ? AND role = 'client' AND status = 'pending_client' AND is_archived = 0
    `,
    [id]
  );

  return result.affectedRows;
}

export async function acceptPendingStaffById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET role = 'trader', status = 'trader'
      WHERE id = ? AND role = 'client' AND status = 'pending_staff' AND is_archived = 0
    `,
    [id]
  );

  return result.affectedRows;
}

export async function acceptAllPendingStaff() {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET role = 'trader', status = 'trader'
      WHERE role = 'client' AND status = 'pending_staff' AND is_archived = 0
    `
  );

  return result.affectedRows;
}

export async function archiveUserById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET is_archived = 1, archived_at = NOW()
      WHERE id = ? AND role != 'admin' AND is_archived = 0
    `,
    [id]
  );

  return result.affectedRows;
}

export async function restoreArchivedUserById(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET is_archived = 0, archived_at = NULL
      WHERE id = ? AND role != 'admin' AND is_archived = 1
    `,
    [id]
  );

  return result.affectedRows;
}

export async function setPendingStaffRequest(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET status = 'pending_staff'
      WHERE id = ?
    `,
    [id]
  );

  return result.affectedRows;
}

export async function acceptClientAsTrader(id) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET role = 'trader', status = 'trader'
      WHERE id = ? AND role = 'client' AND status = 'accepted_client'
    `,
    [id]
  );

  return result.affectedRows;
}

export async function updateTraderProfileById(id, payload) {
  const normalizedName = String(payload.name || '').trim();
  const [result] = await pool.execute(
    `
      UPDATE users
      SET
        full_name = ?,
        profile_name = ?,
        profile_description = ?,
        contact_number = ?,
        business_address = ?
      WHERE id = ? AND role = 'trader'
    `,
    [
      normalizedName,
      normalizedName,
      String(payload.description || '').trim(),
      String(payload.contactNumber || '').trim(),
      String(payload.businessAddress || '').trim(),
      id,
    ]
  );

  return result.affectedRows;
}

export async function updateTraderProfileImageById(id, profileImagePath) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET profile_image_path = ?
      WHERE id = ? AND role = 'trader'
    `,
    [profileImagePath, id]
  );

  return result.affectedRows;
}

export async function updateTraderGcashQrById(id, gcashQrPath) {
  const [result] = await pool.execute(
    `
      UPDATE users
      SET gcash_qr_path = ?
      WHERE id = ? AND role = 'trader'
    `,
    [gcashQrPath, id]
  );

  return result.affectedRows;
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email || '',
    phone: user.phone || '',
    role: user.role,
    status: user.status,
    isEmailVerified: Boolean(user.is_email_verified),
    emailVerifiedAt: user.email_verified_at || null,
    isPhoneVerified: Boolean(user.is_phone_verified),
    profileName: user.full_name || user.profile_name || '',
    profileDescription: user.profile_description || '',
    contactNumber: user.contact_number || '',
    businessAddress: user.business_address || '',
    staffReason: user.staff_reason || '',
    profileImagePath: user.profile_image_path || '',
    gcashQrPath: user.gcash_qr_path || '',
    isArchived: Boolean(user.is_archived),
    archivedAt: user.archived_at || null,
    lastSeenAt: user.last_seen_at || null,
    createdAt: user.created_at,
  };
}
