import bcrypt from 'bcryptjs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMysqlConfig } from './databaseConfig.js';
import { pool } from './db.js';

export const DEMO_SEED_MARKER = 'COCOLYTICS_DEMO_SEED_V1';
export const PRODUCT_PREFIX = 'DEMO SAMPLE Cocolumber Seed V1';
export const PAPER_PREFIX = `DEMO SAMPLE Permit-to-Cut ${DEMO_SEED_MARKER}`;
export const PRODUCTION_PREFIX = `${DEMO_SEED_MARKER}:PRODUCTION:`;
export const ORDER_PREFIX = `${DEMO_SEED_MARKER}:ORDER:`;

const DEFAULT_DEVELOPMENT_PASSWORD = 'CocoLyticsDemo2026!';
const LOCK_NAME = 'cocolytics-demo-seed-v1';
const DAY_MS = 24 * 60 * 60 * 1000;

const filipinoNames = [
  'Juan Dela Cruz',
  'Maria Santos',
  'Jose Reyes',
  'Angela Garcia',
  'Mark Villanueva',
  'Carlo Mendoza',
  'Patricia Flores',
  'Michael Ramos',
  'Ana Bautista',
  'Roberto Cruz',
  'Liza Fernandez',
  'Miguel Aquino',
  'Rosa De Guzman',
  'Daniel Navarro',
  'Elena Castillo',
  'Paolo Rivera',
  'Cristina Soriano',
  'Ramon Mercado',
  'Teresa Lim',
  'Francisca Torres',
  'Eduardo Valdez',
  'Jasmine Tolentino',
  'Manuel Cabrera',
  'Bianca Manalo',
  'Ernesto Salazar',
  'Lourdes Santiago',
  'Gabriel Ocampo',
  'Maricel Pineda',
  'Antonio Pascual',
  'Clarissa Dizon',
  'Andres Velasco',
  'Katrina Abad',
  'Noel Dominguez',
  'Stephanie Fajardo',
  'Enrique Laurel',
  'Rowena Campos',
  'Emilio Bautista',
  'Melissa Alonzo',
  'Cesar Padilla',
  'Camille De Leon',
  'Arnel Roldan',
  'Jocelyn Marquez',
  'Victor Natividad',
  'Mayumi Sarmiento',
  'Isko Macapagal',
  'Marlon Yumul',
  'Giselle Lacsamana',
  'Ricardo Manansala',
  'Rhea Maceda',
  'Benjamin Chua',
  'Nina Co',
  'Bernardo Tiongson',
  'Lea Panganiban',
  'Rodrigo Sison',
  'Hazel De Vera',
  'Emiliano Abella',
  'Sarah Katigbak',
  'Kristine Encarnacion',
  'Francisco Robles',
  'Arlene Molina',
];

const addresses = [
  { region: 'MIMAROPA', province: 'Oriental Mindoro', city: 'Calapan City', barangay: 'San Vicente', street: 'Sample Farm Road' },
  { region: 'MIMAROPA', province: 'Oriental Mindoro', city: 'Naujan', barangay: 'Bancuro', street: 'Coconut Grove Street' },
  { region: 'MIMAROPA', province: 'Oriental Mindoro', city: 'Victoria', barangay: 'Leido', street: 'Harvest Lane' },
  { region: 'MIMAROPA', province: 'Oriental Mindoro', city: 'Pinamalayan', barangay: 'Marfrancisco', street: 'Lumber Yard Road' },
  { region: 'MIMAROPA', province: 'Oriental Mindoro', city: 'Roxas', barangay: 'San Aquilino', street: 'Market Access Road' },
  { region: 'MIMAROPA', province: 'Oriental Mindoro', city: 'Puerto Galera', barangay: 'Balatero', street: 'Coastal Trade Road' },
  { region: 'MIMAROPA', province: 'Oriental Mindoro', city: 'Bongabong', barangay: 'Labasan', street: 'Farmers Road' },
  { region: 'MIMAROPA', province: 'Oriental Mindoro', city: 'Bansud', barangay: 'Proper Bansud', street: 'Coconut Mill Street' },
  { region: 'MIMAROPA', province: 'Occidental Mindoro', city: 'San Jose', barangay: 'Bubog', street: 'Provincial Road' },
  { region: 'MIMAROPA', province: 'Occidental Mindoro', city: 'Mamburao', barangay: 'Tayamaan', street: 'Sample Trading Road' },
  { region: 'MIMAROPA', province: 'Palawan', city: 'Puerto Princesa City', barangay: 'San Miguel', street: 'Sample Market Road' },
  { region: 'Bicol Region', province: 'Camarines Sur', city: 'Naga City', barangay: 'Concepcion Pequeña', street: 'Harvest Avenue' },
  { region: 'Central Visayas', province: 'Cebu', city: 'Cebu City', barangay: 'Lahug', street: 'Sample Commerce Street' },
  { region: 'Davao Region', province: 'Davao del Sur', city: 'Davao City', barangay: 'Buhangin', street: 'Coconut Trading Road' },
  { region: 'Western Visayas', province: 'Iloilo', city: 'Iloilo City', barangay: 'Jaro', street: 'Sample Lumber Street' },
];

