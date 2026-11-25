import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkLogo,
  logoInitials,
  MAX_LOGO_BYTES,
} from "@/lib/super-teams/logo";

/* =========================================================================
 * Super-équipes et logos (epic 14)
 *
 * **Une couche au-dessus des équipes, qui ne doit rien changer en dessous.**
 * Ce fichier protège les cinq règles qui, si elles cèdent, retirent quelque
 * chose à quelqu'un sans prévenir :
 *
 *   - une équipe dans deux super-équipes, donc dans deux classements ;
 *   - une super-équipe supprimée qui emporte ses équipes ;
 *   - un capitaine de super-équipe qui touche à autre chose que l'apparence ;
 *   - une seconde formule de classement à côté de celle de la story 7.5 ;
 *   - un logo sans limite, ou dont la limite n'existe que dans le formulaire.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*--.*$/gm, "");
}

const schema = code(read("supabase/migrations/20260813000000_super_teams.sql"));
const logosMigration = code(
  read("supabase/migrations/20260813010000_team_logos.sql"),
);
const manage = code(read("src/lib/super-teams/manage.ts"));
const appearance = code(read("src/lib/super-teams/appearance.ts"));
const appearanceActions = code(
  read("src/lib/super-teams/appearance-actions.ts"),
);
const manageActions = code(read("src/lib/super-teams/manage-actions.ts"));
const moderation = code(read("src/lib/super-teams/moderation.ts"));
const superTeamRead = code(read("src/lib/super-teams/read.ts"));
const teamsBoard = code(read("src/lib/leaderboards/teams.ts"));

/* -------------------------------------------------------------------------
 * Le schéma
 * ---------------------------------------------------------------------- */

describe("une équipe appartient à une super-équipe, ou à aucune", () => {
  it("le rattachement est une colonne sur `teams`, pas une table de liaison", () => {
    // Une table de liaison exprimerait « une équipe peut appartenir à
    // plusieurs super-équipes » — précisément ce qui est interdit. Une
    // colonne dit la règle à l'endroit qui peut la tenir.
    expect(schema).toMatch(
      /alter table public\.teams\s+add column super_team_id uuid/,
    );
    expect(schema).not.toMatch(/create table public\.super_team_teams/);
  });

  it("et le rattachement se refuse tout seul si l’équipe est déjà prise", () => {
    // Le garde est porté par l'écriture. Une vérification faite juste avant
    // ne tiendrait pas face à deux administrateurs sur le même écran.
    expect(manage).toMatch(/\.is\("super_team_id", null\)/);
  });
});

describe("supprimer une super-équipe ne supprime aucune équipe", () => {
  it("le lien se défait, il n’emporte rien", () => {
    // `cascade` supprimerait les équipes avec la fédération. Une suppression
    // qui emporte des équipes est une suppression que personne n'ose faire.
    const attachment = schema.slice(
      schema.indexOf("add column super_team_id"),
      schema.indexOf("create index teams_super_team_idx"),
    );

    expect(attachment).toMatch(/on delete set null/);
    expect(attachment).not.toMatch(/on delete cascade/);
  });

  it("et le code ne détache pas les équipes à la main", () => {
    // La clé étrangère s'en charge. Une boucle ici serait un second endroit
    // où la règle pourrait être oubliée.
    const remove = manage.slice(
      manage.indexOf("export async function deleteSuperTeam"),
      manage.indexOf("export async function attachTeam"),
    );

    expect(remove).toMatch(/from\("super_teams"\)/);
    expect(remove).not.toMatch(/from\("teams"\)/);
  });
});

describe("la table des super-équipes ne s’écrit par personne d’autre que le serveur", () => {
  it("aucune politique d’écriture, pas même pour le capitaine", () => {
    // La sécurité au niveau des lignes sait dire « cette ligne est à vous ».
    // Elle ne sait pas dire « et seulement ces deux colonnes » — or un
    // capitaine qui pourrait écrire `captain_id` se transmettrait la
    // fédération, ce que la décision S2 réserve à l'organisation.
    expect(schema).toMatch(
      /alter table public\.super_teams enable row level security/,
    );
    expect(schema).not.toMatch(/for (insert|update|delete)/);
  });

  it("la lecture publique passe par une vue, pas par la table", () => {
    // Même piège que `teams` : la sécurité filtre des LIGNES, pas des
    // COLONNES.
    expect(schema).toMatch(/create view public\.public_super_teams as/);
    expect(schema).toMatch(/grant select on public\.public_super_teams/);
  });
});

/* -------------------------------------------------------------------------
 * Le classement interne
 * ---------------------------------------------------------------------- */

