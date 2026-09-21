import { pool } from '../db.js';

function firstDayOfMonth(value) {
  const date = value ? new Date(`${value}-01T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function createProductionBatch(ownerId, payload) {
  const [result] = await pool.execute(
    `INSERT INTO tree_production_batches
      (owner_id, tree_name, total_units, production_date, expected_cut_date, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [ownerId, payload.treeName, payload.totalUnits, payload.productionDate, payload.expectedCutDate || null, payload.notes || null]
  );
  return result.insertId;
}

export async function listProductionBatches(ownerId) {
  const [rows] = await pool.execute(
    `SELECT b.*, u.full_name AS owner_name, (b.total_units - b.cut_units) AS uncut_units
     FROM tree_production_batches b
     INNER JOIN users u ON u.id = b.owner_id
     WHERE b.owner_id = ?
     ORDER BY b.production_date DESC, b.id DESC`,
    [ownerId]
  );
  return rows;
}

export async function createReservation(buyerId, payload) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [products] = await connection.execute(
      `SELECT id, trader_id, stock_quantity, reserved_quantity, unit_price
       FROM products WHERE id = ? FOR UPDATE`,
      [payload.productId]
    );
    const product = products[0];
    if (!product) throw new Error('Product not found.');
    if (Number(product.trader_id) === Number(buyerId)) throw new Error('Tree owner and buyer must be different people.');
    const available = Number(product.stock_quantity) - Number(product.reserved_quantity || 0);
    if (payload.quantity > available) throw new Error(`Only ${available} unreserved units are available.`);

    const [result] = await connection.execute(
      `INSERT INTO reservations
        (product_id, owner_id, buyer_id, quantity, downpayment_required, reserved_until, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [payload.productId, product.trader_id, buyerId, payload.quantity, payload.downpaymentRequired, payload.reservedUntil || null, payload.notes || null]
    );
    await connection.execute(
      `UPDATE products SET reserved_quantity = reserved_quantity + ? WHERE id = ?`,
      [payload.quantity, payload.productId]
    );
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listReservationsForUser(userId) {
  const [rows] = await pool.execute(
    `SELECT r.*, p.product_name, p.size, p.length_cm,
            owner.full_name AS owner_name, buyer.full_name AS buyer_name
     FROM reservations r
     INNER JOIN products p ON p.id = r.product_id
     INNER JOIN users owner ON owner.id = r.owner_id
     INNER JOIN users buyer ON buyer.id = r.buyer_id
     WHERE r.owner_id = ? OR r.buyer_id = ?
     ORDER BY r.created_at DESC`,
    [userId, userId]
  );
  return rows;
}

export async function updateReservationDownpayment(buyerId, reservationId, paidAmount) {
  const [result] = await pool.execute(
    `UPDATE reservations
     SET downpayment_paid = ?,
         payment_status = CASE
           WHEN ? >= downpayment_required AND downpayment_required > 0 THEN 'paid'
           WHEN ? > 0 THEN 'partial'
           ELSE 'unpaid'
         END
     WHERE id = ? AND buyer_id = ? AND status IN ('pending', 'confirmed')`,
    [paidAmount, paidAmount, paidAmount, reservationId, buyerId]
  );
  return result.affectedRows;
}

export async function cancelReservation(userId, reservationId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT id, product_id, quantity FROM reservations
       WHERE id = ? AND (buyer_id = ? OR owner_id = ?) AND status IN ('pending', 'confirmed') FOR UPDATE`,
      [reservationId, userId, userId]
    );
    const reservation = rows[0];
    if (!reservation) return false;
    await connection.execute(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`, [reservationId]);
    await connection.execute(
      `UPDATE products SET reserved_quantity = GREATEST(0, reserved_quantity - ?) WHERE id = ?`,
      [reservation.quantity, reservation.product_id]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function recordMonthlyPrice(traderId, productId, effectiveMonth, unitPrice) {
  const [result] = await pool.execute(
    `INSERT INTO product_monthly_prices (product_id, effective_month, unit_price)
     SELECT id, ?, ? FROM products WHERE id = ? AND trader_id = ?
     ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price)`,
    [firstDayOfMonth(effectiveMonth), unitPrice, productId, traderId]
  );
  if (!result.affectedRows) throw new Error('Product not found for this trader.');
}

export async function getOperationsReport(traderId) {
  const [[stock]] = await pool.execute(
    `SELECT COALESCE(SUM(stock_quantity), 0) AS total_stock,
            COALESCE(SUM(reserved_quantity), 0) AS reserved_stock,
            COALESCE(SUM(stock_quantity - reserved_quantity), 0) AS available_stock,
            COALESCE(SUM(CASE WHEN stock_quantity - reserved_quantity <= low_stock_threshold THEN 1 ELSE 0 END), 0) AS low_stock_products
     FROM products WHERE trader_id = ?`,
    [traderId]
  );
  const [[production]] = await pool.execute(
    `SELECT COALESCE(SUM(total_units), 0) AS made_units,
            COALESCE(SUM(cut_units), 0) AS cut_units,
            COALESCE(SUM(total_units - cut_units), 0) AS uncut_units
     FROM tree_production_batches WHERE owner_id = ? AND status <> 'cancelled'`,
    [traderId]
  );
  const [prices] = await pool.execute(
    `SELECT p.product_name, mp.effective_month, mp.unit_price,
            LAG(mp.unit_price) OVER (PARTITION BY mp.product_id ORDER BY mp.effective_month) AS previous_price
     FROM product_monthly_prices mp
     INNER JOIN products p ON p.id = mp.product_id
     WHERE p.trader_id = ? ORDER BY mp.effective_month DESC, p.product_name`,
    [traderId]
  );
  const [reservations] = await pool.execute(
    `SELECT r.id, r.quantity, r.status, r.downpayment_required, r.downpayment_paid,
            r.payment_status, r.reserved_until, p.product_name,
            owner.full_name AS owner_name, buyer.full_name AS buyer_name
     FROM reservations r
     INNER JOIN products p ON p.id = r.product_id
     INNER JOIN users owner ON owner.id = r.owner_id
     INNER JOIN users buyer ON buyer.id = r.buyer_id
     WHERE r.owner_id = ? ORDER BY r.created_at DESC`,
    [traderId]
  );
  return {
    stock: Object.fromEntries(Object.entries(stock).map(([key, value]) => [key, Number(value || 0)])),
    production: Object.fromEntries(Object.entries(production).map(([key, value]) => [key, Number(value || 0)])),
    prices: prices.map((row) => ({
      productName: row.product_name,
      effectiveMonth: row.effective_month,
      unitPrice: Number(row.unit_price),
      previousPrice: row.previous_price === null ? null : Number(row.previous_price),
      trend: row.previous_price === null ? 'new' : Number(row.unit_price) > Number(row.previous_price) ? 'increased' : Number(row.unit_price) < Number(row.previous_price) ? 'decreased' : 'unchanged',
    })),
    reservations,
  };
}
