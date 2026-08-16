import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  /*
   * `tsconfig.json` sets `jsx: preserve`, because Next does the transform
   * itself. The test runner has no such step, so a `.tsx` test would reach
   * the parser with JSX still in it. Told here rather than in the tsconfig:
   * changing the tsconfig would change what Next builds.
   */
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["src/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      /*
       * `server-only` throws the moment it is imported outside a server
       * component, which is exactly what happens when a test imports a
       * server module directly. Pointing it at its own empty entry — the one
       * the React server bundler uses — makes those modules testable.
       *
       * This does not weaken the guard: what `server-only` protects against
       * is a CLIENT component importing a server module, and that is caught
       * by the Next build, not by the test runner. Story 1.6 relies on it to
       * keep the Supabase service key out of the browser, and that still
       * holds.
       */
      "server-only": path.resolve(
        import.meta.dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
});
