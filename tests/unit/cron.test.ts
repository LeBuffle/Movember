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

/* =========================================================================
 * Les deux environnements et leurs tâches (14 août)
 *
 * La préproduction n'avait aucune tâche planifiée : elle ne distribuait aucun
 * défi, ne renouvelait aucun jeton et ne recalculait aucun classement. **Ce
 * qui rendait la répétition générale incapable de prouver la seule chose
 * qu'elle existe pour prouver** — que le mois se déroule tout seul.
 *
 * Le danger de la correction est plus grand que le trou qu'elle bouche :
 * `crontab <fichier>` remplace tout. Deux fichiers posés séparément
 * s'effaceraient l'un l'autre, et la production perdrait ses tâches un matin
 * de novembre sans que rien ne le dise.
 * ====================================================================== */

describe("production et préproduction ne s’effacent pas l’une l’autre", () => {
  const deploy = read("deploy/scripts/deploy.sh");

  it("les deux fichiers sont posés d’un seul geste", () => {
    expect(deploy).toMatch(/cat "\$\{CRON_FILES\[@\]\}" \| crontab -/);
  });

  it("et rien n’est posé s’il en manque un", () => {
    // Poser celui qui se trouve là effacerait les tâches de l'autre
    // environnement — précisément l'accident que le geste unique évite.
    expect(deploy).toMatch(/\(\( \$\{#CRON_FILES\[@\]\} == 2 \)\)/);
    expect(deploy).toMatch(/Crontab laissé intact/);
  });

  it("le script se relance avec la version qu’il vient de récupérer", () => {
    // **La panne du 16 août, et elle était muette.** Bash lit un script au
    // fil de son exécution, depuis le fichier : après le `git checkout`, la
    // suite est relue dans un fichier qui a changé sous lui. L'installation
    // des tâches ajoutée ce jour-là n'a donc rien fait, et le déploiement a
    // été annoncé réussi — il l'était, il exécutait l'ancien script.
    expect(deploy).toMatch(
      /exec bash "\$APP_DIR\/deploy\/scripts\/deploy\.sh"/,
    );

    // Après la récupération du code, jamais avant : se relancer plus tôt
    // reprendrait la même version.
    expect(deploy.indexOf("git checkout")).toBeLessThan(
      deploy.indexOf("exec bash"),
    );
  });

  it("et il ne se relance qu’une fois", () => {
    expect(deploy).toMatch(/if \[\[ -z "\$\{DEPLOY_RELOADED:-\}" \]\]/);
    expect(deploy).toMatch(/export DEPLOY_RELOADED=1/);
  });

  it("l’installation ne dépend plus de l’environnement déployé", () => {
    // Un déploiement de préproduction doit reposer les tâches de production
    // à l'identique, sinon il les emporte.
    const block = deploy.slice(deploy.indexOf("# --- Scheduled tasks"));

    expect(block).not.toMatch(/if \[\[ "\$ENVIRONMENT" == "production" \]\]/);
  });
});

describe("les tâches de préproduction", () => {
  const staging = read("deploy/crontab.staging");
  const lines = staging
    .split("\n")
    .filter((line) => /^[0-9*]/.test(line.trim()));

  it("visent toutes la préproduction, jamais la production", () => {
    // Une seule ligne mal recopiée distribuerait les défis des vrais
    // participants une seconde fois, dix minutes après les leurs.
    for (const line of lines) {
      expect(line, line.slice(0, 60)).toContain("staging.defi-movember.fr");
      expect(line, line.slice(0, 60)).toContain(".env.staging");
      expect(line, line.slice(0, 60)).not.toContain(".env.production");
    }
  });

  it("ne sauvegardent ni ne surveillent une seconde fois", () => {
    // `backup-database.sh` sauvegarde la base nommée dans `deploy/.env`,
    // c'est-à-dire la production : la relancer écrirait le même fichier deux
    // fois par nuit. `check-resources.sh` surveille la machine, pas un
    // environnement — deux alertes pour un seul disque plein.
    expect(staging).not.toMatch(/^\s*[0-9*].*backup-database\.sh/m);
    expect(staging).not.toMatch(/^\s*[0-9*].*check-resources\.sh/m);
  });

  it("portent les trois tâches que la répétition doit prouver", () => {
    expect(staging).toMatch(/api\/cron\/defis-du-jour/);
    expect(staging).toMatch(/api\/cron\/jetons/);
    expect(staging).toMatch(/api\/cron\/classements/);
  });

  it("passent le secret en en-tête, et aucun secret n’est écrit ici", () => {
    expect(staging).toMatch(/x-cron-secret/i);
    expect(staging).not.toMatch(/CRON_SECRET=\S/);
  });

  it("ne tombent jamais à la même minute que leur équivalent de production", () => {
    // Deux tâches lourdes lancées à la même seconde se gênent sur un petit
    // VPS, et deux journaux entrelacés se lisent mal un dimanche soir.
    const schedules = (source: string) =>
      new Map(
        source
          .split("\n")
          .filter((line) => /^[0-9*]/.test(line))
          .map((line) => {
            const task = line.match(/api\/cron\/([a-z-]+)/)?.[1] ?? "";
            const when = line.split(/\s+/).slice(0, 5).join(" ");

            return [task, when] as const;
          })
          .filter(([task]) => task.length > 0),
      );

    const production = schedules(read("deploy/crontab"));
    const preproduction = schedules(staging);

    for (const [task, when] of preproduction) {
      expect(production.get(task), task).not.toBe(when);
    }
  });
});
