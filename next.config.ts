import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: false,
  // PGlite (lokale demodatabase) laadt WebAssembly; niet bundelen.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migraties worden bij het opstarten van de demodatabase gelezen; meenemen in de serverbundel.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*", "./src/db/seed/files/**/*"],
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
