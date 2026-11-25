UPDATE products
SET product_name = 'Cocolumber'
WHERE trader_id IN (
  SELECT id FROM users
  WHERE email IN (
    'maria.trader@example.com',
    'juan.trader@example.com',
    'ana.trader@example.com',
    'pedro.trader@example.com'
  )
);