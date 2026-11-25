import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scrubEvent } from "@/lib/monitoring/scrub";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

/* =========================================================================
 * Rien de personnel ne part chez Sentry
 *
 * Sentry est un tiers, hébergé hors de notre contrôle. Ce qu'un rapport
 * d'erreur transporte naturellement est exactement ce qu'il ne doit pas
 * recevoir : le cookie de session, l'adresse d'un lien de confirmation avec
 * son code à usage unique, le corps du formulaire de connexion avec le mot
 * de passe dedans.
 * ====================================================================== */

describe("filtrage avant envoi", () => {
  it("retire le cookie de session", () => {
    const scrubbed = scrubEvent({
      request: {
        cookies: { "sb-abc-auth-token": "eyJhbGciOi..." },
        headers: { Cookie: "sb-abc-auth-token=eyJhbGciOi..." },
      },
    });

    expect(JSON.stringify(scrubbed)).not.toContain("eyJhbGciOi");
  });

  it("retire le corps de la requête, où voyage le mot de passe", () => {
    const scrubbed = scrubEvent({
      request: {
        method: "POST",
        data: { email: "sylvain@exemple.fr", password: "phrase-de-passe" },
      },
    });

    const json = JSON.stringify(scrubbed);
    expect(json).not.toContain("phrase-de-passe");
    expect(json).not.toContain("sylvain@exemple.fr");
    // Ce qui reste est utile et anodin.
    expect(json).toContain("POST");
  });

  it("coupe la chaîne de requête des adresses", () => {
    // `?code=` sur un lien de confirmation est un identifiant à usage unique.
    const scrubbed = scrubEvent({
      request: {
        url: "https://defi-movember.fr/auth/confirmation?code=abc123",
      },
    });

    const json = JSON.stringify(scrubbed);
    expect(json).not.toContain("abc123");
    expect(json).toContain("/auth/confirmation");
  });

  it("remplace une adresse e-mail où qu’elle se trouve", () => {
    // Le cas qui compte : personne n'a prévu que le message d'erreur de la
    // base citerait la valeur qui viole un index unique.
    const scrubbed = scrubEvent({
      message:
        "duplicate key value violates unique constraint: Key (email)=(sylvain@tournay.me) already exists",
      extra: { note: "signalé par jean.dupont@exemple.fr" },
    });

    const json = JSON.stringify(scrubbed);
    expect(json).not.toContain("sylvain@tournay.me");
    expect(json).not.toContain("jean.dupont@exemple.fr");
    expect(json).toContain("[courriel]");
    // Le diagnostic reste lisible.
    expect(json).toContain("unique constraint");
  });

  it("retire l’identité de l’utilisateur et son adresse IP", () => {
    const scrubbed = scrubEvent({
      user: {
        id: "b3f1",
        email: "sylvain@exemple.fr",
        ip_address: "82.64.1.2",
      },
    });

    const json = JSON.stringify(scrubbed);
    expect(json).not.toContain("82.64.1.2");
    expect(json).not.toContain("b3f1");
  });

  it("nettoie aussi en profondeur, dans les fils d’Ariane", () => {
    const scrubbed = scrubEvent({
      breadcrumbs: [
        {
          category: "fetch",
          data: { url: "/api/strava?token=xyz789" },
        },
      ],
    });

    expect(JSON.stringify(scrubbed)).not.toContain("xyz789");
  });

  it("laisse passer ce qui sert à corriger le défaut", () => {
    const scrubbed = scrubEvent({
      exception: {
        values: [
          { type: "TypeError", value: "Cannot read properties of undefined" },
        ],
      },
      tags: { environment: "production", release: "a1b2c3d" },
    });

    const json = JSON.stringify(scrubbed);
    expect(json).toContain("TypeError");
    expect(json).toContain("Cannot read properties of undefined");
    expect(json).toContain("a1b2c3d");
  });

  it("ne boucle pas sur une structure trop profonde", () => {
    let deep: Record<string, unknown> = { fin: "valeur" };
    for (let i = 0; i < 40; i += 1) deep = { niveau: deep };

    expect(() => scrubEvent(deep)).not.toThrow();
    expect(JSON.stringify(scrubEvent(deep))).toContain("[trop profond]");
  });
});

describe("configuration de Sentry", () => {
  const configs = [
    "src/instrumentation-client.ts",
    "src/sentry.server.config.ts",
    "src/sentry.edge.config.ts",
  ];

  it.each(configs)("%s applique le filtrage", (file) => {
    const source = read(file);

    expect(source).toMatch(/beforeSend/);
    expect(source).toMatch(/scrubEvent/);
  });

  it.each(configs)(
    "%s n’envoie pas les données personnelles par défaut",
    (file) => {
      // `sendDefaultPii: true` joindrait l'adresse IP et les en-têtes de la
      // requête à chaque rapport, sans passer par notre filtre.
      expect(read(file)).toMatch(/sendDefaultPii:\s*false/);
    },
  );

  it.each(configs)("%s reste inerte sans clé", (file) => {
    // Sans DSN, Sentry ne doit rien tenter : c'est le cas en développement et
    // tant que le compte n'est pas créé.
    expect(read(file)).toMatch(/enabled:/);
  });
});
