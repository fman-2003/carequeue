import { NextRequest, NextResponse } from "next/server";

/**
 * Security headers.
 *
 * In Next 16 the `middleware` file convention is deprecated in favour of
 * `proxy`, which runs on the Node.js runtime by default. This runs before
 * every route and is the one place that can guarantee the whole app —
 * pages, API responses, and error pages alike — ships the same baseline
 * headers.
 *
 * Note the guidance in the Next docs: proxy is *not* the place to enforce
 * authorization. Route handlers each authenticate independently
 * (lib/auth/middleware.ts); a matcher change here must never be able to
 * open a route up.
 */

const isProduction = process.env.NODE_ENV === "production";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",

    // 'strict-dynamic' means: trust scripts this nonce loaded, and ignore
    // host allowlists. Next.js stamps the nonce onto its own bundles by
    // reading it back off the request header set below.
    // React's dev build needs eval for its error overlay; production does not.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,

    // MUI/Emotion inject their stylesheets at runtime through the CSSOM,
    // which needs 'unsafe-inline' here. Inline *styles* cannot execute
    // script — script-src above is what actually blocks XSS.
    "style-src 'self' 'unsafe-inline'",

    // Patient documents and avatars are served from Cloudinary.
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.cloudinary.com",
    "media-src 'self' https://res.cloudinary.com",

    // Patient documents (PDFs) open in their own tab, never framed in.
    "object-src 'none'",

    // Stops an injected <base> tag from re-pointing every relative URL.
    "base-uri 'self'",

    // Stops an injected form from posting credentials off-site.
    "form-action 'self'",

    // Clickjacking: nothing may frame this app. Covers the legacy
    // X-Frame-Options header for modern browsers.
    "frame-ancestors 'none'",
    "frame-src 'none'",

    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function applyBaselineHeaders(headers: Headers) {
  // Blocks MIME sniffing — an uploaded file that a browser decides to
  // treat as HTML becomes stored XSS.
  headers.set("X-Content-Type-Options", "nosniff");

  // Legacy clickjacking header for browsers without frame-ancestors.
  headers.set("X-Frame-Options", "DENY");

  // Keeps patient record ids and query strings out of the Referer header
  // sent to third parties.
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Hardware and identity APIs this app never uses.
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );

  // Isolates the browsing context from cross-origin popups/embeds.
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  // Do not advertise the framework version.
  headers.delete("X-Powered-By");

  if (isProduction) {
    // Two years, subdomains included, preload-eligible. Only meaningful
    // over TLS, so it is not set in development.
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  const requestHeaders = new Headers(request.headers);

  // A client must never be able to forge the nonce Next.js will trust.
  requestHeaders.delete("x-nonce");

  let response: NextResponse;

  if (isApiRoute) {
    response = NextResponse.next();

    // JSON APIs render nothing, so they get the most restrictive policy.
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );

    // API responses carry patient data; keep them out of shared caches.
    response.headers.set("Cache-Control", "no-store, private");
  } else {
    const csp = buildCsp(nonce);

    requestHeaders.set("x-nonce", nonce);
    // Next.js parses this request header to find the nonce and applies it
    // to the framework and page bundles it emits.
    requestHeaders.set("Content-Security-Policy", csp);

    response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
  }

  applyBaselineHeaders(response.headers);

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's static output and the favicon. Prefetches
     * are skipped: they render no document, so they need no nonce.
     */
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
