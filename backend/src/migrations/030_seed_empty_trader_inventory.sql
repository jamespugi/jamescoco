INSERT INTO products (
  trader_id,
  product_name,
  size,
  length_cm,
  unit_price,
  stock_quantity,
  low_stock_threshold,
  reserved_quantity
)
SELECT
  u.id,
  'Cocolumber',
  'large',
  28.00,
  50.00,
  120,
  50,
  18
FROM users u
WHERE u.role = 'trader'
  AND NOT EXISTS (
    SELECT 1 FROM products existing WHERE existing.trader_id = u.id
  );