const lumberSections = [
  { thicknessIn: 2, widthIn: 2, size: 'small' },
  { thicknessIn: 2, widthIn: 3, size: 'medium' },
  { thicknessIn: 2, widthIn: 4, size: 'medium' },
  { thicknessIn: 3, widthIn: 3, size: 'large' },
  { thicknessIn: 4, widthIn: 4, size: 'large' },
];
const lumberLengthsFt = [6, 8, 10, 12];
const orderStatuses = ['completed', 'to_receive', 'to_ship', 'pending', 'cancelled'];

function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function toSqlDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(now, days) {
  return new Date(now.getTime() - days * DAY_MS);
}

function daysAfter(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function monthStart(now, monthsAgo) {
  return toSqlDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1)));
}

function fullAddress(address) {
  return `${address.street}, ${address.barangay}, ${address.city}, ${address.province}, ${address.region}`;
}

export function createDemoData(now = new Date()) {
  const users = filipinoNames.map((fullName, index) => {
    const role = index < 40 ? 'trader' : 'client';
    const address = addresses[index % addresses.length];
    const ageDays = role === 'trader'
      ? 430 - index
      : 365 - (index - 40) * 15;
    const createdAt = toSqlDateTime(daysAgo(now, ageDays));
    const email = `demo.user${String(index + 1).padStart(3, '0')}@example.test`;
    const phone = `+63900${String(index + 1).padStart(7, '0')}`;

    return {
      index,
      fullName,
      email,
      phone,
      role,
      status: role === 'trader' ? 'trader' : 'accepted_client',
      profileName: role === 'trader' ? `Coco Lumber Trading - ${fullName}` : fullName,
      profileDescription: `${DEMO_SEED_MARKER}: DEMO SAMPLE ${role} profile; generated test data only.`,
      staffReason: `${DEMO_SEED_MARKER}:USER:${email}: DEMO SAMPLE ACCOUNT; not an application.`,
      contactNumber: phone,
      businessAddress: fullAddress(address),
      address,
      createdAt,
    };
  });

  const traders = users.filter((user) => user.role === 'trader');
  const clients = users.filter((user) => user.role === 'client');

  const products = Array.from({ length: 50 }, (_, index) => {
    const section = lumberSections[index % lumberSections.length];
    const lengthFt = lumberLengthsFt[Math.floor(index / lumberSections.length) % lumberLengthsFt.length];
    const productName = `${PRODUCT_PREFIX} ${lengthFt}ft x ${section.widthIn}in x ${section.thicknessIn}in #${String(index + 1).padStart(3, '0')}`;
    const productPrice = Number((
      110
      + lengthFt * 18
      + section.widthIn * section.thicknessIn * 12
      + (index % 4) * 15
    ).toFixed(2));

    return {
      index,
      productName,
      traderEmail: traders[index % traders.length].email,
      size: section.size,
      lengthCm: Number((lengthFt * 30.48).toFixed(2)),
      productPrice,
      stockQuantity: 60 + (index % 9) * 10,
      createdAt: toSqlDateTime(daysAgo(now, 370)),
    };
  });

  const orders = Array.from({ length: 100 }, (_, index) => {
    const buyer = clients[index % clients.length];
    const buyerIndex = index % clients.length;
    const orderNumber = index + 1;
    const occurrence = Math.floor(index / clients.length);
    const buyerAgeDays = 365 - buyerIndex * 15;
    const orderAgeDays = Math.max(0, Math.round(buyerAgeDays * (4 - occurrence) / 4) - 1);
    const product = products[(index * 7) % products.length];
    const createdDate = daysAgo(now, orderAgeDays);
    const status = orderNumber <= 55
      ? orderStatuses[0]
      : orderNumber <= 65
        ? orderStatuses[1]
        : orderNumber <= 80
          ? orderStatuses[2]
          : orderNumber <= 92
            ? orderStatuses[3]
            : orderStatuses[4];
    const quantity = 1 + (index % 4);
    const buyerRating = status === 'completed' && index % 3 !== 0
      ? (index % 2 === 0 ? 5 : 4)
      : null;
    const dispatchDate = ['to_receive', 'to_ship', 'completed'].includes(status)
      ? toSqlDateTime(daysAfter(createdDate, status === 'to_ship' ? 2 : 1))
      : null;

    return {
      index,
      marker: `${ORDER_PREFIX}${String(orderNumber).padStart(3, '0')}`,
      buyerEmail: buyer.email,
      buyerName: buyer.fullName,
      buyerPhone: buyer.phone,
      productName: product.productName,
      traderEmail: product.traderEmail,
      quantity,
      unitPrice: product.productPrice,
      lineTotal: Number((quantity * product.productPrice).toFixed(2)),
      status,
      createdAt: toSqlDateTime(createdDate),
      dispatchDate,
      deliveryAddress: buyer.address,
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'not_required',
      cancellationReason: status === 'cancelled' ? 'DEMO SAMPLE: cancelled before fulfillment.' : null,
      buyerRating,
      buyerReview: buyerRating ? `${DEMO_SEED_MARKER}: DEMO SAMPLE buyer review.` : null,
    };
  });

  const permits = Array.from({ length: 50 }, (_, index) => {
    const permitNumber = `SAMPLE-PTC-${now.getUTCFullYear()}-${String(index + 1).padStart(4, '0')}`;
    const issuedDate = daysAgo(now, 300 - (index * 5) % 300);
    const expiresDate = daysAfter(issuedDate, 365);
    const status = index % 10 < 4
      ? 'pending'
      : index % 10 < 8
        ? 'approved'
        : 'rejected';

    return {
      index,
      title: `${PAPER_PREFIX} ${permitNumber}`,
      traderEmail: traders[index % traders.length].email,
      description: `${DEMO_SEED_MARKER}: DEMO SAMPLE RECORD only; not a government-issued permit. Permit no. ${permitNumber}; issued ${toSqlDate(issuedDate)}; expires ${toSqlDate(expiresDate)}. No document is attached.`,
      status,
      createdAt: toSqlDateTime(issuedDate),
      reviewedAt: status === 'pending'
        ? null
        : toSqlDateTime(daysAfter(issuedDate, 1)),
      filePath: `demo-placeholder/${permitNumber}-no-document-attached`,
      originalFileName: 'DEMO SAMPLE - NO DOCUMENT ATTACHED',
    };
  });

  const productionBatches = Array.from({ length: 50 }, (_, index) => {
    const product = products[index % products.length];
    const marker = `${PRODUCTION_PREFIX}${String(index + 1).padStart(3, '0')}`;
    const totalUnits = 20 + (index * 17) % 150;
    const status = ['made', 'partially_cut', 'cut', 'cancelled'][index % 4];
    const cutUnits = status === 'cut'
      ? totalUnits
      : status === 'partially_cut'
        ? Math.floor(totalUnits * 0.4)
        : 0;
    const productionDate = daysAgo(now, (index * 7) % 365);

    return {
      index,
      marker,
      ownerEmail: product.traderEmail,
      treeName: `Coco Lumber Production Lot #${String(index + 1).padStart(3, '0')}`,
      relatedProductName: product.productName,
      totalUnits,
      cutUnits,
      status,
      productionDate: toSqlDate(productionDate),
      expectedCutDate: toSqlDate(daysAfter(productionDate, 30)),
      notes: `${marker} DEMO SAMPLE production record; related product ${product.productName}.`,
    };
  });

  const monthlyPrices = [];
  for (const product of products.slice(0, 4)) {
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const monthOffset = 11 - monthIndex;
      const seasonalAdjustment = [0, 5, -3, 8, -2, 4, 0, -6, 9, -3, 6, 0][monthIndex];
      const unitPrice = Number((
        product.productPrice * (1 + monthIndex * 0.006)
        + seasonalAdjustment
      ).toFixed(2));

      monthlyPrices.push({
        productName: product.productName,
        effectiveMonth: monthStart(now, monthOffset),
        unitPrice,
      });
    }
  }

  return { users, products, orders, permits, productionBatches, monthlyPrices };
}