describe("le classement interne réutilise la formule existante", () => {
  it("il n’en écrit pas une seconde", () => {
    // Deux formules, c'est un second débat sur l'équité et deux règles que
    // personne ne sait expliquer le jour d'une contestation.
    expect(superTeamRead).toMatch(
      /getTeamLeaderboard\(ownTeamId, \{ teamIds \}\)/,
    );
    expect(superTeamRead).not.toMatch(/Math\.pow/);
    expect(superTeamRead).not.toMatch(/exponent\s*[:=]\s*[\d.]/);
  });

  it("et il lit les mêmes réglages en base", () => {
    // L'exposant et le seuil vivent dans `leaderboard_settings` : le PO peut
    // les corriger en novembre, et les deux classements bougent ensemble.
    expect(teamsBoard).toMatch(/from\("leaderboard_settings"\)/);
    expect(superTeamRead).not.toMatch(/leaderboard_settings/);
  });

  it("la phrase d’explication vient de l’exposant, comme au classement général", () => {
    expect(superTeamRead).toMatch(
      /explainNormalisation\(standings\.exponent\)/,
    );
  });

  it("restreindre à une super-équipe ne change pas le classement général", () => {
    // Le filtre est optionnel et ne s'applique que si des équipes sont
    // passées : un appel sans argument reste exactement l'appel de la
    // story 7.5.
    expect(teamsBoard).toMatch(
      /const only = options\.teamIds \? new Set\(options\.teamIds\) : null;/,
    );
    expect(teamsBoard).toMatch(/!only \|\| only\.has\(teamId\)/);
  });
});

/* -------------------------------------------------------------------------
 * Ce que le capitaine de super-équipe peut faire, et pas
 * ---------------------------------------------------------------------- */

describe("le capitaine de super-équipe gère l’apparence, et rien d’autre", () => {
  const change = appearance.slice(
    appearance.indexOf("export async function setSuperTeamAppearance"),
  );

  it("il n’écrit ni le nom, ni l’adresse, ni sa propre nomination", () => {
    // Le garde est que ces colonnes ne sont pas écrites ici. Aucun champ de
    // formulaire supplémentaire ne peut donc les atteindre.
    expect(change).toMatch(/description/);
    expect(change).not.toMatch(/name:/);
    expect(change).not.toMatch(/slug:/);
    expect(change).not.toMatch(/captain_id:/);
  });

  it("et l’écriture rappelle elle-même qu’il est bien le capitaine", () => {
    // L'organisation a pu nommer quelqu'un d'autre entre la lecture et
    // l'écriture.
    expect(change).toMatch(/\.eq\("captain_id", profileId\)/);
  });

  it("le rattachement et le détachement ne lui sont jamais proposés", () => {
    // Ils passent par le back-office, derrière `requireAdmin`.
    expect(appearanceActions).not.toMatch(/super_team_id/);
    expect(manageActions).toMatch(/requireAdmin/);
  });

  it("son écran ne lit aucun identifiant du formulaire", () => {
    // La super-équipe vient de la session. Il n'y a donc pas d'adresse à
    // taper pour atteindre celle de quelqu'un d'autre.
    expect(appearanceActions).not.toMatch(/formData\.get\("superTeamId"\)/);
    expect(appearanceActions).not.toMatch(/formData\.get\("teamId"\)/);
  });
});

describe("le capitaine d’équipe dépose le logo de son équipe", () => {
  const setLogo = appearance.slice(
    appearance.indexOf("export async function setOwnTeamLogo"),
    appearance.indexOf("export async function clearOwnTeamLogo"),
  );

  it("l’équipe vient de la session, jamais du formulaire", () => {
    expect(setLogo).toMatch(/\.eq\("captain_id", profileId\)/);
  });

  it("et un membre simple ne peut pas le faire", () => {
    expect(setLogo).toMatch(/reason: "not-captain"/);
  });
});

/* -------------------------------------------------------------------------
 * Les logos
 * ---------------------------------------------------------------------- */

