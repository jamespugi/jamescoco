import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDemoData,
  resolveSeedPassword,
} from './seedDemoData.js';

const fixedNow = new Date('2026-11-27T12:00:00.000Z');

test('builds the requested sample counts using only supported roles', () => {
  const data = createDemoData(fixedNow);

  assert.equal(data.users.length, 60);
  assert.equal(data.users.filter((user) => user.role === 'trader').length, 40);
  assert.equal(data.users.filter((user) => user.role === 'client').length, 20);
  assert.equal(data.users.some((user) => user.role === 'admin' || user.role === 'staff'), false);
  assert.equal(new Set(data.users.map((user) => user.email)).size, 60);
  assert.equal(new Set(data.users.map((user) => user.phone)).size, 60);
  assert.ok(data.users.every((user) => /^\+639\d{9}$/.test(user.phone)));
  assert.ok(data.users.some((user) => user.businessAddress.includes('Oriental Mindoro')));
  assert.ok(data.users.some((user) => user.businessAddress.includes('Occidental Mindoro')));
  assert.equal(data.products.length, 50);
  assert.equal(data.orders.length, 100);
  assert.equal(data.permits.length, 50);
  assert.equal(data.productionBatches.length, 50);
  assert.equal(data.monthlyPrices.length, 48);
});

test('all generated business records reference seeded traders, clients, or products', () => {
  const data = createDemoData(fixedNow);
  const usersByEmail = new Map(data.users.map((user) => [user.email, user]));
  const productsByName = new Map(data.products.map((product) => [product.productName, product]));

  for (const product of data.products) {
    assert.equal(usersByEmail.get(product.traderEmail)?.role, 'trader');
    assert.ok(product.productName.includes('in x'));
    assert.ok(product.lengthCm > 0);
    assert.ok(product.productPrice > 0);
    assert.ok(product.stockQuantity > 0);
  }

  for (const order of data.orders) {
    assert.equal(usersByEmail.get(order.buyerEmail)?.role, 'client');
    assert.equal(productsByName.get(order.productName)?.traderEmail, order.traderEmail);
    assert.ok(order.lineTotal > 0);
    assert.ok(order.createdAt >= usersByEmail.get(order.buyerEmail).createdAt);
    assert.ok(['pending', 'to_ship', 'to_receive', 'completed', 'cancelled'].includes(order.status));
  }

  for (const batch of data.productionBatches) {
    assert.equal(usersByEmail.get(batch.ownerEmail)?.role, 'trader');
    assert.ok(productsByName.has(batch.relatedProductName));
    assert.ok(batch.totalUnits > 0);
    assert.ok(batch.cutUnits <= batch.totalUnits);
    assert.ok(batch.notes.startsWith(batch.marker));
  }

  for (const price of data.monthlyPrices) {
    assert.ok(productsByName.has(price.productName));
    assert.match(price.effectiveMonth, /^\d{4}-\d{2}-01$/);
  }

  assert.ok(new Set(data.orders.map((order) => order.createdAt.slice(0, 7))).size >= 12);
  const pricesByProduct = new Map();
  for (const price of data.monthlyPrices) {
    const history = pricesByProduct.get(price.productName) || [];
    history.push(price);
    pricesByProduct.set(price.productName, history);
  }
  const changes = [...pricesByProduct.values()].flatMap((history) => {
    history.sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
    return history.slice(1).map((price, index) => price.unitPrice - history[index].unitPrice);
  });
  assert.ok(changes.some((change) => change > 0));
  assert.ok(changes.some((change) => change < 0));
});

test('permit samples use existing statuses and explicit no-document placeholders', () => {
  const data = createDemoData(fixedNow);

  assert.deepEqual(
    [...new Set(data.permits.map((permit) => permit.status))].sort(),
    ['approved', 'pending', 'rejected']
  );
  assert.ok(data.permits.every((permit) => permit.title.startsWith('DEMO SAMPLE')));
  assert.ok(data.permits.every((permit) => permit.filePath.includes('no-document-attached')));
  assert.ok(data.permits.every((permit) => permit.description.includes('not a government-issued permit')));
});

test('uses the documented default only for local development and guards remote production', () => {
  assert.equal(
    resolveSeedPassword({ NODE_ENV: 'development' }, 'localhost'),
    'CocoLyticsDemo2026!'
  );
  assert.throws(
    () => resolveSeedPassword({ NODE_ENV: 'production' }, 'mysql.internal'),
    /Remote database seeding is blocked/
  );
  assert.throws(
    () => resolveSeedPassword({
      NODE_ENV: 'production',
      DEMO_SEED_ALLOW_REMOTE: 'true',
    }, 'mysql.internal'),
    /Production seeding is blocked/
  );
  assert.throws(
    () => resolveSeedPassword({
      NODE_ENV: 'production',
      DEMO_SEED_ALLOW_REMOTE: 'true',
      DEMO_SEED_ALLOW_PRODUCTION: 'true',
    }, 'mysql.internal'),
    /DEMO_SEED_PASSWORD/
  );
  assert.equal(
    resolveSeedPassword({
      NODE_ENV: 'production',
      DEMO_SEED_ALLOW_REMOTE: 'true',
      DEMO_SEED_ALLOW_PRODUCTION: 'true',
      DEMO_SEED_PASSWORD: 'A-Strong-Temporary-Password-2026',
    }, 'mysql.internal'),
    'A-Strong-Temporary-Password-2026'
  );
});
