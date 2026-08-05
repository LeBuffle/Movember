import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260805150000_challenge_arbitration.sql",
  ),
  "utf8",
).replace(/--.*$/gm, "");

const actions = code("src/lib/challenges/arbitration-actions.ts");

/* =========================================================================
 * La soupape du moteur de défis
 *
 * Un évaluateur trop strict, une activité mal synchronisée, une montre qui a
 * coupé : il faut pouvoir trancher en novembre, sans attendre un correctif.
 * Mais un arbitrage déplace les points de quelqu'un — donc le classement de
 * quelqu'un d'autre. C'est ce que ces tests protègent.
 * ====================================================================== */

describe("le schéma de l’arbitrage", () => {
  it("marque le défi comme tranché à la main", () => {
    expect(migration).toMatch(/add column if not exists arbitrated_at/);
    expect(migration).toMatch(/add column if not exists arbitrated_by/);
  });

  it("ne copie pas le motif sur la ligne", () => {
    // Le motif et l'état précédent vivent au journal, qui est inaltérable.
    // Deux enregistrements du même fait finissent par diverger, et c'est
    // celui de la ligne qui perd son historique à la première correction.
    expect(migration).not.toMatch(/arbitration_reason|arbitrated_reason/);
  });

  it("garde la trace quand le compte de l’administrateur disparaît", () => {
    expect(migration).toMatch(/arbitrated_by[\s\S]{0,120}on delete set null/);
  });

  it("n’ouvre aucun droit d’écriture aux participants", () => {
    // `challenge_assignments` n'a de politique d'écriture pour personne, et
    // c'est ce qui empêche quelqu'un de s'attribuer le mois.
    expect(migration).not.toMatch(/create policy/i);
  });
});

describe("l’action d’arbitrage", () => {
  it("vérifie le rôle avant tout", () => {
    const body = actions.slice(
      actions.indexOf("export async function arbitrateChallenge"),
    );

    expect(body.indexOf("requireAdmin()")).toBeLessThan(
      body.indexOf("challenge_assignments"),
    );
  });

  it("exige un motif d’une vraie phrase", () => {
    expect(actions).toMatch(/MINIMUM_REASON = 10/);
    expect(actions).toMatch(/reason\.length < MINIMUM_REASON/);
  });

  it("n’a pas de décision par défaut", () => {
    // « Valider » et « invalider » ont des conséquences opposées sur le
    // classement. Une option pré-choisie serait une décision prise par celui
    // qui a écrit le formulaire.
    expect(actions).toMatch(
      /decision !== "validate" && decision !== "invalidate"/,
    );
  });

  it("écrit la trace avant de toucher aux points", () => {
    const body = actions.slice(
      actions.indexOf("export async function arbitrateChallenge"),
    );

    expect(body.indexOf("logAdminAction")).toBeLessThan(
      body.indexOf(".update("),
    );
  });

  it("renonce si la trace ne s’enregistre pas", () => {
    // Même raisonnement que pour le remboursement : une entrée sans suite
    // est informative, des points qui bougent sans nom ne le sont pas.
    expect(actions).toMatch(/if \(!traced\)/);
    expect(actions).toMatch(/trace n’a pas pu être enregistrée/);
  });

  it("consigne l’état précédent, pas seulement le nouveau", () => {
    // Sans lui, un retour en arrière ne se lit pas dans le journal.
    expect(actions).toMatch(/previous_status: previous\.status/);
    expect(actions).toMatch(/previous_points: previous\.points_awarded/);
  });

  it("journalise un échec d’écriture", () => {
    expect(actions).toContain("challenge.arbitration_failed");
  });

  it("porte la garde sur l’écriture, pas sur la lecture", () => {
    // Deux administrateurs sur le même défi au même instant ne doivent pas
    // réussir tous les deux.
    expect(actions).toMatch(/\.eq\("status", previous\.status\)/);
  });

  it("n’annonce pas un succès qui n’a rien changé", () => {
    // Deux personnes qui croient des choses opposées du même défi, c'est
    // exactement ce qu'on veut éviter.
    expect(actions).toMatch(/\(changed \?\? \[\]\)\.length === 0/);
    expect(actions).toMatch(/arbitré par quelqu’un d’autre/);
  });

  it("accorde les points du catalogue à la validation", () => {
    expect(actions).toMatch(
      /points_awarded: previous\.challenges\?\.points \?\? 0/,
    );
  });

  it("invalide vers « manqué », jamais vers « en cours »", () => {
    // Rouvrir le défi laisserait l'activité qu'on vient d'écarter le
    // revalider à la prochaine évaluation : un arbitrage qui s'annule seul.
    const update = actions.slice(actions.indexOf(".update("));

    expect(update).toMatch(/status: "missed"/);
    expect(update).toMatch(/points_awarded: null/);
    expect(update).toMatch(/completed_at: null/);
    expect(update).not.toMatch(/status: "open"/);
  });

  it("refuse de refaire deux fois la même décision", () => {
    expect(actions).toMatch(/déjà validé/);
    expect(actions).toMatch(/déjà invalidé/);
  });

  it("passe par la clé de service, seule porte d’écriture", () => {
    expect(actions).toMatch(/createAdminClient/);
  });

  it("rafraîchit aussi les écrans du participant", () => {
    // Sans ça, le participant continue de voir l'ancien verdict.
    expect(actions).toMatch(/revalidatePath\("\/jeu"\)/);
    expect(actions).toMatch(/revalidatePath\("\/jeu\/historique"\)/);
  });
});

