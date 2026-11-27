ALTER TABLE users
  MODIFY COLUMN email VARCHAR(190) NULL;

SET @db_name = DATABASE();

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'phone'
  ) = 0,
  'ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL AFTER email',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'is_phone_verified'
  ) = 0,
  'ALTER TABLE users ADD COLUMN is_phone_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_email_verified',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'uq_users_phone'
  ) = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_users_phone (phone)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'user_otp_codes'
      AND COLUMN_NAME = 'channel'
  ) = 0,
  'ALTER TABLE user_otp_codes ADD COLUMN channel VARCHAR(10) NOT NULL DEFAULT ''email'' AFTER email',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'user_otp_codes'
      AND COLUMN_NAME = 'recipient'
  ) = 0,
  'ALTER TABLE user_otp_codes ADD COLUMN recipient VARCHAR(190) NULL AFTER channel',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE user_otp_codes
SET recipient = email
WHERE recipient IS NULL;

ALTER TABLE user_otp_codes
  MODIFY COLUMN email VARCHAR(190) NULL;

ALTER TABLE user_otp_codes
  MODIFY COLUMN recipient VARCHAR(190) NOT NULL;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'user_otp_codes'
      AND INDEX_NAME = 'idx_user_otp_recipient_purpose'
  ) = 0,
  'ALTER TABLE user_otp_codes ADD KEY idx_user_otp_recipient_purpose (recipient, channel, purpose)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
