process.env.DATABASE_URL ??= 'postgres://postgres@127.0.0.1:55432/gi_compass';
process.env.SESSION_SECRET ??= 'test-session-secret-value-at-least-32-chars';
process.env.FIELD_ENCRYPTION_KEY ??= 'test-field-encryption-key-at-least-32-chars';
process.env.NODE_ENV ??= 'test';
process.env.LOCAL_STORAGE_ROOT ??= '/var/tmp/gi-compass-test-storage';
process.env.APP_BASE_URL ??= 'http://localhost:3000';
