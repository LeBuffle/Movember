import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * La porte d'entrée de la préproduction
 *
 * Elle remplace le mot de passe HTTP de la story 1.3. Celui-ci avait une
 * conséquence que personne n'avait vue : une application ajoutée à l'écran
 * d'accueil ne partage pas le magasin de mots de passe du navigateur et n'a
 * pas de barre d'adresse pour le demander. Elle répondait 401 et s'arrêtait.
 * ====================================================================== */

const ORIGINAL = {
  env: process.env.APP_ENVIRONMENT,
  code: process.env.ACCESS_CODE,
};

beforeEach(() => {
  process.env.APP_ENVIRONMENT = "staging";
  process.env.ACCESS_CODE = "moustache2026";
});

afterEach(() => {
  for (const [key, value] of [
    ["APP_ENVIRONMENT", ORIGINAL.env],
    ["ACCESS_CODE", ORIGINAL.code],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("quand la porte existe", () => {
  it("s’applique à la préproduction", async () => {
    const { gateCode } = await import("@/lib/gate/access");

    expect(gateCode()).toBe("moustache2026");
  });

  it("ne s’applique jamais en production", async () => {
    // Sauté explicitement plutôt que de compter sur une variable non
    // renseignée : « on a oublié de l'enlever » est bien plus probable que
    // « on a oublié de la mettre ».
    process.env.APP_ENVIRONMENT = "production";

    const { gateCode } = await import("@/lib/gate/access");

    expect(gateCode()).toBe(null);
  });

  it("refuse un code trop court pour valoir quelque chose", async () => {
    process.env.ACCESS_CODE = "abc";

    const { gateCode } = await import("@/lib/gate/access");

    expect(gateCode()).toBe(null);
  });

  it("n’existe pas sans code", async () => {
    delete process.env.ACCESS_CODE;

    const { gateCode } = await import("@/lib/gate/access");

    expect(gateCode()).toBe(null);
  });
});

describe("le cookie de la porte", () => {
  it("ne contient pas le code", async () => {
    // Un cookie se lit avec l'appareil en main. Y écrire le code le donnerait
    // à qui emprunte le téléphone une minute.
    const { gateToken } = await import("@/lib/gate/access");

    expect(await gateToken("moustache2026")).not.toContain("moustache");
  });

  it("se vérifie sans être réversible", async () => {
    const { gateToken, gateTokenMatches } = await import("@/lib/gate/access");

    expect(
      await gateTokenMatches(await gateToken("moustache2026"), "moustache2026"),
    ).toBe(true);
    expect(
      await gateTokenMatches(await gateToken("autre-code"), "moustache2026"),
    ).toBe(false);
  });

  it("refuse un cookie absent ou fabriqué", async () => {
    const { gateTokenMatches } = await import("@/lib/gate/access");

    expect(await gateTokenMatches(undefined, "moustache2026")).toBe(false);
    expect(await gateTokenMatches("", "moustache2026")).toBe(false);
    expect(await gateTokenMatches("n’importe quoi", "moustache2026")).toBe(
      false,
    );
  });
});

describe("ce qui passe avant la porte", () => {
  it("laisse entrer l’écran d’accès lui-même", async () => {
    const { isOpenPath } = await import("@/lib/gate/access");

    expect(isOpenPath("/acces")).toBe(true);
  });

  it("laisse passer le manifeste et les icônes", async () => {
    // Un téléphone les télécharge hors du contexte de la page, sans cookie :
    // derrière la porte, il ne trouve pas d'icône et dessine une lettre sur
    // un carré de couleur.
    const { isOpenPath } = await import("@/lib/gate/access");

    expect(isOpenPath("/manifest.webmanifest")).toBe(true);
    expect(isOpenPath("/icons/icon-192.png")).toBe(true);
    expect(isOpenPath("/sw.js")).toBe(true);
  });

  it("ne laisse passer aucune page du jeu", async () => {
    const { isOpenPath } = await import("@/lib/gate/access");

    for (const guarded of [
      "/",
      "/jeu",
      "/admin",
      "/mon-compte",
      "/inscription",
    ]) {
      expect(isOpenPath(guarded)).toBe(false);
    }
  });

  it("ne se laisse pas contourner par un préfixe ressemblant", async () => {
    const { isOpenPath } = await import("@/lib/gate/access");

    expect(isOpenPath("/accessoires")).toBe(false);
    expect(isOpenPath("/icons-prives")).toBe(false);
  });
});

describe("le contrôle du code", () => {
  const actions = code("src/lib/gate/actions.ts");

  it("ne renvoie que vers un chemin du site", () => {
    // Une redirection dont la destination vient de la requête, c'est un
    // rebond ouvert — et cette page est atteignable par n'importe qui.
    // `//` comme `/\` sont lus par les navigateurs comme une autre adresse.
    const allowed = /^\/(?![/\\])/;

    expect(allowed.test("/jeu")).toBe(true);
    expect(allowed.test("/auth/confirmation?code=abc")).toBe(true);
    expect(allowed.test("//exemple.fr")).toBe(false);
    expect(allowed.test("/\\exemple.fr")).toBe(false);
    expect(allowed.test("https://exemple.fr")).toBe(false);

    expect(actions).toContain("/^\\/(?![/\\\\])/");
  });

  it("marque une pause avant de refuser", () => {
    expect(actions).toMatch(/PAUSE_MS/);
  });

  it("pose un cookie que le navigateur ne lit pas", () => {
    expect(actions).toMatch(/httpOnly: true/);
  });

  it("écrit l’empreinte, jamais le code", () => {
    expect(actions).toMatch(/gateToken\(expected\)/);
  });
});

describe("le branchement dans le middleware", () => {
  const middleware = code("src/middleware.ts");

  it("n’emploie aucun module Node, sinon la construction échoue", () => {
    // Le middleware s'exécute sur le runtime edge : `node:crypto` n'y existe
    // pas, et ça ne se voit qu'à la construction.
    expect(code("src/lib/gate/access.ts")).not.toMatch(/node:crypto/);
    expect(code("src/lib/gate/access.ts")).toMatch(/crypto\.subtle/);
  });

  it("passe avant l’appel à Supabase", () => {
    // Aucune raison de payer un aller-retour pour un visiteur qui n'aura pas
    // de page.
    expect(middleware.indexOf("gateCode()")).toBeLessThan(
      middleware.indexOf("updateSession(request)"),
    );
  });

  it("emporte les paramètres de l’adresse, pas seulement le chemin", () => {
    // Les liens qui comptent portent tout dans la requête : la confirmation
    // d'un e-mail, la réinitialisation d'un mot de passe, le retour de
    // Strava. N'en garder que le chemin ferait perdre le jeton même de la
    // page, et l'échec ressemblerait à « le lien est cassé ».
    expect(middleware).toMatch(
      /request\.nextUrl\.pathname\}\$\{request\.nextUrl\.search\}/,
    );
  });

  it("réécrit plutôt que de rediriger", () => {
    // L'adresse demandée reste celle-là : un lien mis en favori marche encore
    // une fois le code saisi.
    expect(middleware).toMatch(/NextResponse\.rewrite\(url\)/);
  });
});

describe("le mot de passe HTTP a bien disparu", () => {
  const compose = readFileSync(
    path.join(root, "deploy/docker-compose.yml"),
    "utf8",
  ).replace(/^\s*#.*$/gm, "");

  it("n’est plus posé sur le routeur de préproduction", () => {
    expect(compose).not.toMatch(/basicauth/);
    expect(compose).not.toMatch(/STAGING_BASIC_AUTH/);
  });

  it("laisse en place l’exclusion des moteurs de recherche", () => {
    // La préproduction tourne sur des clés de paiement de test : elle ne doit
    // jamais être indexée.
    expect(compose).toMatch(/X-Robots-Tag: "noindex, nofollow, noarchive"/);
  });
});
