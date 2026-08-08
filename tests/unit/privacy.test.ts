import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  NEVER_PURGED,
  purgeDueOn,
  RETENTION_RULES,
  retentionSummary,
} from "@/lib/privacy/retention";

/* =========================================================================
 * Conformité RGPD (stories 11.1, 11.2, 11.4)
 *
 * Les activités sportives disent quelque chose de la santé et des
 * déplacements d'une personne. Récupérer ses données, couper Strava et
 * effacer son compte ne sont pas des fonctionnalités : ce sont des
 * obligations, et elles doivent être atteignables **sans écrire à personne**.
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
    .replace(/--.*$/gm, "");
}

const exporter = code(read("src/lib/privacy/export.ts"));
const exportRoute = code(
  read("src/app/(participant)/mon-compte/donnees/export/route.ts"),
);
const deletion = code(read("src/lib/privacy/deletion.ts"));
const actions = code(read("src/lib/privacy/actions.ts"));
const screen = code(read("src/app/(participant)/mon-compte/donnees/page.tsx"));
const purge = code(read("src/lib/privacy/purge.ts"));
const migration = code(
  read("supabase/migrations/20260806280000_account_deletion.sql"),
);
const backup = read("deploy/scripts/backup-database.sh");
const crontab = read("deploy/crontab");

describe("l’export des données personnelles", () => {
  it("ne contient jamais un jeton d’accès", () => {
    // Ce serait remettre une clé vivante du compte Strava de quelqu'un, dans
    // un fichier qui finit dans un dossier Téléchargements.
    expect(exporter).not.toMatch(/access_token|refresh_token/);
  });

  it("passe par la session du participant, pas par la clé de service", () => {
    // La sécurité au niveau des lignes est ce qui garantit qu'on ne renvoie
    // que ses propres données. Une version à la clé de service avec un
    // identifiant de travers livrerait les données de santé d'un autre.
    expect(exporter).toMatch(/@\/lib\/supabase\/server/);
    expect(exporter).not.toMatch(/createAdminClient/);
  });

  it("couvre les activités, les défis, les cartes et les paiements", () => {
    for (const table of [
      "activities",
      "challenge_assignments",
      "card_grants",
      "payments",
      "activity_consents",
      "shipping_addresses",
    ]) {
      expect(exporter).toContain(`"${table}"`);
    }
  });

  it("dit dans le fichier ce qui n’y est pas", () => {
    // Un export muet sur ses absences se lit comme un export complet.
    expect(exporter).toMatch(/const NOTICE/);
    expect(exporter).toMatch(/chiffrés et/);
  });

  it("signale une section illisible au lieu de l’omettre", () => {
    // Renvoyer un fichier auquel il manque une section en silence est pire
    // que d'en renvoyer un qui le dit : le premier a l'air complet.
    expect(exporter).toMatch(/section illisible/);
  });

  it("la route revérifie l’identité : aucune mise en page ne la protège", () => {
    expect(exportRoute).toMatch(/if \(!data\) return new Response/);
    expect(exportRoute).toMatch(/status: 404/);
  });

  it("et le fichier n’est mis en cache nulle part", () => {
    expect(exportRoute).toMatch(/no-store/);
    expect(exportRoute).toMatch(/private/);
  });
});

describe("l’effacement du compte", () => {
  it("révoque Strava avant de supprimer quoi que ce soit", () => {
    // Supprimer notre côté en laissant l'autorisation vivante chez Strava est
    // le seul résultat que cette story ne doit jamais produire : on annonce
    // que les données sont parties, et Strava continue de répondre.
    const body = deletion.slice(
      deletion.indexOf("export async function deleteAccount"),
    );

    expect(body.indexOf("source.revoke")).toBeLessThan(
      body.indexOf("deleteUser"),
    );
  });

  it("et un refus de Strava annule tout", () => {
    expect(deletion).toMatch(/reason: "provider-unavailable"/);
  });

  it("neutralise le profil avant de supprimer l’utilisateur", () => {
    // Si la suppression échoue ensuite, le participant est déjà invisible
    // partout : tous les écrans filtrent sur `deleted_at`.
    const body = deletion.slice(
      deletion.indexOf("export async function deleteAccount"),
    );

    expect(body.indexOf("deleted_at:")).toBeLessThan(
      body.indexOf("deleteUser"),
    );
    expect(deletion).toMatch(/display_name: "Compte supprimé"/);
  });

  it("refuse un compte d’organisation, sans le cacher", () => {
    // Un journal dont l'auteur peut se retirer n'est pas un journal.
    expect(deletion).toMatch(/reason: "is-admin"/);
    expect(screen).toMatch(/Compte d’organisation/);
  });

  it("l’identité vient de la session, jamais du formulaire", () => {
    // Une action qui prendrait un identifiant de profil dans un champ soumis
    // serait un moyen d'effacer le compte d'un autre, et ressemblerait
    // exactement à celle-ci.
    expect(actions).toMatch(/auth\.getUser\(\)/);
    expect(actions).not.toMatch(/formData\.get\("profil|formData\.get\("id/);
  });

  it("la session est fermée après coup", () => {
    const body = actions.slice(
      actions.indexOf("export async function deleteMyAccount"),
    );

    expect(body.indexOf("deleteAccount(user.id)")).toBeLessThan(
      body.indexOf("signOut"),
    );
  });

  it("l’écran dit ce qui subsiste, pas seulement ce qui part", () => {
    // Un écran qui n'énumère que ce qu'il efface sera contredit par la
    // première personne qui demande où est passé son relevé bancaire.
    expect(screen).toMatch(/Ce qui subsiste/);
    expect(screen).toMatch(/lignes comptables/);
    expect(screen).toMatch(/ne vous rembourse pas/);
  });

  it("une capitainerie ne bloque pas l’effacement", () => {
    // `teams.captain_id` était en `on delete restrict` : la cascade entière
    // échouait. Le droit à l'effacement n'est pas négociable contre une
    // fonction dans une équipe.
    expect(migration).toMatch(/create trigger profiles_release_captaincy/);
    expect(migration).toMatch(/before delete on public\.profiles/);
  });

  it("et le pseudonyme peut être neutralisé, seulement à ce moment-là", () => {
    // L'exception au déclencheur de la story 1.13 est la plus étroite
    // possible : la transition qui pose `deleted_at`, une seule fois.
    expect(migration).toMatch(
      /old\.deleted_at is null and new\.deleted_at is not null/,
    );
  });
});

describe("la politique de conservation", () => {
  it("est écrite en un seul endroit, en français", () => {
    // Une durée écrite à deux endroits est une durée qui finira par se
    // contredire — et c'est la politique de confidentialité qui aura tort.
    expect(RETENTION_RULES.length).toBeGreaterThan(0);

    for (const rule of RETENTION_RULES) {
      expect(rule.reason.length).toBeGreaterThan(30);
      expect(rule.months).toBeGreaterThan(0);
    }
  });

  it("n’efface jamais la comptabilité ni le journal", () => {
    const tables = RETENTION_RULES.map((rule) => rule.table);

    expect(tables).not.toContain("payments");
    expect(tables).not.toContain("admin_audit_log");
    expect(NEVER_PURGED.map((entry) => entry.table)).toEqual([
      "payments",
      "admin_audit_log",
    ]);
  });

  it("efface l’adresse postale avant les activités", () => {
    // La donnée la plus personnelle du projet part la première.
    const address = RETENTION_RULES.find(
      (rule) => rule.table === "shipping_addresses",
    );
    const activities = RETENTION_RULES.find(
      (rule) => rule.table === "activities",
    );

    expect(address!.months).toBeLessThan(activities!.months);
  });

  it("ne purge rien avant l’échéance", () => {
    const rule = RETENTION_RULES[0]!;

    expect(purgeDueOn(rule, "2026-11-30", new Date("2026-12-01"))).toBeNull();
  });

  it("et purge à l’échéance, pas un mois plus tard", () => {
    const rule = { table: "t", months: 3, reason: "x".repeat(40) };

    expect(
      purgeDueOn(rule, "2026-11-30", new Date("2027-03-01")),
    ).not.toBeNull();
  });

  it("l’échéance ne déborde pas sur le mois suivant", () => {
    // 30 novembre + 3 mois : février n'a pas de 30. Sans le calage, l'échéance
    // tombait le 2 mars — deux jours de trop, et une date que personne ne peut
    // annoncer dans une politique de confidentialité.
    const rule = { table: "t", months: 3, reason: "x".repeat(40) };
    const due = purgeDueOn(rule, "2026-11-30", new Date("2027-06-01"));

    expect(due!.toISOString().slice(0, 10)).toBe("2027-02-28");
  });

  it("refuse de purger sans édition pour ancrer les délais", () => {
    // Une purge qui tournerait sur une date par défaut effacerait les données
    // d'une édition en cours.
    expect(purge).toMatch(/édition introuvable, aucune purge/);
    expect(purge).toMatch(/editionEndsOn: null, lines: \[\]/);
  });

  it("vide les jetons sans supprimer l’historique du lien", () => {
    // La ligne porte « relié tel jour, délié tel autre », que le participant
    // peut encore demander. Ce qui part, c'est la paire de jetons.
    expect(purge).toMatch(/access_token: ""/);
    expect(purge).toMatch(/refresh_token: ""/);
    expect(purge).not.toMatch(
      /from\("activity_connections"\)\s*\n?\s*\.delete\(\)/,
    );
  });

  it("le résumé est utilisable tel quel dans la politique", () => {
    expect(retentionSummary().length).toBe(
      RETENTION_RULES.length + NEVER_PURGED.length,
    );
  });

  it("la tâche est installée par le dépôt, pas à la main sur le serveur", () => {
    expect(crontab).toMatch(/api\/cron\/purge/);
  });
});

describe("les sauvegardes", () => {
  it("refusent de remplacer la dernière bonne par un dump vide", () => {
    // La façon classique de tout perdre : une sauvegarde cassée qui remplace
    // silencieusement la dernière bonne, chaque nuit, pendant un mois.
    expect(backup).toMatch(/MIN_BYTES/);
    expect(backup).toMatch(/la précédente est intacte/);
  });

  it("écrivent sous un nom temporaire avant de renommer", () => {
    expect(backup).toMatch(/\.partial/);
  });

  it("ne font la rotation qu’après un dump réussi", () => {
    expect(backup.indexOf('mv "$TEMP" "$TARGET"')).toBeLessThan(
      backup.indexOf("-mtime"),
    );
  });

  it("tournent avant la purge, pas après", () => {
    // Une sauvegarde prise après la purge serait la sauvegarde de l'état déjà
    // purgé : une purge à la mauvaise date deviendrait irrécupérable depuis
    // la sauvegarde censée la couvrir.
    const backupHour = Number(
      crontab.match(/^(\d+) (\d+) .*backup-database/m)![2],
    );
    const purgeHour = Number(crontab.match(/^(\d+) (\d+) .*cron\/purge/m)![2]);

    expect(backupHour).toBeLessThan(purgeHour);
  });

  it("le mot de passe de la base n’est jamais dans le dépôt", () => {
    // Il vit dans deploy/.env sur le serveur, en chmod 600.
    const example = read("deploy/.env.example");

    expect(example).toMatch(/^DATABASE_URL=$/m);

    for (const file of readdirSync(path.join(root, "deploy/scripts"))) {
      expect(read(`deploy/scripts/${file}`)).not.toMatch(
        /postgresql:\/\/[^"'\s]*:[^"'\s]+@/,
      );
    }
  });
});
