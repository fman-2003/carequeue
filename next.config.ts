import type { NextConfig } from "next";

// The Cloudinary account is the only remote image host, and its cloud name
// scopes the delivery path. Falls back to the whole host if the variable is
// missing, so a misconfigured environment fails at upload rather than here.
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.16"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        // Public avatar delivery only. `search` is deliberately left open:
        // the profile page appends a ?t= cache-buster after each upload.
        pathname: cloudName ? `/${cloudName}/image/upload/**` : "/**",
      },
    ],
  },

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
