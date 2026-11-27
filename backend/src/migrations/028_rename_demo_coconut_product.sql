UPDATE products
SET product_name = 'Cocolumber'
WHERE product_name = 'Fresh Green Coconut'
  AND trader_id IN (
    SELECT id FROM users
    WHERE email = 'maria.trader@example.com'
  );