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
  path.join(root, "supabase/migrations/20260805140000_common_challenges.sql"),
  "utf8",
).replace(/--.*$/gm, "");

/* =========================================================================
 * Le mécanisme des animations
 *
 * Sans lui, le jeu n'a aucun moment partagé : quatre cents personnes avancent
 * seules, chacune avec ses propres défis.
 * ====================================================================== */

describe("le schéma du défi commun", () => {
  it("n’en autorise qu’un par jour", () => {
    // Deux défis communs le même jour cesseraient d'être « communs ».
    expect(migration).toMatch(/unique \(edition_id, scheduled_for\)/);
  });

  it("exige un choix explicite entre « en plus » et « à la place »", () => {
    // Les deux se défendent — à la place allège la journée, en plus la
    // charge — et laisser le code décider produirait la mauvaise surprise un
    // jour sur deux. Donc pas de valeur par défaut.
    expect(migration).toMatch(
      /mode text not null check \(mode in \('replace', 'additional'\)\)/,
    );
    expect(migration).not.toMatch(/mode text not null default/);
  });

  it("annule sans supprimer", () => {
    // « Il y avait un défi commun ce jour-là et il a été annulé » reste un
    // fait qu'on peut lire.
    expect(migration).toMatch(/cancelled_at timestamptz/);
  });

  it("empêche de supprimer un défi déjà programmé pour tout le monde", () => {
    expect(migration).toMatch(/challenge_id[\s\S]{0,80}on delete restrict/);
  });

  it("n’autorise qu’une attribution commune par personne et par jour", () => {
    // La source `common` est hors de l'index individuel — c'est ce qui permet
    // au mode « en plus » d'exister — mais il lui faut le sien, sinon une
    // tâche rejouée donnerait deux fois le même défi commun.
    expect(migration).toMatch(
      /unique index challenge_assignments_one_common_per_day[\s\S]*?where source = 'common'/i,
    );
  });

  it("ne laisse pas les participants lire le calendrier des animations", () => {
    // Une surprise partagée annoncée une semaine à l'avance n'en est pas une.
    const policies = [
      ...migration.matchAll(/create\s+policy\s+"([^"]+)"/gi),
    ].map((match) => match[1]);

    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) {
      expect(policy).toMatch(/admins/);
    }
  });

  it("protège la table", () => {
    expect(migration).toMatch(
      /alter table public\.common_challenges enable row level security/,
    );
  });
});

describe("l’attribution du défi commun", () => {
  const task = code("src/lib/challenges/daily-draw.ts");

  it("ignore un défi commun annulé", () => {
    expect(task).toMatch(/\.is\("cancelled_at", null\)/);
  });

  it("ne le donne pas deux fois à la même personne", () => {
    expect(task).toMatch(/hasCommonToday/);
  });

  it("saute le tirage individuel en mode « à la place »", () => {
    expect(task).toMatch(/common\?\.mode === "replace"[\s\S]{0,40}continue/);
  });

  it("traite un doublon en base comme un succès", () => {
    // Comme pour le tirage : quelqu'un est passé avant, le participant a son
    // défi, c'est tout ce qui compte.
    const block = task.slice(task.indexOf('source: "common"'));

    expect(block).toMatch(/error\.code !== "23505"/);
  });

  it("compte ce qu’elle a attribué", () => {
    expect(task).toMatch(/commonAssigned/);
  });
});

describe("la programmation depuis le back-office", () => {
  const actions = code("src/lib/challenges/admin-actions.ts");

  it("refuse une date passée", () => {
    // Un jour déjà passé a déjà distribué ses défis.
    expect(actions).toMatch(/scheduledFor < todayInParis\(\)/);
  });

  it("exige le mode, sans en présumer un", () => {
    expect(actions).toMatch(/mode !== "replace" && mode !== "additional"/);
  });

  it("dit clairement qu’un défi commun existe déjà ce jour-là", () => {
    expect(actions).toMatch(/déjà prévu ce jour-là/);
  });

  it("n’annule que ce qui est encore à venir, et l’écriture le garantit", () => {
    // Un contrôle fait un instant plus tôt ne tient pas : le jour peut
    // basculer entre les deux.
    const cancel = actions.slice(actions.indexOf("cancelCommonChallenge"));

    expect(cancel).toMatch(/\.gt\("scheduled_for", todayInParis\(\)\)/);
    expect(cancel).toMatch(/\.is\("cancelled_at", null\)/);
  });

  it("journalise la programmation et l’annulation", () => {
    expect(actions).toContain("common_challenge.scheduled");
    expect(actions).toContain("common_challenge.cancelled");
  });

  it("vérifie le rôle avant tout", () => {
    const schedule = actions.slice(
      actions.indexOf("export async function scheduleCommonChallenge"),
    );

    expect(schedule.indexOf("requireAdmin()")).toBeLessThan(
      schedule.indexOf("common_challenges"),
    );
  });
});

describe("côté participant", () => {
  it("le défi commun est nommé pour ce qu’il est", () => {
    // Ça change ce que le défi veut dire : tout le monde l'a aujourd'hui.
    expect(code("src/components/game/challenge-card.tsx")).toMatch(
      /Défi commun/,
    );
  });

  it("la source est lue avec l’attribution", () => {
    expect(code("src/lib/challenges/assignments.ts")).toMatch(/source/);
  });
});
