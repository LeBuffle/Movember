import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

/**
 * The health endpoint is consumed by the Docker healthcheck (story 1.2), the
 * deployment pipeline (stories 1.3 and 1.4) and the uptime monitor
 * (story 1.11). A silent change to its shape would break deployments without
 * breaking any page, so it is pinned by tests from the start.
 */
describe("GET /api/health", () => {
  it("returns a 200 response", () => {
    const response = GET();

    expect(response.status).toBe(200);
  });

  it("reports status, version and timestamp", async () => {
    const response = GET();
    const body = await response.json();

    expect(body.status).toBe("ok");
    expect(body.version).toBeTypeOf("string");
    expect(body.environment).toBeTypeOf("string");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it("is never cached", () => {
    const response = GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
