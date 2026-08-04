import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/health/route";

/**
 * The health endpoint is consumed by the Docker healthcheck (story 1.2), the
 * deployment pipeline (stories 1.3 and 1.4) and the uptime monitor
 * (story 1.11). A silent change to its shape would break deployments without
 * breaking any page, so it is pinned by tests.
 */
const request = (query = "") =>
  new NextRequest(`https://exemple.test/api/health${query}`);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/health — vivacité", () => {
  it("répond 200", async () => {
    expect((await GET(request())).status).toBe(200);
  });

  it("rapporte l’état, la version et l’horodatage", async () => {
    const body = await (await GET(request())).json();

    expect(body.status).toBe("ok");
    expect(body.version).toBeTypeOf("string");
    expect(body.environment).toBeTypeOf("string");
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it("n’interroge pas la base", async () => {
    // C'est tout l'intérêt du mode par défaut. Le contrôle Docker et la
    // chaîne de déploiement l'utilisent : si une panne Supabase le faisait
    // échouer, un déploiement parfaitement bon serait annulé au profit
    // d'une version tout aussi incapable de joindre Supabase.
    const body = await (await GET(request())).json();

    expect(body.checks).toBeUndefined();
  });

  it("n’est jamais mis en cache", async () => {
    expect((await GET(request())).headers.get("Cache-Control")).toBe(
      "no-store",
    );
  });
});

describe("GET /api/health?deep=1 — état réel", () => {
  it("répond 503 quand la base n’est pas configurée", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await GET(request("?deep=1"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.database.ok).toBe(false);
    expect(body.checks.database.reason).toBe("not-configured");
  });

  describe("quand la base est injoignable", () => {
    // Une seule requête pour les trois assertions : chacune attendrait
    // sinon l'expiration du délai réseau, et l'intégration continue paierait
    // trois fois la même attente.
    async function unreachableResponse() {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://injoignable.invalid");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "cle-de-test");

      const response = await GET(request("?deep=1"));
      return { response, body: await response.json() };
    }

    it("répond 503, mesure le temps, et ne divulgue rien", async () => {
      const { response, body } = await unreachableResponse();

      // 503 dit « je ne peux pas servir », 500 dirait « je suis cassée ».
      // La distinction oriente celui qui reçoit l'alerte vers le bon
      // endroit.
      expect(response.status).toBe(503);

      expect(body.checks.database.latencyMs).toBeTypeOf("number");

      // Le point d'entrée est public : il ne doit rien apprendre sur la pile
      // technique à qui le sonde.
      expect(["not-configured", "query-failed", "unreachable"]).toContain(
        body.checks.database.reason,
      );
      expect(JSON.stringify(body)).not.toMatch(/postgres|supabase\.co|jwt/i);
    });
  });
});
