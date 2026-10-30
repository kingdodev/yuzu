import type { NextConfig } from "next";

/**
 * Beveiligingsheaders voor elke pagina:
 * - niet in een frame van een andere site te laden (tegen clickjacking);
 * - formulieren en <base> alleen naar Yuzu zelf, geen plug-ins;
 * - browser raadt geen bestandstypes, alleen https, geen camera/microfoon.
 * Bijlagen (/bijlagen/...) zetten hun eigen, strengere CSP.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
const PAGE_CSP =
  "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  // PGlite (lokale demodatabase) laadt WebAssembly; niet bundelen.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migraties worden bij het opstarten van de demodatabase gelezen; meenemen in de serverbundel.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*", "./src/db/seed/files/**/*"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      {
        source: "/((?!bijlagen/).*)",
        headers: [{ key: "Content-Security-Policy", value: PAGE_CSP }],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/", destination: "/inbox/open", permanent: false },
      { source: "/inbox", destination: "/inbox/open", permanent: false },
      { source: "/beheer", destination: "/beheer/shops", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