describe("les limites du logo sont dans le stockage, pas seulement dans le formulaire", () => {
  it("le seau porte la même limite que le code", () => {
    // Un formulaire se contourne ; le seau est ce qui tient réellement. Les
    // deux valeurs doivent rester identiques : une base plus permissive
    // refuse ce qui serait passé, l'inverse donne une erreur de stockage
    // incompréhensible après une longue attente.
    const limit = logosMigration.match(/values \([\s\S]*?true,\s*(\d+)/);

    expect(limit).not.toBeNull();
    expect(Number(limit![1])).toBe(MAX_LOGO_BYTES);
  });

  it("et le même jeu de formats", () => {
    expect(logosMigration).toMatch(
      /array\['image\/jpeg', 'image\/png', 'image\/webp'\]/,
    );
  });

  it("aucune politique n’ouvre le seau aux participants", () => {
    // Une politique assez large pour être écrite — « tout participant
    // connecté peut déposer » — serait un seau que n'importe qui remplit de
    // n'importe quoi. Le téléversement passe donc par le serveur, après que
    // la qualité de capitaine a été établie depuis la session.
    expect(logosMigration).not.toMatch(/create policy/);
    expect(code(read("src/lib/super-teams/logo-storage.ts"))).toMatch(
      /createAdminClient/,
    );
  });

  it("le fichier part avant l’écriture de la ligne, et pas l’inverse", () => {
    // Un fichier orphelin coûte quelques centaines de kilo-octets ; une
    // équipe enregistrée sans son visuel coûte un capitaine qui croit avoir
    // fini.
    const setLogo = appearance.slice(
      appearance.indexOf("export async function setOwnTeamLogo"),
      appearance.indexOf("export async function clearOwnTeamLogo"),
    );

    expect(setLogo.indexOf("uploadLogo")).toBeLessThan(
      setLogo.indexOf(".update({"),
    );
  });

  it("refuse un fichier trop lourd, avec une phrase actionnable", () => {
    const refusal = checkLogo({ size: 5 * 1024 * 1024, type: "image/png" });

    expect(refusal.ok).toBe(false);
    expect(refusal.ok === false && refusal.message).toMatch(/2 Mo/);
    expect(refusal.ok === false && refusal.message).toMatch(/Réduisez/);
  });

  it("refuse un format non accepté, et un fichier vide", () => {
    expect(checkLogo({ size: 1000, type: "image/gif" }).ok).toBe(false);
    expect(checkLogo({ size: 0, type: "image/png" }).ok).toBe(false);
  });

  it("accepte les trois formats attendus", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(checkLogo({ size: 1000, type }).ok, type).toBe(true);
    }
  });
});

describe("une équipe sans logo n’affiche jamais un trou", () => {
  it("les initiales viennent du nom, accents compris", () => {
    expect(logoInitials("Table de Barran")).toBe("TB");
    expect(logoInitials("Élan")).toBe("É");
    expect(logoInitials("les moustachus")).toBe("LM");
  });

  it("et un nom sans lettre ne casse pas l’écran", () => {
    expect(logoInitials("   ")).toBe("?");
    expect(logoInitials("!!!")).toBe("?");
  });
});

/* -------------------------------------------------------------------------
 * La modération
 * ---------------------------------------------------------------------- */

describe("la modération se fait après coup, et se finit", () => {
  it("chaque dépôt laisse une trace de son auteur", () => {
    // C'est ce qui rend le retrait possible sans enquête.
    expect(logosMigration).toMatch(/add column logo_uploaded_by uuid/);
    expect(logosMigration).toMatch(/add column logo_uploaded_at timestamptz/);
    expect(appearance).toMatch(/logo_uploaded_by: profileId/);
  });

  it("un nouveau logo repasse dans la file, même sur une équipe déjà relue", () => {
    // Une équipe relue n'est pas une image relue.
    expect(appearance).toMatch(/logo_reviewed_at: null/);
  });

  it("les logos non relus passent devant", () => {
    // Une liste sans marqueur est une liste qu'on relit en entier chaque
    // jour, donc qu'on cesse de relire au bout de trois.
    expect(moderation).toMatch(
      /if \(!left\.reviewedAt && right\.reviewedAt\) return -1;/,
    );
  });

  it("le retrait prévient le capitaine et lui laisse la porte ouverte", () => {
    // Un retrait silencieux se transforme en soupçon de panne, et le
    // capitaine redépose le même fichier.
    const remove = moderation.slice(
      moderation.indexOf("export async function removeLogoAsAdmin"),
    );

    expect(remove).toMatch(/notify\(/);
    expect(remove).toMatch(/envoyer un autre/);
  });

  it("et il ne touche ni à l’équipe, ni à ses membres, ni à ses points", () => {
    const remove = moderation.slice(
      moderation.indexOf("export async function removeLogoAsAdmin"),
    );

    expect(remove).not.toMatch(/\.delete\(\)/);
    expect(remove).not.toMatch(/team_members/);
  });
});

describe("chaque geste de l’organisation est journalisé", () => {
  it("les cinq gestes sur une super-équipe", () => {
    for (const action of [
      "super_team.created",
      "super_team.team_attached",
      "super_team.team_detached",
      "super_team.captain_assigned",
      "super_team.deleted",
    ]) {
      expect(manageActions, action).toContain(action);
    }
  });

  it("et le retrait d’un logo", () => {
    expect(code(read("src/lib/super-teams/moderation-actions.ts"))).toContain(
      "logo.removed",
    );
  });
});

describe("le détachement dit ce qu’il fait, et ce qu’il ne fait pas", () => {
  it("la confirmation nomme ce que l’équipe garde", () => {
    // La seconde moitié est celle qui compte : un administrateur qui n'ose
    // pas détacher une équipe appelle le PO à la place.
    const form = read("src/components/super-teams/super-team-admin.tsx");

    expect(form).toMatch(/classement interne/);
    expect(form.replace(/\s+/g, " ")).toMatch(
      /Elle garde ses membres, ses points et son rang au classement général/,
    );
  });

  it("et le message du serveur le répète", () => {
    expect(manageActions).toMatch(
      /Elle garde ses membres, ses points et son rang au classement général/,
    );
  });
});
