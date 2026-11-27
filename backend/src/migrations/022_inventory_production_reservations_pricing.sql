ALTER TABLE products
  ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 20,
  ADD COLUMN reserved_quantity INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tree_production_batches (
  id INT NOT NULL AUTO_INCREMENT,
  owner_id INT NOT NULL,
  tree_name VARCHAR(180) NOT NULL,
  total_units INT NOT NULL,
  cut_units INT NOT NULL DEFAULT 0,
  production_date DATE NOT NULL,
  expected_cut_date DATE DEFAULT NULL,
  status ENUM('made','partially_cut','cut','cancelled') NOT NULL DEFAULT 'made',
  notes VARCHAR(600) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tree_batches_owner (owner_id),
  KEY idx_tree_batches_status (status),
  CONSTRAINT fk_tree_batches_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_tree_batch_units CHECK (total_units > 0 AND cut_units >= 0 AND cut_units <= total_units)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reservations (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  owner_id INT NOT NULL,
  buyer_id INT NOT NULL,
  quantity INT NOT NULL,
  status ENUM('pending','confirmed','fulfilled','cancelled') NOT NULL DEFAULT 'pending',
  downpayment_required DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  downpayment_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_status ENUM('unpaid','partial','paid','refunded') NOT NULL DEFAULT 'unpaid',
  reserved_until DATETIME DEFAULT NULL,
  notes VARCHAR(600) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservations_owner (owner_id),
  KEY idx_reservations_buyer (buyer_id),
  KEY idx_reservations_product_status (product_id, status),
  CONSTRAINT fk_reservations_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reservations_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_reservation_people_differ CHECK (owner_id <> buyer_id),
  CONSTRAINT chk_reservation_quantity CHECK (quantity > 0),
  CONSTRAINT chk_reservation_downpayment CHECK (downpayment_required >= 0 AND downpayment_paid >= 0 AND downpayment_paid <= downpayment_required)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_monthly_prices (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  effective_month DATE NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_product_effective_month (product_id, effective_month),
  KEY idx_monthly_prices_month (effective_month),
  CONSTRAINT fk_monthly_prices_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT chk_monthly_price_positive CHECK (unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO product_monthly_prices (product_id, effective_month, unit_price)
SELECT id, DATE_FORMAT(COALESCE(updated_at, created_at), '%Y-%m-01'), unit_price
FROM products
WHERE unit_price IS NOT NULL
ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price);
