import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ESSENTIAL_CATEGORIES } from "@/lib/notifications/payload";
import { ALL_ON, channelFor } from "@/lib/notifications/preferences";

/* =========================================================================
 * Les préférences de notification (story 6.7)
 *
 * Une obligation autant qu'un confort : le droit d'opposition se traduit ici
 * par la désactivation par catégorie. Et « tout ou rien » pousserait quelqu'un
 * qu'une catégorie agace à tout couper — y compris le défi du jour, le seul
 * message dont le jeu dépend.
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

const migration = code(
  read("supabase/migrations/20260806190000_notification_preferences.sql"),
);
const preferences = code(read("src/lib/notifications/preferences.ts"));
const dispatch = code(read("src/lib/notifications/dispatch.ts"));
const form = code(read("src/components/notifications/preferences-form.tsx"));

const withDevice = { hasDevice: true, essential: true };
const noDevice = { hasDevice: false, essential: true };

describe("l'absence de préférences vaut acceptation", () => {
  it("tout est allumé par défaut", () => {
    // AC 4. Le contraire produirait des participants silencieusement privés
    // de leur défi du jour, sans que rien ne le montre.
    expect(ALL_ON.channelPush).toBe(true);
    expect(ALL_ON.channelEmail).toBe(true);
    expect(Object.values(ALL_ON.categories).every(Boolean)).toBe(true);
  });

  it("la base met les colonnes à vrai par défaut", () => {
    const columns = migration.match(/boolean not null default (\w+)/g) ?? [];

    expect(columns.length).toBeGreaterThanOrEqual(7);
    expect(columns.every((line) => line.endsWith("true"))).toBe(true);
  });

  it("une lecture en échec n'éteint personne", () => {
    // La panne qui compte ici est un participant qui n'entend plus parler du
    // jeu ; être notifié une fois contre son gré est un tort bien moindre.
    const region = preferences.slice(
      preferences.indexOf("export async function preferencesFor"),
    );

    expect(region).toMatch(/if \(error\)[\s\S]*?return map/);
  });
});

describe("le choix du canal", () => {
  it("respecte une catégorie coupée, quel que soit le canal", () => {
    // AC 1, 3.
    const off = {
      ...ALL_ON,
      categories: { ...ALL_ON.categories, defi_du_jour: false },
    };

    expect(channelFor(off, "defi_du_jour", withDevice)).toBe("none");
    expect(channelFor(off, "defi_du_jour", noDevice)).toBe("none");
  });

  it("ne coupe qu'elle", () => {
    // AC 5.
    const off = {
      ...ALL_ON,
      categories: { ...ALL_ON.categories, resultat: false },
    };

    expect(channelFor(off, "resultat", withDevice)).toBe("none");
    expect(channelFor(off, "defi_du_jour", withDevice)).toBe("push");
  });

  it("bascule sur l'e-mail quand le push est coupé", () => {
    // AC 2 : les deux canaux se désactivent indépendamment.
    const off = { ...ALL_ON, channelPush: false };

    expect(channelFor(off, "defi_du_jour", withDevice)).toBe("email");
  });

  it("n'envoie jamais les deux à la même personne", () => {
    // Un doublon n'est pas deux fois plus d'attention, c'est un défaut.
    expect(channelFor(ALL_ON, "defi_du_jour", withDevice)).toBe("push");
  });

  it("ne bascule en e-mail que pour les catégories essentielles", () => {
    // Architecture D6 : un e-mail par événement, ce serait jusqu'à 70 000 sur
    // le mois — et un défi validé ne vaut plus rien une heure après.
    expect(
      channelFor(ALL_ON, "resultat", { hasDevice: false, essential: false }),
    ).toBe("none");

    expect(ESSENTIAL_CATEGORIES).not.toContain("resultat");
    expect(ESSENTIAL_CATEGORIES).not.toContain("carte");
  });

  it("se tait quand les deux canaux sont coupés", () => {
    const off = { ...ALL_ON, channelPush: false, channelEmail: false };

    expect(channelFor(off, "defi_du_jour", withDevice)).toBe("none");
  });
});

describe("un seul endroit applique les préférences", () => {
  it("l'envoi passe par le répartiteur, pas directement par sendPush", () => {
    // AC 3. Une préférence contournée par un seul chemin ruine la garantie —
    // et le chemin qui contourne est toujours celui ajouté dans l'urgence.
    expect(dispatch).toMatch(/channelFor/);
    expect(dispatch).toMatch(/preferencesFor/);
    expect(dispatch).toMatch(/sendPush/);
  });

  it("le répartiteur range chaque participant dans un seul canal", () => {
    expect(dispatch).toMatch(/byChannel\[channel\]\.push\(profileId\)/);
  });

  it("il compte à part ceux qui relèveraient de l'e-mail", () => {
    // Pour que le chiffre dise « aurait été envoyé par e-mail » plutôt que de
    // se cacher dans « ignoré ».
    expect(dispatch).toMatch(/emailed/);
  });
});

describe("la table des préférences", () => {
  it("laisse le participant écrire la sienne", () => {
    // Contrairement à push_subscriptions juste à côté : ici chaque colonne
    // appartient au participant et ne veut dire que ce qu'il veut.
    expect(migration).toMatch(
      /create policy "participants write their own preferences"[\s\S]*?for insert/,
    );
    expect(migration).toMatch(
      /create policy "participants change their own preferences"[\s\S]*?for update/,
    );
  });

  it("n'autorise personne à écrire celle d'un autre", () => {
    const policies = migration.match(/with check \([^)]*\)\)/g) ?? [];

    expect(policies.length).toBeGreaterThan(0);
    expect(policies.every((policy) => policy.includes("auth.uid()"))).toBe(
      true,
    );
  });

  it("ne laisse pas l'organisation modifier une préférence", () => {
    // Une préférence changée par l'organisation serait le contraire d'un
    // droit d'opposition.
    const adminPolicy = migration.slice(
      migration.indexOf('create policy "admins read the preferences"'),
    );

    expect(adminPolicy).toMatch(/for select/);
    expect(adminPolicy).not.toMatch(/for update/);
  });

  it("n'offre aucune suppression", () => {
    // Supprimer la ligne rallumerait tout en silence.
    expect(migration).not.toMatch(/for delete/i);
  });

  it("active la sécurité au niveau des lignes", () => {
    expect(migration).toMatch(
      /alter table public\.notification_preferences enable row level security/,
    );
  });
});

describe("l'écran", () => {
  it("propose les cinq catégories, pas un interrupteur unique", () => {
    // AC 1.
    for (const category of [
      "defi_du_jour",
      "resultat",
      "carte",
      "annonce",
      "relance",
    ]) {
      expect(form).toMatch(new RegExp(category));
    }
  });

  it("fonctionne sans JavaScript", () => {
    // Des cases à cocher dans un formulaire ordinaire vers une action serveur.
    expect(form).toMatch(/type="checkbox"/);
    expect(form).toMatch(/<form action=\{formAction\}/);
    expect(form).not.toMatch(/onChange=\{[\s\S]{0,40}formAction/);
  });

  it("dit lesquelles ne partiront jamais par e-mail", () => {
    expect(form).toMatch(/jamais par e-mail/);
  });
});
