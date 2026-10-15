---
name: mongo-integration-testing
description: How integration tests run against a real MongoDB here.
---
- The base server URI comes from `TEST_MONGODB_URI` or `MONGODB_URI` and must not name a database. `createTestDatabase()` parses it, generates `auth_test_<12 hex>`, refuses non-local hosts unless `ALLOW_REMOTE_TEST_DB=true`, and `drop()` re-verifies the name before dropping.
- `createTestApp()` forbids overriding `MONGODB_URI`; users and sessions share the generated database. Always clean up in `finally`.
- Build the app with `createTestApp()` (AppModule + configureApp). Override CLOCK to test expiry, never sleep.
- Send an `Origin` header on unsafe requests or the CSRF guard returns 403.
