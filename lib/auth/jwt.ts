import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

/**
 * The signing algorithm is pinned on both sides. Without this,
 * `jwt.verify` will honour whatever `alg` the *token* claims, which is
 * how "alg: none" and RS256->HS256 confusion attacks work.
 */
const ALGORITHM: jwt.Algorithm = "HS256";
const ISSUER = "carequeue";
const AUDIENCE = "carequeue-app";

/**
 * A short secret is brute-forceable offline once an attacker holds any
 * token, and every token in this app carries a role claim. Fail loudly at
 * boot rather than silently signing weak tokens.
 */
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in the environment");
}

if (JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48",
  );
}

const SECRET: jwt.Secret = JWT_SECRET;

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  clinicId?: string;
}

// Sign to create new token with payload details
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, {
    algorithm: ALGORITHM,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

// Verify token and return payload if valid. Throws on any tampering,
// expiry, or issuer/audience mismatch.
export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, SECRET, {
    algorithms: [ALGORITHM],
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as jwt.JwtPayload;

  // Defensive: never hand a half-formed session to a route handler.
  if (
    typeof decoded.userId !== "string" ||
    typeof decoded.email !== "string" ||
    typeof decoded.role !== "string"
  ) {
    throw new Error("Malformed token payload");
  }

  return {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    clinicId:
      typeof decoded.clinicId === "string" ? decoded.clinicId : undefined,
  };
}
