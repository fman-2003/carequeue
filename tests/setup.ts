/**
 * Test environment bootstrap.
 *
 * lib/auth/jwt.ts refuses to load without a strong JWT_SECRET — that
 * check is deliberate, so the suite supplies a throwaway one rather than
 * weakening it. These values are fixtures and never touch a real
 * deployment.
 */
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "test-only-secret-value-at-least-32-chars-long";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1d";
process.env.MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/carequeue-test";
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "AC-test";
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "test-token";
process.env.TWILIO_WHATSAPP_FROM =
  process.env.TWILIO_WHATSAPP_FROM ?? "+10000000000";
