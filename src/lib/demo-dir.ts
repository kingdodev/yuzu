import path from "node:path";

/**
 * Map van de demodatabase (PGlite) als er geen DATABASE_URL is. Op Vercel is
 * alleen /tmp beschrijfbaar.
 */
export function demoDataDir(): string {
  return (
    process.env.YUZU_DEMO_DIR ??
    (process.env.VERCEL ? "/tmp/yuzu-demo" : path.join(process.cwd(), ".data", "demo"))
  );
}
