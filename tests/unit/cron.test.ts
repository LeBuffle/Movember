import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/ping/route";
import { isAuthorisedCronRequest } from "@/lib/cron/auth";

const SECRET = "un-secret-de-trente-deux-caracteres";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

const requestWith = (headers: Record<string, string> = {}) =>
  new Request("https://exemple.test/api/cron/ping", { headers });

afterEach(() => {
  vi.unstubAllEnvs();
});

/* =========================================================================
 * Les routes planifiées sont sur l'internet ouvert
 *
 * Le cron du VPS les appelle par HTTPS, comme n'importe qui pourrait le
 * faire. À partir de l'epic 4 elles distribuent les défis du jour et tirent
 * les cartes : ce secret partagé est tout ce qui les sépare du public.
 * ====================================================================== */

describe("authentification des tâches planifiées", () => {
  it("accepte l’en-tête dédié", () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    expect(
      isAuthorisedCronRequest(requestWith({ "x-cron-secret": SECRET })),
    ).toBe(true);
  });

  it("accepte aussi la forme Bearer", () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    expect(
      isAuthorisedCronRequest(
        requestWith({ authorization: `Bearer ${SECRET}` }),
      ),
    ).toBe(true);
  });

  it("refuse sans secret", () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    expect(isAuthorisedCronRequest(requestWith())).toBe(false);
  });

  it("refuse un secret faux, même très proche", () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    expect(
      isAuthorisedCronRequest({
        headers: new Headers({ "x-cron-secret": SECRET.slice(0, -1) + "X" }),
      } as Request),
    ).toBe(false);
  });

  it("refuse quand le secret n’est pas configuré", () => {
    // Le cas dangereux : une variable oubliée laisserait la route ouverte à
    // tout le monde. La seule réponse sûre est non.
    vi.stubEnv("CRON_SECRET", "");

    expect(isAuthorisedCronRequest(requestWith({ "x-cron-secret": "" }))).toBe(
      false,
    );
    expect(
      isAuthorisedCronRequest(requestWith({ "x-cron-secret": "peu importe" })),
    ).toBe(false);
  });

  it("refuse un secret trop court pour être sérieux", () => {
    vi.stubEnv("CRON_SECRET", "court");

    expect(
      isAuthorisedCronRequest(requestWith({ "x-cron-secret": "court" })),
    ).toBe(false);
  });

  it("compare en temps constant", () => {
    // Un `===` s'arrête au premier caractère différent, et le temps qu'il met
    // révèle combien du secret a été deviné. En le nourrissant caractère par
    // caractère, on le reconstitue entièrement.
    const source = read("src/lib/cron/auth.ts");

    expect(source).toMatch(/timingSafeEqual/);
    expect(source).not.toMatch(/provided\s*===\s*expected/);
  });

  it("ne lit jamais le secret dans l’adresse", () => {
    // Une chaîne de requête finit dans tous les journaux d'accès du chemin.
    const source = read("src/lib/cron/auth.ts");

    expect(source).not.toMatch(/searchParams|nextUrl/);
  });
});

describe("GET /api/cron/ping", () => {
  it("refuse un appel sans secret, sans rien dire", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    const response = await GET(requestWith());

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("répond avec la version quand le secret est bon", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);

    const response = await GET(requestWith({ "x-cron-secret": SECRET }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.task).toBe("ping");
    // La version sert à vérifier que le cron parle bien à l'instance qu'on
    // croit — production et préproduction tournent sur la même machine.
    expect(body.version).toBeTypeOf("string");
    expect(body.environment).toBeTypeOf("string");
  });
});

describe("le fichier crontab versionné", () => {
  const crontab = read("deploy/crontab");

  it("porte la surveillance des ressources", () => {
    // Sans cela, l'installation du crontab par le script de déploiement
    // effacerait la ligne ajoutée à la main par le runbook §11.
    expect(crontab).toMatch(/check-resources\.sh/);
  });

  it("appelle la route de vérification avec le secret en en-tête", () => {
    expect(crontab).toMatch(/api\/cron\/ping/);
    expect(crontab).toMatch(/x-cron-secret/i);
    // Jamais dans l'adresse.
    expect(crontab).not.toMatch(/ping\?.*secret/i);
  });

  it("ne contient aucun secret en clair", () => {
    // Les valeurs viennent du fichier d'environnement, jamais du dépôt.
    expect(crontab).not.toMatch(/CRON_SECRET=\S/);
  });
});
