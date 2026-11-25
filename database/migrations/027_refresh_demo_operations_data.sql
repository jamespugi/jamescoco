UPDATE products p
INNER JOIN users u ON u.id = p.trader_id
SET p.stock_quantity = CASE p.product_name
  WHEN 'Fresh Green Coconut' THEN 120
  WHEN 'Dried Coconut Meat' THEN 80
  WHEN 'Premium Young Coconut' THEN 150
  WHEN 'Coconut Shell Charcoal' THEN 60
  WHEN 'Coconut Cooking Oil' THEN 45
  WHEN 'Fresh Coconut Meat' THEN 100
  WHEN 'Island Fresh Coconut' THEN 200
  WHEN 'Coconut Milk Pack' THEN 70
  WHEN 'Coconut Flour' THEN 90
  WHEN 'Coconut Vinegar' THEN 75
  ELSE p.stock_quantity
END
WHERE u.email IN ('maria.trader@example.com', 'juan.trader@example.com', 'ana.trader@example.com', 'pedro.trader@example.com')
AND p.stock_quantity <= 0;

INSERT INTO product_monthly_prices (product_id, effective_month, unit_price)
SELECT p.id, prices.effective_month, prices.unit_price
FROM products p
INNER JOIN users u ON u.id = p.trader_id
INNER JOIN (
  SELECT 'Fresh Green Coconut' AS product_name, '2026-05-01' AS effective_month, 78.00 AS unit_price
  UNION ALL SELECT 'Fresh Green Coconut', '2026-06-01', 82.00
  UNION ALL SELECT 'Fresh Green Coconut', '2026-07-01', 85.00
  UNION ALL SELECT 'Fresh Green Coconut', '2026-08-01', 83.00
  UNION ALL SELECT 'Dried Coconut Meat', '2026-05-01', 135.00
  UNION ALL SELECT 'Dried Coconut Meat', '2026-06-01', 140.00
  UNION ALL SELECT 'Dried Coconut Meat', '2026-07-01', 138.00
  UNION ALL SELECT 'Dried Coconut Meat', '2026-08-01', 145.00
  UNION ALL SELECT 'Premium Young Coconut', '2026-05-01', 72.00
  UNION ALL SELECT 'Premium Young Coconut', '2026-06-01', 75.00
  UNION ALL SELECT 'Premium Young Coconut', '2026-07-01', 74.00
  UNION ALL SELECT 'Premium Young Coconut', '2026-08-01', 79.00
  UNION ALL SELECT 'Coconut Shell Charcoal', '2026-05-01', 175.00
  UNION ALL SELECT 'Coconut Shell Charcoal', '2026-06-01', 180.00
  UNION ALL SELECT 'Coconut Shell Charcoal', '2026-07-01', 185.00
  UNION ALL SELECT 'Coconut Shell Charcoal', '2026-08-01', 180.00
  UNION ALL SELECT 'Coconut Cooking Oil', '2026-05-01', 200.00
  UNION ALL SELECT 'Coconut Cooking Oil', '2026-06-01', 205.00
  UNION ALL SELECT 'Coconut Cooking Oil', '2026-07-01', 210.00
  UNION ALL SELECT 'Coconut Cooking Oil', '2026-08-01', 215.00
  UNION ALL SELECT 'Fresh Coconut Meat', '2026-05-01', 100.00
  UNION ALL SELECT 'Fresh Coconut Meat', '2026-06-01', 98.00
  UNION ALL SELECT 'Fresh Coconut Meat', '2026-07-01', 95.00
  UNION ALL SELECT 'Fresh Coconut Meat', '2026-08-01', 97.00
  UNION ALL SELECT 'Island Fresh Coconut', '2026-05-01', 88.00
  UNION ALL SELECT 'Island Fresh Coconut', '2026-06-01', 90.00
  UNION ALL SELECT 'Island Fresh Coconut', '2026-07-01', 94.00
  UNION ALL SELECT 'Island Fresh Coconut', '2026-08-01', 92.00
  UNION ALL SELECT 'Coconut Milk Pack', '2026-05-01', 120.00
  UNION ALL SELECT 'Coconut Milk Pack', '2026-06-01', 125.00
  UNION ALL SELECT 'Coconut Milk Pack', '2026-07-01', 123.00
  UNION ALL SELECT 'Coconut Milk Pack', '2026-08-01', 130.00
  UNION ALL SELECT 'Coconut Flour', '2026-05-01', 150.00
  UNION ALL SELECT 'Coconut Flour', '2026-06-01', 155.00
  UNION ALL SELECT 'Coconut Flour', '2026-07-01', 160.00
  UNION ALL SELECT 'Coconut Flour', '2026-08-01', 158.00
  UNION ALL SELECT 'Coconut Vinegar', '2026-05-01', 105.00
  UNION ALL SELECT 'Coconut Vinegar', '2026-06-01', 102.00
  UNION ALL SELECT 'Coconut Vinegar', '2026-07-01', 110.00
  UNION ALL SELECT 'Coconut Vinegar', '2026-08-01', 112.00
) prices ON prices.product_name = p.product_name
WHERE u.email IN ('maria.trader@example.com', 'juan.trader@example.com', 'ana.trader@example.com', 'pedro.trader@example.com')
ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price);
