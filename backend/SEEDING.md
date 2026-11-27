# CocoLytics demo data seeder

The seeder uses the existing MySQL tables and does not run migrations or modify the schema. It adds 60 demo users (40 traders and 20 clients), 50 products, 100 orders with order items, 50 `to_cut` paper-upload samples, 50 production batches, and 48 monthly price records. It uses the supported `admin`, `client`, and `trader` role structure; it does not create an additional admin or staff account.

All records are marked as demo/sample data. The seeder only inserts missing records. Existing rows—including matching demo accounts whose password or profile was subsequently changed—are left untouched. A MySQL advisory lock prevents concurrent runs, and the inserts run in one transaction. If a seed marker conflicts with an unrelated row or validation fails, the transaction is rolled back.

## Local development

From `backend/`, run:

```sh
npm run seed
```

For newly inserted local accounts, the development-only default password is `CocoLyticsDemo2026!`. Demo emails follow `demo.user001@example.test` through `demo.user060@example.test`; the first 40 are traders and the last 20 are clients. The `.test` email domain is reserved for testing and cannot receive email. Accounts are marked email-verified so local login can be tested without OTP delivery.

The default password is only enabled when `NODE_ENV` is not `production` and the configured MySQL host is loopback. Rerunning the seed does not reset a demo user's password.

## Dokploy or another remote database

Do not run the seeder against a production database unless you intentionally want demo users and records included in live counts, sales, paper queues, and reports. The seeder blocks remote hosts by default; production also requires a one-off opt-in and a separate strong password. Supply these only to the one-off backend command, not in source control:

```sh
DEMO_SEED_ALLOW_REMOTE=true DEMO_SEED_ALLOW_PRODUCTION=true DEMO_SEED_PASSWORD='replace-with-a-unique-strong-password-16-chars-or-longer' npm run seed
```

Run this command from the backend working directory in the Dokploy backend container/console after confirming its existing `DB_*` environment targets the intended database and taking a database backup. Do not add these opt-in values to the permanent deployment environment. The seeder never creates a database, runs migrations, drops tables, truncates tables, or imports SQL dumps.

The backend connection still comes from its existing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` configuration; the seeder does not change those values.

## Schema limitations

- Products store a size class and `length_cm`, but not separate width, thickness, or unit columns. Sample dimensions are included in the product name; inventory quantities/prices remain in existing product columns.
- Production batches reference a trader, not a product. Their notes identify a related sample product, but no product foreign key is invented.
- Permit samples use existing `paper_uploads` rows with `paper_type='to_cut'`. The table has no permit-number, issue-date, expiry-date, or `expired` status columns. Those details are identified in the sample title/description, and only the existing `pending`, `approved`, and `rejected` statuses are used. Placeholder paths are not backed by files; no fake government documents are created.
- The current schema has no notification or activity-log table/API. The seeder reports these as unsupported instead of creating parallel tables or putting notifications into unrelated chat data.

## Verification

Run focused seeder tests with:

```sh
node --test src/seedDemoData.test.js
```

The seeder prints inserted, skipped, and failed counts for each supported record type and validates the demo-record minimums and foreign-key-backed insert relationships before committing.
