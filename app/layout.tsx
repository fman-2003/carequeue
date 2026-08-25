import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter is self-hosted rather than pulled from fonts.googleapis.com.
 *
 * next/font downloads the CSS and font files at build time and serves
 * them from this origin, so no request reaches Google from a visitor's
 * browser. Two reasons that matters here:
 *
 *  - Privacy. A third-party stylesheet request reveals every visitor's IP
 *    address and the page they are on. On a healthcare app, the page URL
 *    alone can be sensitive.
 *  - CSP. Self-hosting lets style-src and font-src stay at 'self' instead
 *    of allowlisting external hosts.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CareQueue",
  description: "Healthcare appointment scheduling platform",
};

/**
 * Required by the nonce-based Content-Security-Policy in proxy.ts.
 *
 * Next.js stamps the per-request nonce onto its script tags while
 * server-rendering. A statically prerendered page is built once, before
 * any request exists, so its scripts carry no nonce — and a strict
 * script-src would block every one of them at runtime.
 *
 * Every page here is either behind authentication or renders a client
 * component that fetches on mount, so none of them gained much from being
 * prerendered.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
