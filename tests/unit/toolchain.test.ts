import { describe, expect, it } from "vitest";

import { APP_ENVIRONMENT, APP_VERSION } from "@/lib/app-version";

/**
 * Smoke test for the toolchain itself: confirms Vitest runs, TypeScript
 * compiles under test, and the `@/*` path alias resolves.
 */
describe("toolchain", () => {
  it("runs tests", () => {
    expect(true).toBe(true);
  });

  it("resolves the @/* path alias", () => {
    expect(APP_VERSION).toBeTypeOf("string");
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });

  it("defaults the environment when none is injected", () => {
    expect(APP_ENVIRONMENT).toBeTypeOf("string");
  });
});
