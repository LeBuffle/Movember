import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ADMIN_SECTIONS, findAdminSection } from "@/lib/admin/sections";
import { requiresAdmin } from "@/lib/auth/routes";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

/** Strips comments so prose explaining a rule never counts as breaking it. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const migrations = readdirSync(path.join(root, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => read(`supabase/migrations/${f}`))
  .join("\n")
  .replace(/--.*$/gm, "");

/* =========================================================================
 * Protection de l'accès
 *
 * Trois couches, et le test vérifie que les trois existent. Masquer un lien
 * dans un menu n'en est pas une (architecture §8.1).
 * ====================================================================== */

describe("l’accès au back-office est refusé en dehors du rôle admin", () => {
  it("le middleware reconnaît /admin comme réservé", () => {
    expect(requiresAdmin("/admin")).toBe(true);
    expect(requiresAdmin("/admin/defis")).toBe(true);
    expect(requiresAdmin("/mon-compte")).toBe(false);
  });

  it("la mise en page vérifie le rôle côté serveur", () => {
    // Deuxième couche. Le middleware est une règle de routage : une
    // modification de son filtre le désactiverait sans bruit.
    const layout = stripComments(read("src/app/(admin)/admin/layout.tsx"));

    expect(layout).toMatch(/requireAdmin\(\)/);
    expect(layout).toMatch(/notFound\(\)/);
  });

  it("le refus ne révèle pas que /admin existe", () => {
    // Ni redirection vers la connexion, ni « accès refusé » : les deux
    // confirment l'existence de la section à qui la cherche. Un 404 ne dit
    // rien du tout.
    const layout = stripComments(read("src/app/(admin)/admin/layout.tsx"));

    expect(layout).not.toMatch(/redirect\(/);
    expect(layout).not.toMatch(/accès refusé|non autorisé|forbidden/i);
  });

  it("la garde serveur lit le rôle en base, pas dans un jeton", () => {
    const guard = stripComments(read("src/lib/admin/guard.ts"));

    // getSession() fait confiance au cookie, que le client peut forger.
    expect(guard).toMatch(/getUser\(\)/);
    expect(guard).not.toMatch(/getSession\(/);
    expect(guard).toMatch(/from\("profiles"\)/);
    // Garde contre une fuite de la clé de service côté navigateur.
    expect(guard).toMatch(/^import "server-only";/m);
  });
});

/* =========================================================================
 * Journal des actions administratives
 * ====================================================================== */

describe("le journal des actions est en écriture seule", () => {
  const auditPolicies = [
    ...migrations.matchAll(
      /create\s+policy[\s\S]*?on\s+public\.admin_audit_log\s+for\s+(\w+)/gi,
    ),
  ].map((match) => match[1].toLowerCase());

  it("est créé avec la sécurité au niveau des lignes", () => {
    expect(migrations).toMatch(/create\s+table\s+public\.admin_audit_log/i);
    expect(migrations).toMatch(
      /alter\s+table\s+public\.admin_audit_log\s+enable\s+row\s+level\s+security/i,
    );
  });

  it("n’autorise que la lecture et l’insertion", () => {
    // Un journal qui peut être corrigé après coup ne vaut rien le jour où on
    // en a besoin — y compris corrigé par un administrateur.
    expect(auditPolicies.sort()).toEqual(["insert", "select"]);
    expect(auditPolicies).not.toContain("update");
    expect(auditPolicies).not.toContain("delete");
    expect(auditPolicies).not.toContain("all");
  });

  it("interdit d’écrire sous le nom de quelqu’un d’autre", () => {
    const insertPolicy = migrations.match(
      /create\s+policy[\s\S]*?on\s+public\.admin_audit_log\s+for\s+insert[\s\S]*?;/i,
    )?.[0];

    expect(insertPolicy).toBeDefined();
    expect(insertPolicy).toMatch(/is_admin\(\)/);
    expect(insertPolicy).toMatch(/admin_id\s*=\s*\(select\s+auth\.uid\(\)\)/i);
  });

  it("réserve la lecture aux administrateurs", () => {
    const selectPolicy = migrations.match(
      /create\s+policy[\s\S]*?on\s+public\.admin_audit_log\s+for\s+select[\s\S]*?;/i,
    )?.[0];

    expect(selectPolicy).toMatch(/is_admin\(\)/);
    expect(selectPolicy).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("survit à la suppression du compte qui l’a écrit", () => {
    // `cascade` ou `set null` effaceraient la trace en supprimant le compte.
    expect(migrations).toMatch(
      /admin_id[\s\S]{0,120}references\s+public\.profiles\s*\(\s*id\s*\)\s+on\s+delete\s+restrict/i,
    );
  });
});

describe("l’utilitaire de journalisation", () => {
  const audit = stripComments(read("src/lib/admin/audit.ts"));

  it("ne laisse pas choisir l’auteur de l’entrée", () => {
    // `admin_id` est lu dans la session, jamais reçu en paramètre : il n'y a
    // donc aucun moyen de passer celui d'un autre.
    expect(audit).toMatch(/admin_id:\s*user\.id/);
    expect(audit).not.toMatch(/adminId[?]?:/);
  });

  it("écrit avec la session de l’administrateur, pas la clé de service", () => {
    // La clé de service contourne la sécurité au niveau des lignes : les
    // deux garanties de la politique d'insertion tomberaient.
    expect(audit).toMatch(/from "@\/lib\/supabase\/server"/);
    expect(audit).not.toMatch(/supabase\/admin/);
  });

  it("ne fait pas échouer l’action quand la journalisation échoue", () => {
    expect(audit).toMatch(/Promise<boolean>/);
    expect(audit).not.toMatch(/throw\s+new/);
  });
});

/* =========================================================================
 * Coquille
 * ====================================================================== */

describe("les sections du back-office", () => {
  it("couvrent les huit domaines prévus", () => {
    expect(ADMIN_SECTIONS.map((s) => s.slug).sort()).toEqual([
      "actualites",
      "arbitrage",
      "cartes",
      "collecte",
      "defis",
      "equipes",
      "notifications",
      "participants",
    ]);
  });

  it("annoncent toutes le lot qui apportera leur écran", () => {
    for (const section of ADMIN_SECTIONS) {
      expect(section.epic).toMatch(/^epic \d+$/);
      expect(section.description.length).toBeGreaterThan(20);
    }
  });

  it("ont un identifiant unique", () => {
    const slugs = ADMIN_SECTIONS.map((s) => s.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("se retrouvent par identifiant, et rien d’autre", () => {
    expect(findAdminSection("defis")?.label).toBe("Défis");
    expect(findAdminSection("nimportequoi")).toBeUndefined();
  });

  it("sont servies par un emplacement unique, pas huit pages jumelles", () => {
    expect(
      existsSync(path.join(root, "src/app/(admin)/admin/[section]/page.tsx")),
    ).toBe(true);
  });

  it("renvoient un 404 sur un identifiant inconnu", () => {
    const page = stripComments(
      read("src/app/(admin)/admin/[section]/page.tsx"),
    );

    expect(page).toMatch(/if\s*\(!section\)\s*\{?\s*notFound\(\)/);
  });
});

describe("le back-office est utilisable sur un téléphone", () => {
  // Le fichier explique en commentaire ce qu'il évite — « burger », « menu à
  // déplier » — et citerait donc les termes recherchés.
  const nav = stripComments(read("src/components/admin/admin-nav.tsx"));

  it("n’enferme pas la navigation derrière un menu à ouvrir", () => {
    // Un menu à déplier coûte un geste à chaque navigation et dépend du
    // JavaScript. L'équipe animera depuis son téléphone, par créneaux
    // courts (AC 6, et le critère de l'epic 8).
    expect(nav).toMatch(/flex-wrap/);
    expect(nav).not.toMatch(/useState|<details|burger/i);
  });

  it("garde des cibles tactiles confortables", () => {
    expect(nav).toMatch(/min-h-11/);
  });

  it("annonce la section ouverte autrement que par la couleur", () => {
    expect(nav).toMatch(/aria-current/);
  });
});
