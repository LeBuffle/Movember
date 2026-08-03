import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Produces a self-contained server bundle in `.next/standalone`, so the
   * runtime image only needs Node and the traced dependencies instead of the
   * whole `node_modules`. Keeps the image small enough to pull quickly on a
   * modest VPS.
   */
  output: "standalone",

  /**
   * Security headers are set by Caddy in front of the app (deploy/Caddyfile),
   * which is the single place they belong: setting them in both would make it
   * ambiguous which one actually applies. This one is the exception — it must
   * follow the response even if the reverse proxy is bypassed.
   */
  poweredByHeader: false,
};

export default nextConfig;
