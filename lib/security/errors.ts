import { NextResponse } from "next/server";

/**
 * Error responses.
 *
 * Routes used to return `err.message` straight to the caller. For a
 * thrown Error that is fine, but for a driver or library failure the
 * message carries internals — Mongo connection strings, collection and
 * field names, cast failures naming the schema. That is free
 * reconnaissance for an attacker and, on a healthcare app, it can also
 * echo record contents.
 *
 * The rule applied here: errors we raised ourselves are safe to show;
 * everything else is logged server-side and reported generically.
 */

/** An error whose message is written for the end user and safe to return. */
export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/**
 * Logs the real error with a route tag and returns a response that says
 * nothing about the internals.
 */
export function handleRouteError(
  context: string,
  error: unknown,
  fallbackStatus = 500,
): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(`[${context}]`, error);

  return NextResponse.json({ error: GENERIC_MESSAGE }, { status: fallbackStatus });
}

/**
 * For services that still signal expected, user-facing failures with a
 * plain `throw new Error("...")`. Those messages are author-written and
 * safe; anything that is not an Error instance is not.
 */
export function handleServiceError(
  context: string,
  error: unknown,
  status = 400,
): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error && isSafeMessage(error)) {
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error(`[${context}]`, error);
  return NextResponse.json({ error: GENERIC_MESSAGE }, { status: 500 });
}

/**
 * Filters out messages produced by the database driver, the JSON parser,
 * and other internals, which tend to contain schema or infrastructure
 * detail.
 */
function isSafeMessage(error: Error): boolean {
  const leaky = [
    "MongoServerError",
    "MongooseError",
    "ValidationError",
    "CastError",
    "MongoNetworkError",
    "MongoServerSelectionError",
    "SyntaxError",
    "TypeError",
    "ReferenceError",
  ];

  if (leaky.includes(error.name)) return false;

  const message = error.message ?? "";
  const fingerprints = [
    "mongodb://",
    "mongodb+srv://",
    "E11000",
    "buffering timed out",
    "Cast to ObjectId",
    "failed for model",
    "ECONNREFUSED",
    "ENOTFOUND",
    "at Object.",
  ];

  return !fingerprints.some((fingerprint) => message.includes(fingerprint));
}

/** Parses a JSON body, turning malformed input into a 400 instead of a 500. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("Invalid JSON body", 400);
  }
}
