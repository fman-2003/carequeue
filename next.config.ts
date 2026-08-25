import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.16"],

  // Do not advertise the framework to anyone fingerprinting the stack.
  poweredByHeader: false,

  // Belt-and-braces: proxy.ts sets the full policy per request, but these
  // are applied by next.config first (see the proxy execution order in the
  // Next docs) so they survive even if a matcher change skips the proxy.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
