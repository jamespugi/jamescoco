ALTER TABLE orders
  ADD COLUMN payment_reference VARCHAR(120) NULL AFTER payment_status,
  ADD COLUMN paymongo_checkout_session_id VARCHAR(120) NULL AFTER payment_reference,
  ADD INDEX idx_orders_payment_reference (payment_reference),
  ADD UNIQUE INDEX uniq_orders_paymongo_session (paymongo_checkout_session_id);