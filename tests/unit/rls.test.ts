import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Structural guard over the SQL migrations.
 *
 * Row level security is the project's last line of defence: a bug in a page
 * must not be able to expose another participant's activities, e-mail or
 * postal address. The danger is not getting a policy wrong — it is *adding a
 * table and forgetting the policies entirely*, which produces no error and
 * no visible symptom until data leaks.
 *
 * These tests read the real migration files, so the rule applies to every
 * table added from now on, in any epic, without anyone having to remember it.
 */

const MIGRATIONS_DIR = path.join(
  import.meta.dirname,
  "../../supabase/migrations",
);

function readMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

/** Strips comments so commented-out SQL never counts as real. */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
}

const sql = stripComments(readMigrations());

function createdTables(): string[] {
  const matches = sql.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi,
  );
  return [...matches].map((m) => m[1]);
}

function tablesWithRls(): string[] {
  const matches = sql.matchAll(
    /alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi,
  );
  return [...matches].map((m) => m[1]);
}

describe("migrations", () => {
  it("exist and create at least one table", () => {
    expect(createdTables().length).toBeGreaterThan(0);
  });

  it("create the tables the initial schema is meant to create", () => {
    expect(createdTables()).toEqual(
      expect.arrayContaining(["editions", "profiles"]),
    );
  });
});

describe("every public table enables row level security", () => {
  const tables = createdTables();
  const protectedTables = new Set(tablesWithRls());

  it.each(tables)("%s", (table) => {
    expect(
      protectedTables.has(table),
      `La table public.${table} est créée sans "alter table public.${table} enable row level security". ` +
        `Toute table ajoutée doit activer la sécurité au niveau des lignes dans la migration qui la crée.`,
    ).toBe(true);
  });
});

describe("personne ne peut écrire une inscription ni un paiement", () => {
  // La faille la plus évidente de tout l'epic 2 : un participant capable
  // d'insérer sa propre inscription s'inscrirait sans payer. Ces lignes sont
  // écrites par le webhook Stripe, côté serveur, avec la clé de service — qui
  // contourne ces règles par construction. Tout le reste ne fait que lire.
  const writeVerbs = ["insert", "update", "delete", "all"];

  it.each(["registrations", "payments"])(
    "aucune règle d’écriture sur %s",
    (table) => {
      const policies = [
        ...sql.matchAll(
          new RegExp(
            `create\\s+policy[\\s\\S]*?on\\s+public\\.${table}\\s+for\\s+(\\w+)`,
            "gi",
          ),
        ),
      ].map((m) => m[1].toLowerCase());

      expect(policies.length).toBeGreaterThan(0);
      for (const verb of writeVerbs) {
        expect(
          policies,
          `public.${table} porte une règle "${verb}". Ces lignes ne doivent être écrites que côté serveur.`,
        ).not.toContain(verb);
      }
    },
  );

  it("les niveaux d’inscription restent lisibles sans session", () => {
    // La page d'accueil affiche les prix à des visiteurs non connectés.
    expect(sql).toMatch(
      /create\s+policy[\s\S]*?on\s+public\.registration_tiers\s+for\s+select[\s\S]*?using\s*\(\s*true\s*\)/i,
    );
  });

  it("une personne ne peut s’inscrire qu’une fois par édition", () => {
    // Garanti par la base : deux requêtes simultanées passeraient toutes les
    // deux un `select` de vérification dans le code.
    expect(sql).toMatch(/unique\s*\(\s*profile_id\s*,\s*edition_id\s*\)/i);
  });

  it("un webhook rejoué ne peut pas créer deux lignes comptables", () => {
    // Stripe renvoie tout ce qui n'a pas répondu en quelques secondes.
    expect(sql).toMatch(/unique\s*\(\s*stripe_session_id\s*\)/i);
    expect(sql).toMatch(/unique\s*\(\s*stripe_payment_intent_id\s*\)/i);
  });
});

describe("security definer functions pin their search path", () => {
  // A `security definer` function without `set search_path` can be hijacked:
  // a schema earlier in the path can shadow the tables it references, and the
  // function then operates on the attacker's tables with elevated rights.
  it("no security definer function omits set search_path", () => {
    const functions = [
      ...sql.matchAll(
        /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)[\s\S]*?\$\$/gi,
      ),
    ];

    const offenders = functions
      .filter((match) => /security\s+definer/i.test(match[0]))
      .filter((match) => !/set\s+search_path\s*=/i.test(match[0]))
      .map((match) => match[1]);

    expect(offenders).toEqual([]);
  });
});

describe("profiles never exposes e-mail addresses to other participants", () => {
  it("has no policy letting authenticated users read any profile row", () => {
    // The sanctioned way to read another participant is the public_profiles
    // view, which exposes three harmless columns. A blanket `using (true)`
    // select policy on `profiles` would hand out e-mail addresses instead.
    const profilePolicies = [
      ...sql.matchAll(
        /create\s+policy[\s\S]*?on\s+public\.profiles\s+for\s+select[\s\S]*?;/gi,
      ),
    ].map((m) => m[0]);

    expect(profilePolicies.length).toBeGreaterThan(0);

    const permissive = profilePolicies.filter((policy) =>
      /using\s*\(\s*true\s*\)/i.test(policy),
    );

    expect(permissive).toEqual([]);
  });

  it("provides the public_profiles view as the sanctioned alternative", () => {
    expect(sql).toMatch(/create\s+view\s+public\.public_profiles/i);
  });
});
