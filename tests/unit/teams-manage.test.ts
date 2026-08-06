import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * La gestion d'une équipe (story 7.2)
 *
 * Le capitaine fait le travail que l'organisation ne peut pas faire à sa
 * place : il connaît les gens et sait les convaincre. Tout ce qui l'oblige à
 * écrire à l'organisation est du recrutement perdu.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const manage = code(read("src/lib/teams/manage.ts"));
const actions = code(read("src/lib/teams/manage-actions.ts"));
const list = code(read("src/components/teams/member-list.tsx"));
const adminPage = code(read("src/app/(admin)/admin/equipes/page.tsx"));
const sections = code(read("src/lib/admin/sections.ts"));

describe("un capitaine ne part pas sans transmettre", () => {
  it("le refus est explicite", () => {
    // AC 5. Une équipe sans capitaine ne peut plus inviter personne, et
    // l'organisation devra la réparer à la main, en novembre.
    expect(manage).toMatch(/reason: "captain-must-hand-over"/);
    expect(manage).toMatch(/membership\.role === "capitaine" && !alone/);
  });

  it("mais un capitaine seul peut partir, et son équipe est dissoute", () => {
    // Le refuser serait absurde. Rien n'est perdu : défis, points et cartes
    // appartiennent au participant, jamais à l'équipe.
    expect(manage).toMatch(/const alone = \(count \?\? 0\) <= 1/);
    expect(manage).toMatch(/note: "team-dissolved"/);
  });

  it("et l'écran le dit avant le bouton, pas après", () => {
    expect(list).toMatch(/isCaptain && !alone/);
    expect(list).toMatch(/transmettez d’abord le rôle/);
  });
});

describe("exclure un membre", () => {
  it("est réservé au capitaine, établi à chaque appel", () => {
    // AC 4.
    const region = manage.slice(
      manage.indexOf("export async function removeMember"),
    );

    expect(region.indexOf("requireCaptain()")).toBeLessThan(
      region.indexOf(".delete()"),
    );
  });

  it("ne peut jamais viser le capitaine, garde portée par l'écriture", () => {
    const region = manage.slice(
      manage.indexOf("export async function removeMember"),
      manage.indexOf("export async function handOverCaptaincy"),
    );

    expect(region).toMatch(/\.eq\("role", "membre"\)/);
  });

  it("et la confirmation nomme la personne", () => {
    // « Exclure Sophie ? » est une question à laquelle on répond juste ;
    // « Êtes-vous sûr ? » est une question qu'on clique.
    expect(list).toMatch(/Exclure \$\{member\.displayName\}/);
  });
});

describe("transmettre le rôle", () => {
  it("écrit l'équipe avant les rôles, et l'ordre compte", () => {
    // Si la seconde écriture échoue, l'équipe a brièvement un capitaine dont
    // l'adhésion dit encore « membre » : gênant, et rattrapable en
    // recommençant. L'ordre inverse laisserait deux capitaines, ce dont rien
    // ne se rattrape.
    const region = manage.slice(
      manage.indexOf("export async function handOverCaptaincy"),
    );

    expect(region.indexOf('from("teams")')).toBeLessThan(
      region.indexOf('role: "capitaine"'),
    );
  });

  it("n'accepte qu'un membre de l'équipe", () => {
    const region = manage.slice(
      manage.indexOf("export async function handOverCaptaincy"),
    );

    expect(region).toMatch(
      /if \(!member\) return \{ ok: false, reason: "not-a-member" \}/,
    );
  });

  it("et la garde est portée par l'écriture, pas par une lecture", () => {
    const region = manage.slice(
      manage.indexOf("export async function handOverCaptaincy"),
    );

    expect(region).toMatch(/\.eq\("captain_id", captain\.profileId\)/);
  });
});

describe("les membres sont nommés par leur pseudonyme", () => {
  it("lus par la vue publique, jamais par la table des profils", () => {
    // Lire `profiles` pour obtenir un nom livrerait les adresses e-mail dans
    // la même requête.
    expect(manage).toMatch(/from\("public_profiles"\)/);
    expect(manage).not.toMatch(/from\("profiles"\)/);
  });

  it("et un compte supprimé ne laisse pas un trou dans la liste", () => {
    expect(manage).toMatch(/\?\? "Participant"/);
  });
});

describe("l'organisation crée une équipe pour une entreprise", () => {
  it("l'écran existe et est journalisé", () => {
    // FR78.
    expect(actions).toMatch(/action: "team\.created"/);
    expect(actions).toMatch(/action: "team\.captain_assigned"/);
  });

  it("vérifie le rôle avant d'écrire", () => {
    for (const name of ["adminCreateTeamAction", "adminAssignCaptainAction"]) {
      const region = actions.slice(
        actions.indexOf(`export async function ${name}`),
      );

      expect(region.indexOf("requireAdmin()")).toBeGreaterThan(-1);
      expect(region.indexOf("requireAdmin()")).toBeLessThan(
        region.indexOf("logAdminAction"),
      );
    }
  });

  it("désigne un capitaine parmi les membres, jamais en dehors", () => {
    // Un capitaine qui n'est pas membre ne pourrait ni être exclu, ni partir,
    // ni compter au classement.
    const region = manage.slice(
      manage.indexOf("export async function adminAssignCaptain"),
    );

    expect(region).toMatch(
      /if \(!member\) return \{ ok: false, reason: "not-a-member" \}/,
    );
  });

  it("ne laisse pas l'organisation réorganiser une équipe", () => {
    // Un capitaine qui découvre son équipe remaniée par quelqu'un d'autre
    // cesse de recruter, et recruter est ce à quoi servent les équipes.
    expect(adminPage).not.toMatch(/removeMemberAction/);
    expect(adminPage).not.toMatch(/Renommer/);
  });

  it("et la section du back-office n'est plus annoncée comme à venir", () => {
    const region = sections.slice(sections.indexOf('slug: "equipes"'));

    expect(region.slice(0, 300)).toMatch(/status: "available"/);
  });
});

describe("tous les refus sont des phrases actionnables", () => {
  it("chaque raison a son message", () => {
    for (const reason of [
      "unauthenticated",
      "not-in-team",
      "not-captain",
      "captain-must-hand-over",
      "not-a-member",
    ]) {
      expect(actions).toMatch(new RegExp(`case "${reason}":`));
    }
  });

  it("et « vous êtes capitaine » dit quoi faire ensuite", () => {
    expect(actions).toMatch(/transmettez d’abord le rôle/);
  });
});
