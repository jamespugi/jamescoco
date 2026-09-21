INSERT INTO users (
  full_name, email, is_email_verified, password_hash, role, status,
  profile_name, profile_description, contact_number, business_address
)
SELECT
  seed.full_name,
  seed.email,
  1,
  '$2b$10$I3Sunjlg0HbmkcC1AYqsZ.yW13GK/HJfJx0NKpXRmPs3sFG0D./8m',
  'trader',
  'trader',
  seed.profile_name,
  seed.profile_description,
  seed.contact_number,
  seed.business_address
FROM (
  SELECT 'Maria Santos' AS full_name, 'maria.trader@example.com' AS email,
    'Maria''s Coconut Farm' AS profile_name,
    'Fresh farm-grown coconuts and naturally dried coconut products.' AS profile_description,
    '09171234567' AS contact_number, 'Davao City, Davao del Sur' AS business_address
  UNION ALL SELECT 'Juan Dela Cruz', 'juan.trader@example.com', 'Dela Cruz Coconut Trading',
    'Quality coconuts sourced from local farmers and prepared for reliable delivery.',
    '09181234567', 'Quezon City, Metro Manila'
  UNION ALL SELECT 'Ana Reyes', 'ana.trader@example.com', 'Reyes Tropical Produce',
    'Specialty coconut products for households, food makers, and small businesses.',
    '09191234567', 'Naga City, Camarines Sur'
  UNION ALL SELECT 'Pedro Garcia', 'pedro.trader@example.com', 'Garcia Island Harvest',
    'Island-grown coconut selections with dependable stock for every order.',
    '09201234567', 'Cebu City, Cebu'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM users existing WHERE existing.email = seed.email
);

INSERT INTO products (
  trader_id, product_name, size, length_cm, unit_price, stock_quantity, reserved_quantity
)
SELECT u.id, seed.product_name, seed.size, seed.length_cm, seed.unit_price, seed.stock_quantity, 0
FROM users u
INNER JOIN (
  SELECT 'maria.trader@example.com' AS email, 'Fresh Green Coconut' AS product_name, 'large' AS size, 28.00 AS length_cm, 85.00 AS unit_price, 120 AS stock_quantity
  UNION ALL SELECT 'maria.trader@example.com', 'Dried Coconut Meat', 'medium', 18.00, 140.00, 80
  UNION ALL SELECT 'juan.trader@example.com', 'Premium Young Coconut', 'medium', 22.00, 75.00, 150
  UNION ALL SELECT 'juan.trader@example.com', 'Coconut Shell Charcoal', 'large', 30.00, 180.00, 60
  UNION ALL SELECT 'ana.trader@example.com', 'Coconut Cooking Oil', 'medium', 20.00, 210.00, 45
  UNION ALL SELECT 'ana.trader@example.com', 'Fresh Coconut Meat', 'small', 12.00, 95.00, 100
  UNION ALL SELECT 'pedro.trader@example.com', 'Island Fresh Coconut', 'large', 29.00, 90.00, 200
  UNION ALL SELECT 'pedro.trader@example.com', 'Coconut Milk Pack', 'small', 10.00, 125.00, 70
  UNION ALL SELECT 'maria.trader@example.com', 'Coconut Flour', 'medium', 16.00, 160.00, 90
  UNION ALL SELECT 'juan.trader@example.com', 'Coconut Vinegar', 'small', 14.00, 110.00, 75
) AS seed ON seed.email = u.email
WHERE NOT EXISTS (
  SELECT 1
  FROM products existing
  WHERE existing.trader_id = u.id AND existing.product_name = seed.product_name
);