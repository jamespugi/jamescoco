CREATE TABLE IF NOT EXISTS admin_signup_invite_usage (
  invite_id TINYINT UNSIGNED NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  used_by INT NULL,
  PRIMARY KEY (invite_id),
  CONSTRAINT fk_admin_signup_invite_usage_user
    FOREIGN KEY (used_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO admin_signup_invite_usage (invite_id) VALUES (1);