describe("la lecture pour arbitrer", () => {
  const lib = code("src/lib/challenges/arbitration.ts");

  it("passe par la session de l’administrateur", () => {
    // La sécurité au niveau des lignes répond ; seule l'écriture prend la
    // clé de service.
    expect(lib).not.toMatch(/createAdminClient/);
  });

  it("échappe les jokers d’une recherche par pseudonyme", () => {
    // Sans ça, chercher « _ » listerait tout le monde.
    expect(lib).toMatch(/replace\(\/\[%_\\\\\]\/g/);
  });

  it("relit le journal pour montrer ce qui a déjà été décidé", () => {
    expect(lib).toMatch(/admin_audit_log/);
    expect(lib).toMatch(/previous_status/);
  });

  it("survit à la suppression d’un compte d’administrateur", () => {
    expect(lib).toMatch(/compte supprimé/);
  });
});

describe("les écrans", () => {
  const detail = code(
    "src/app/(admin)/admin/defis/arbitrage/[attribution]/page.tsx",
  );
  const list = code("src/app/(admin)/admin/defis/arbitrage/page.tsx");

  it("disent ce que l’arbitrage fait avant de le faire", () => {
    expect(detail).toMatch(/classement/);
  });

  it("montrent ce qui a été mesuré, ou qu’il n’y a rien", () => {
    // La question la plus fréquente du support : « pourquoi ce défi n'est-il
    // pas validé alors que j'ai couru ? »
    expect(detail).toMatch(/Aucune activité n’a été prise en compte/);
  });

  it("montrent l’historique des décisions", () => {
    expect(detail).toMatch(/Ce qui a déjà été décidé/);
  });

  it("listent ce qui a déjà été arbitré cette édition", () => {
    expect(list).toMatch(/Déjà arbitrés cette édition/);
  });

  it("cherchent par pseudonyme avec un formulaire qui marche sans JavaScript", () => {
    expect(list).toMatch(/method="get"/);
  });

  it("marquent le défi arbitré côté administration", () => {
    expect(list).toMatch(/Arbitré/);
  });

  it("le marquent aussi côté participant", () => {
    expect(code("src/components/game/challenge-card.tsx")).toMatch(
      /Décidé par l’organisation/,
    );
  });
});

describe("le formulaire", () => {
  const form = code("src/components/admin/arbitration-form.tsx");

  it("n’arrive avec aucune décision cochée", () => {
    expect(form).toMatch(/useState\(""\)/);
  });

  it("demande confirmation avant d’enregistrer", () => {
    expect(form).toMatch(/window\.confirm/);
  });

  it("garde le bouton inerte tant qu’il manque une décision ou un motif", () => {
    expect(form).toMatch(/decision === "" \|\| reason\.trim\(\)\.length < 10/);
  });

  it("n’offre pas de refaire la décision déjà en place", () => {
    expect(form).toMatch(/disabled=\{status === "completed"\}/);
    expect(form).toMatch(/disabled=\{status === "missed"\}/);
  });
});
