"use client";

/**
 * Client-side session access.
 *
 * The JWT used to live in localStorage and was attached to every request
 * as a Bearer header. Any script running on the page could read it —
 * injected markup, a compromised npm package, a browser extension — and
 * walk away with a token carrying the user's role until it expired.
 *
 * The token is now an httpOnly cookie that the browser attaches to
 * same-origin requests on its own, and that JavaScript cannot read. There
 * is deliberately no getToken() any more: nothing on the client should be
 * able to reach it.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  clinicId: string | null;
}

/**
 * A copy of the display fields, kept only so components can render the
 * right nav and labels without each one issuing its own request.
 *
 * This is a UI hint and nothing more. It is user-writable, so it is never
 * a permission check — the server re-derives role and clinic from the
 * signed cookie on every request. Editing it by hand reveals a menu item
 * and no data behind it.
 */
const HINT_KEY = "cq_session_hint";

export function cacheSessionHint(user: SessionUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      window.localStorage.setItem(
        HINT_KEY,
        JSON.stringify({
          id: user.id,
          name: user.name,
          role: user.role,
          clinicId: user.clinicId,
        }),
      );
    } else {
      window.localStorage.removeItem(HINT_KEY);
    }
  } catch {
    // Private browsing or a full quota — the UI falls back to fetching.
  }
}

function readHint(): {
  id?: string;
  name?: string;
  role?: string;
  clinicId?: string | null;
} {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HINT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Display role for the UI. Never used to decide what data to show. */
export function getRole(): string {
  return readHint().role ?? "";
}

/** Display name for the UI. */
export function getName(): string {
  return readHint().name ?? "";
}

/**
 * The signed-in user's own id, used to prefill "book for myself" forms.
 * Requests that act on a user derive the id from the session cookie
 * server-side; this value is only a convenience for the form.
 */
export function getUserId(): string {
  return readHint().id ?? "";
}

/** Generic accessor for the components that read fields by name. */
export function getSessionField(field: string): string {
  const hint = readHint() as Record<string, unknown>;
  const value = hint[field];
  return typeof value === "string" ? value : "";
}

/**
 * The clinic the user belongs to, used to decide whether to prompt them
 * to pick one. Requests do not send it — the server reads clinicId from
 * the session cookie.
 */
export function getClinicId(): string | null {
  return readHint().clinicId ?? null;
}

/**
 * Asks the server who the current user is. This is the authoritative
 * check: the dashboard previously base64-decoded the JWT in the browser
 * and trusted whatever `role` it found there, an unverified value from an
 * unverified token.
 */
export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/session", {
      // Same-origin requests send the cookie by default; stated
      // explicitly so it survives any future refactor of this call.
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!res.ok) {
      cacheSessionHint(null);
      return null;
    }

    const data = await res.json();
    const user = (data.user as SessionUser) ?? null;
    cacheSessionHint(user);
    return user;
  } catch {
    return null;
  }
}

/** Clears the session cookie server-side and drops the local UI hint. */
export async function logout(): Promise<void> {
  cacheSessionHint(null);
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    // Ignore transport failures — the caller redirects to /login either
    // way, and the cookie expires on its own.
  }
}
