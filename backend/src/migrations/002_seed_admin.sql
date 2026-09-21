INSERT INTO users (full_name, email, password_hash, role, status)
SELECT 'System Administrator', 'admin@gmail.com', '$2b$10$I3Sunjlg0HbmkcC1AYqsZ.yW13GK/HJfJx0NKpXRmPs3sFG0D./8m', 'admin', 'accepted_client'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@gmail.com'
);

INSERT INTO users (full_name, email, password_hash, role, status)
SELECT 'System Administrator', 'admin@gmail,com', '$2b$10$I3Sunjlg0HbmkcC1AYqsZ.yW13GK/HJfJx0NKpXRmPs3sFG0D./8m', 'admin', 'accepted_client'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@gmail,com'
);

UPDATE users
SET password_hash = '$2b$10$I3Sunjlg0HbmkcC1AYqsZ.yW13GK/HJfJx0NKpXRmPs3sFG0D./8m',
    role = 'admin',
    status = 'accepted_client'
WHERE email IN ('admin@gmail.com', 'admin@gmail,com');