export function resolveSeedPassword(env, databaseHost) {
  const isProduction = env.NODE_ENV === 'production';
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(String(databaseHost || '').toLowerCase());
  const suppliedPassword = String(env.DEMO_SEED_PASSWORD || '');

  if (!isLocalHost && env.DEMO_SEED_ALLOW_REMOTE !== 'true') {
    throw new Error('Remote database seeding is blocked. Set DEMO_SEED_ALLOW_REMOTE=true for a deliberate one-off run.');
  }

  if (isProduction && env.DEMO_SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Production seeding is blocked. Set DEMO_SEED_ALLOW_PRODUCTION=true for a deliberate one-off run.');
  }

  if ((isProduction || !isLocalHost) && !suppliedPassword) {
    throw new Error('Set DEMO_SEED_PASSWORD to a strong one-time password for remote or production demo accounts.');
  }

  const password = suppliedPassword || DEFAULT_DEVELOPMENT_PASSWORD;
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
    throw new Error('DEMO_SEED_PASSWORD must meet the login password rules: 8+ characters with uppercase, lowercase, and a number.');
  }
  if ((isProduction || !isLocalHost) && password.length < 16) {
    throw new Error('Remote and production demo passwords must be at least 16 characters.');
  }

  return password;
}

function createCounts(data) {
  return Object.fromEntries(
    Object.entries(data).map(([category, records]) => [category, { inserted: 0, skipped: 0, failed: 0 }])
  );
}

