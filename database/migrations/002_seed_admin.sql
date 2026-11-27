SET @seed_admin_has_name = EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'name'
);

SET @seed_admin_has_password = EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'password'
);

SET @seed_admin_password_hash = '$2b$10$I3Sunjlg0HbmkcC1AYqsZ.yW13GK/HJfJx0NKpXRmPs3sFG0D./8m';

SET @seed_admin_insert_sql = CONCAT(
  'INSERT INTO users (',
  IF(@seed_admin_has_name, '`name`, ', ''),
  '`full_name`, `email`, ',
  IF(@seed_admin_has_password, '`password`, ', ''),
  '`password_hash`, `role`, `status`) ',
  'SELECT ',
  IF(@seed_admin_has_name, 'seed.admin_name, ', ''),
  'seed.admin_name, seed.admin_email, ',
  IF(@seed_admin_has_password, 'seed.password_hash, ', ''),
  'seed.password_hash, ''admin'', ''accepted_client'' ',
  'FROM (SELECT ',
  QUOTE('System Administrator'), ' AS admin_name, ',
  QUOTE('admin@gmail.com'), ' AS admin_email, ',
  QUOTE(@seed_admin_password_hash), ' AS password_hash UNION ALL SELECT ',
  QUOTE('System Administrator'), ', ',
  QUOTE('admin@gmail,com'), ', ',
  QUOTE(@seed_admin_password_hash), ') AS seed ',
  'WHERE NOT EXISTS (',
  'SELECT 1 FROM users AS existing WHERE existing.email = seed.admin_email',
  ')'
);

PREPARE seed_admin_insert FROM @seed_admin_insert_sql;
EXECUTE seed_admin_insert;
DEALLOCATE PREPARE seed_admin_insert;

UPDATE users
SET password_hash = @seed_admin_password_hash,
    role = 'admin',
    status = 'accepted_client'
WHERE email IN ('admin@gmail.com', 'admin@gmail,com');
