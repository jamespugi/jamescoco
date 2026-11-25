UPDATE products
SET low_stock_threshold = 50;

ALTER TABLE products
  ALTER COLUMN low_stock_threshold SET DEFAULT 50;