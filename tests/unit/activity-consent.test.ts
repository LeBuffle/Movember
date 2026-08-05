import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CONSENT_COLLECTED,
  CONSENT_NEVER_COLLECTED,
  CONSENT_VERSION,
} from "@/lib/activities/consent";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const migration = readFileSync(
  path.join(root, "supabase/migrations/20260805170000_activity_consent.sql"),
  "utf8",
).replace(/--.*$/gm, "");

/* =========================================================================
 * Un consentement qui prouve quelque chose
 *
 * Les données d'activité sont sensibles : localisation, rythme, santé. Le
 * consentement doit être libre, spécifique, éclairé et univoque — et
 * « spécifique » est le mot qui décide de la forme.
 * ====================================================================== */

describe("le registre des consentements", () => {
  it("est un journal, pas un drapeau", () => {
    // Un drapeau retourné deux fois a oublié la première. Ce qu'il faut
    // pouvoir répondre des mois plus tard, c'est « à quelle date, à quelle
    // version, et quand retiré ».
    expect(migration).toMatch(
      /action text not null check \(action in \('granted', 'withdrawn'\)\)/,
    );
  });

  it("ne se corrige jamais après coup", () => {
    // Aucune politique de modification ni de suppression, pas même pour un
    // administrateur : un consentement rectifiable ne prouve rien.
    expect(migration).not.toMatch(/for update/i);
    expect(migration).not.toMatch(/for delete/i);
  });

  it("exige la version du texte à chaque accord", () => {
    // La date seule ne dit pas à quoi la personne a consenti, et le texte
    // sera réécrit avant l'ouverture des inscriptions.
    expect(migration).toMatch(/action <> 'granted' or version is not null/);
  });

  it("interdit de consentir au nom de quelqu’un d’autre", () => {
    // C'est la seule chose qu'un registre de consentement ne doit jamais
    // permettre. L'identifiant est comparé à la session, pas lu de la requête.
    expect(migration).toMatch(
      /participants record their own consent[\s\S]*?with check \(\(select auth\.uid\(\)\) = profile_id\)/,
    );
  });

  it("laisse l’organisation répondre à un régulateur", () => {
    expect(migration).toMatch(/admins read the consent history/);
  });

  it("protège la table", () => {
    expect(migration).toMatch(
      /alter table public\.activity_consents enable row level security/,
    );
  });
});

describe("l’état du consentement", () => {
  const lib = code("src/lib/activities/consent.ts");

  it("est celui du dernier événement", () => {
    // Un accord suivi d'un retrait est un retrait ; un retrait suivi d'un
    // nouvel accord est un accord.
    expect(lib).toMatch(/order\("created_at", \{ ascending: false \}\)/);
    expect(lib).toMatch(/\.limit\(1\)/);
    expect(lib).toMatch(/data\.action !== "granted"/);
  });

  it("passe par la session du participant", () => {
    expect(lib).not.toMatch(/createAdminClient/);
  });

  it("porte une version, qui n’est pas une date", () => {
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
  });

  it("expose une porte unique pour toute connexion à venir", () => {
    // La story 3.3 l'appelle avant de fabriquer une URL d'autorisation :
    // masquer un bouton n'est pas un contrôle.
    expect(lib).toMatch(/mayConnectActivitySource/);
  });
});

describe("ce qui est dit au participant", () => {
  const page = code("src/app/(participant)/mon-compte/activites/page.tsx");

  it("annonce ce qui est récupéré", () => {
    expect(CONSENT_COLLECTED.length).toBeGreaterThan(0);
    expect(CONSENT_COLLECTED.join(" ")).toMatch(/sport/i);
    expect(CONSENT_COLLECTED.join(" ")).toMatch(/distance/i);
  });

  it("annonce surtout ce qui ne l’est jamais", () => {
    // « Nous récupérons vos activités » inquiète ; « nous ne stockons jamais
    // votre tracé ni votre fréquence cardiaque » répond à la vraie question.
    const never = CONSENT_NEVER_COLLECTED.join(" ").toLowerCase();

    expect(never).toContain("gps");
    expect(never).toContain("cardiaque");
    expect(never).toContain("puissance");
    expect(never).toContain("cadence");
  });

  it("dit la durée de conservation et comment effacer", () => {
    expect(page).toMatch(/12 mois/);
    expect(page).toMatch(/supprimer votre compte/);
  });

  it("dit que Strava est une société américaine", () => {
    // C'est précisément ce que ce consentement encadre.
    expect(page).toMatch(/américaine/);
  });

  it("propose le retrait sur le même écran que l’accord", () => {
    // Un consentement facile à donner et difficile à retirer n'est pas libre.
    expect(page).toMatch(/WithdrawConsent/);
  });

  it("dit qu’aucune donnée n’est demandée sans autorisation", () => {
    expect(page).toMatch(/aucune donnée sportive n’est/);
  });
});

describe("l’enregistrement du consentement", () => {
  const actions = code("src/lib/activities/consent-actions.ts");
  const form = code("src/components/activities/consent-form.tsx");

  it("refuse un accord dont la case n’est pas cochée", () => {
    // Le navigateur peut l'exiger ; le serveur le vérifie quand même.
    expect(actions).toMatch(/formData\.get\("consent"\) !== "on"/);
  });

  it("n’arrive jamais avec la case pré-cochée", () => {
    // Une case pré-cochée est une décision prise par celui qui a écrit le
    // formulaire, au nom de quelqu'un qui ne l'a pas lue.
    expect(form).toMatch(/useState\(false\)/);
    expect(form).not.toMatch(/defaultChecked/);
  });

  it("écrit par la session, jamais par la clé de service", () => {
    expect(actions).not.toMatch(/createAdminClient/);
  });

  it("n’attache une version qu’aux accords", () => {
    expect(actions).toMatch(
      /version: action === "granted" \? CONSENT_VERSION : null/,
    );
  });

  it("ajoute une ligne dans les deux sens, sans jamais en modifier une", () => {
    expect(actions).toMatch(/\.insert\(/);
    expect(actions).not.toMatch(/\.update\(/);
    expect(actions).not.toMatch(/\.delete\(/);
  });

  it("ne laisse pas un retrait échouer en silence", () => {
    expect(form).toMatch(/state\.message && <Alert tone="danger">/);
  });
});