function increment(counts, category, outcome) {
  counts[category][outcome] += 1;
}

async function findSeedUser(connection, user) {
  const [rows] = await connection.execute(
    `SELECT id, email, phone, role, status, is_email_verified, is_archived, profile_description, staff_reason
     FROM users
     WHERE email = ? OR phone = ?
     LIMIT 2`,
    [user.email, user.phone]
  );

  if (!rows.length) {
    return null;
  }

  if (
    rows.length !== 1
    || rows[0].email !== user.email
    || rows[0].role !== user.role
    || rows[0].status !== user.status
    || !Number(rows[0].is_email_verified)
    || Number(rows[0].is_archived)
    || !String(rows[0].staff_reason || '').startsWith(`${DEMO_SEED_MARKER}:`)
  ) {
    throw new Error(`Seed account conflict for ${user.email}; no existing account was changed.`);
  }

  return Number(rows[0].id);
}

async function ensureSeedUsers(connection, users, password, counts) {
  const userIds = new Map();
  for (const user of users) {
    const existingId = await findSeedUser(connection, user);
    if (existingId) {
      userIds.set(user.email, existingId);
      increment(counts, 'users', 'skipped');
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await connection.execute(
      `INSERT INTO users (
        full_name, email, phone, is_email_verified, email_verified_at,
        is_phone_verified, password_hash, role, status, profile_name,
        profile_description, contact_number, business_address, staff_reason,
        is_archived, created_at, updated_at
      )
      VALUES (?, ?, ?, 1, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        user.fullName,
        user.email,
        user.phone,
        user.createdAt,
        passwordHash,
        user.role,
        user.status,
        user.profileName,
        user.profileDescription,
        user.contactNumber,
        user.businessAddress,
        user.staffReason,
        user.createdAt,
        user.createdAt,
      ]
    );
    userIds.set(user.email, Number(result.insertId));
    increment(counts, 'users', 'inserted');
  }
  return userIds;
}

async function ensureSeedProducts(connection, products, userIds, counts) {
  const productIds = new Map();
  for (const product of products) {
    const traderId = userIds.get(product.traderEmail);
    if (!traderId) {
      throw new Error(`Missing seeded trader for product ${product.productName}.`);
    }

    const [rows] = await connection.execute(
      'SELECT id, trader_id FROM products WHERE product_name = ? LIMIT 2',
      [product.productName]
    );
    if (rows.length) {
      if (rows.length !== 1 || Number(rows[0].trader_id) !== traderId) {
        throw new Error(`Product seed conflict for "${product.productName}"; no existing product was changed.`);
      }
      productIds.set(product.productName, Number(rows[0].id));
      increment(counts, 'products', 'skipped');
      continue;
    }

    const [result] = await connection.execute(
      `INSERT INTO products (
        trader_id, product_name, size, length_cm, unit_price,
        stock_quantity, low_stock_threshold, reserved_quantity,
        product_image_path, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 50, 0, NULL, ?, ?)`,
      [
        traderId,
        product.productName,
        product.size,
        product.lengthCm,
        product.productPrice,
        product.stockQuantity,
        product.createdAt,
        product.createdAt,
      ]
    );
    productIds.set(product.productName, Number(result.insertId));
    increment(counts, 'products', 'inserted');
  }
  return productIds;
}

async function ensureSeedOrders(connection, orders, userIds, productIds, counts) {
  for (const order of orders) {
    const buyerId = userIds.get(order.buyerEmail);
    const traderId = userIds.get(order.traderEmail);
    const productId = productIds.get(order.productName);
    if (!buyerId || !traderId || !productId) {
      throw new Error(`Missing seeded relationship for order ${order.marker}.`);
    }

    const [existingOrders] = await connection.execute(
      'SELECT id, buyer_id FROM orders WHERE delivery_notes = ? LIMIT 2',
      [order.marker]
    );
    if (existingOrders.length) {
      if (existingOrders.length !== 1 || Number(existingOrders[0].buyer_id) !== buyerId) {
        throw new Error(`Order seed conflict for ${order.marker}; no existing order was changed.`);
      }
      const [existingItems] = await connection.execute(
        'SELECT product_id, trader_id, quantity FROM order_items WHERE order_id = ?',
        [existingOrders[0].id]
      );
      if (
        existingItems.length !== 1
        || Number(existingItems[0].product_id) !== productId
        || Number(existingItems[0].trader_id) !== traderId
        || Number(existingItems[0].quantity) !== order.quantity
      ) {
        throw new Error(`Order items are inconsistent for ${order.marker}; no existing order was changed.`);
      }
      increment(counts, 'orders', 'skipped');
      continue;
    }

    const address = order.deliveryAddress;
    const deliveryAddress = fullAddress(address);
    const [result] = await connection.execute(
      `INSERT INTO orders (
        buyer_id, status, dispatch_date, customer_full_name,
        customer_contact_number, delivery_region, delivery_province,
        delivery_city, delivery_barangay, delivery_street_address,
        delivery_full_address, payment_method, payment_status,
        delivery_notes, cancellation_reason, buyer_rating, buyer_review,
        buyer_rated_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        buyerId,
        order.status,
        order.dispatchDate,
        order.buyerName,
        order.buyerPhone,
        address.region,
        address.province,
        address.city,
        address.barangay,
        address.street,
        deliveryAddress,
        order.paymentMethod,
        order.paymentStatus,
        order.marker,
        order.cancellationReason,
        order.buyerRating,
        order.buyerReview,
        order.buyerRating ? order.createdAt : null,
        order.createdAt,
        order.createdAt,
      ]
    );

    await connection.execute(
      `INSERT INTO order_items (
        order_id, product_id, trader_id, product_name, size, length_cm,
        unit_price, quantity, line_total, product_image_path, created_at
      )
      SELECT ?, p.id, p.trader_id, p.product_name, p.size, p.length_cm,
        ?, ?, ?, NULL, ?
      FROM products p
      WHERE p.id = ? AND p.trader_id = ?`,
      [
        result.insertId,
        order.unitPrice,
        order.quantity,
        order.lineTotal,
        order.createdAt,
        productId,
        traderId,
      ]
    );
    increment(counts, 'orders', 'inserted');
  }
}

async function ensureSeedPermits(connection, permits, userIds, adminId, counts) {
  for (const permit of permits) {
    const traderId = userIds.get(permit.traderEmail);
    if (!traderId) {
      throw new Error(`Missing seeded trader for permit sample ${permit.title}.`);
    }

    const [rows] = await connection.execute(
      'SELECT id, trader_id, paper_type FROM paper_uploads WHERE title = ? LIMIT 2',
      [permit.title]
    );
    if (rows.length) {
      if (
        rows.length !== 1
        || Number(rows[0].trader_id) !== traderId
        || rows[0].paper_type !== 'to_cut'
      ) {
        throw new Error(`Paper-upload seed conflict for "${permit.title}"; no existing row was changed.`);
      }
      increment(counts, 'permits', 'skipped');
      continue;
    }

    const isPending = permit.status === 'pending';
    await connection.execute(
      `INSERT INTO paper_uploads (
        trader_id, paper_type, title, description, file_path,
        original_file_name, mime_type, file_size, status, review_notes,
        reviewed_by, reviewed_at, created_at, updated_at
      )
      VALUES (?, 'to_cut', ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
      [
        traderId,
        permit.title,
        permit.description,
        permit.filePath,
        permit.originalFileName,
        permit.status,
        isPending ? null : `${DEMO_SEED_MARKER}: DEMO SAMPLE review; not an official decision.`,
        isPending ? null : adminId,
        isPending ? null : permit.reviewedAt,
        permit.createdAt,
        permit.createdAt,
      ]
    );
    increment(counts, 'permits', 'inserted');
  }
}

async function ensureSeedProduction(connection, batches, userIds, counts) {
  for (const batch of batches) {
    const ownerId = userIds.get(batch.ownerEmail);
    if (!ownerId) {
      throw new Error(`Missing seeded trader for production batch ${batch.marker}.`);
    }

    const [rows] = await connection.execute(
      'SELECT id, owner_id FROM tree_production_batches WHERE notes LIKE ? LIMIT 2',
      [`${batch.marker}%`]
    );
    if (rows.length) {
      if (rows.length !== 1 || Number(rows[0].owner_id) !== ownerId) {
        throw new Error(`Production seed conflict for ${batch.marker}; no existing batch was changed.`);
      }
      increment(counts, 'productionBatches', 'skipped');
      continue;
    }

    await connection.execute(
      `INSERT INTO tree_production_batches (
        owner_id, tree_name, total_units, cut_units, production_date,
        expected_cut_date, status, notes, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        batch.treeName,
        batch.totalUnits,
        batch.cutUnits,
        batch.productionDate,
        batch.expectedCutDate,
        batch.status,
        batch.notes,
        `${batch.productionDate} 12:00:00`,
        `${batch.productionDate} 12:00:00`,
      ]
    );
    increment(counts, 'productionBatches', 'inserted');
  }
}

async function ensureMonthlyPrices(connection, monthlyPrices, productIds, counts) {
  for (const price of monthlyPrices) {
    const productId = productIds.get(price.productName);
    if (!productId) {
      throw new Error(`Missing seeded product for monthly price ${price.productName}.`);
    }

    const [rows] = await connection.execute(
      'SELECT id FROM product_monthly_prices WHERE product_id = ? AND effective_month = ? LIMIT 1',
      [productId, price.effectiveMonth]
    );
    if (rows.length) {
      increment(counts, 'monthlyPrices', 'skipped');
      continue;
    }

    await connection.execute(
      'INSERT INTO product_monthly_prices (product_id, effective_month, unit_price) VALUES (?, ?, ?)',
      [productId, price.effectiveMonth, price.unitPrice]
    );
    increment(counts, 'monthlyPrices', 'inserted');
  }
}

async function verifySeedCounts(connection, data) {
  const checks = [
    ['users', `SELECT COUNT(*) AS count FROM users WHERE staff_reason LIKE ?`, [`${DEMO_SEED_MARKER}:USER:%`], data.users.length],
    ['products', 'SELECT COUNT(*) AS count FROM products WHERE product_name LIKE ?', [`${PRODUCT_PREFIX}%`], data.products.length],
    ['orders', 'SELECT COUNT(*) AS count FROM orders WHERE delivery_notes LIKE ?', [`${ORDER_PREFIX}%`], data.orders.length],
    ['permits', 'SELECT COUNT(*) AS count FROM paper_uploads WHERE title LIKE ?', [`${PAPER_PREFIX}%`], data.permits.length],
    ['productionBatches', 'SELECT COUNT(*) AS count FROM tree_production_batches WHERE notes LIKE ?', [`${PRODUCTION_PREFIX}%`], data.productionBatches.length],
    [
      'monthlyPrices',
      `SELECT COUNT(*) AS count
       FROM product_monthly_prices mp
       INNER JOIN products p ON p.id = mp.product_id
       WHERE p.product_name LIKE ?`,
      [`${PRODUCT_PREFIX}%`],
      data.monthlyPrices.length,
    ],
  ];

  for (const [category, query, values, minimum] of checks) {
    const [rows] = await connection.execute(query, values);
    if (Number(rows[0].count) < minimum) {
      throw new Error(`Post-seed validation failed for ${category}: expected at least ${minimum}, found ${rows[0].count}.`);
    }
  }
}

function printCounts(counts) {
  for (const [category, result] of Object.entries(counts)) {
    console.log(
      `${category}: inserted=${result.inserted}, skipped=${result.skipped}, failed=${result.failed}`
    );
  }
}

export async function runDemoSeed({ databasePool = pool, env = process.env, now = new Date() } = {}) {
  const config = createMysqlConfig(env);
  const password = resolveSeedPassword(env, config.baseConfig.host);
  const data = createDemoData(now);
  const counts = createCounts(data);
  const connection = await databasePool.getConnection();
  let lockAcquired = false;
  let transactionStarted = false;
  let currentCategory = '';

  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [LOCK_NAME]);
    if (Number(lockRows[0]?.acquired) !== 1) {
      throw new Error('Another CocoLytics demo seeder is running; retry after it finishes.');
    }
    lockAcquired = true;

    await connection.beginTransaction();
    transactionStarted = true;

    currentCategory = 'users';
    const userIds = await ensureSeedUsers(connection, data.users, password, counts);

    currentCategory = 'products';
    const productIds = await ensureSeedProducts(connection, data.products, userIds, counts);

    currentCategory = 'orders';
    const [adminRows] = await connection.execute(
      "SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1"
    );
    if (!adminRows.length) {
      throw new Error('No existing admin account found; refusing to create reviewed sample permits without an existing reviewer.');
    }
    await ensureSeedOrders(connection, data.orders, userIds, productIds, counts);

    currentCategory = 'permits';
    const adminId = Number(adminRows[0].id);
    await ensureSeedPermits(connection, data.permits, userIds, adminId, counts);

    currentCategory = 'productionBatches';
    await ensureSeedProduction(connection, data.productionBatches, userIds, counts);

    currentCategory = 'monthlyPrices';
    await ensureMonthlyPrices(connection, data.monthlyPrices, productIds, counts);

    await verifySeedCounts(connection, data);
    await connection.commit();
    transactionStarted = false;

    console.log('CocoLytics demo data seeding completed. Existing user accounts and business rows were not updated or deleted.');
    printCounts(counts);
    console.log('notifications: unsupported by the current schema; no rows inserted.');
    console.log('activityLogs: unsupported by the current schema; no rows inserted.');
    console.log('Permit status "expired" is unsupported by the existing paper_uploads enum; only pending, approved, and rejected samples were created.');
    return counts;
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    if (currentCategory && counts[currentCategory]) {
      counts[currentCategory].failed += 1;
    }
    for (const result of Object.values(counts)) {
      result.failed += result.inserted;
      result.inserted = 0;
    }
    console.error('Demo seed transaction rolled back; no new rows from this run were committed.');
    printCounts(counts);
    throw error;
  } finally {
    if (lockAcquired) {
      await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
    }
    connection.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await runDemoSeed();
  } catch (error) {
    console.error(`Demo data seeding failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
