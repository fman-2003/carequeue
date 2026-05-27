import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in .env.local");
}

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  clinicId?: string;
}

// Sign to create new token with payload details
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as jwt.Secret, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Verify token and return payload if valid
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
