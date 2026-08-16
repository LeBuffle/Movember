import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { escapeCsvField, exportFilename, toCsv } from "@/lib/shipping/export";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const migration = readFileSync(
  path.join(root, "supabase/migrations/20260805100000_shipping_addresses.sql"),
  "utf8",
);

const sql = migration.replace(/--.*$/gm, "");

/* =========================================================================
 * L'adresse postale est la donnée la plus personnelle du projet
 *
 * Un pseudonyme et un temps de course, c'est une chose ; un nom et une rue en
 * sont une autre. Tout ce qui suit en découle.
 * ====================================================================== */

describe("le schéma des adresses", () => {
  it("vit dans sa propre table", () => {
    // Pas des colonnes sur le profil : lire un participant ne doit jamais
    // vouloir dire lire son adresse, et l'effacer doit tenir en une ligne.
    expect(sql).toMatch(/create table public\.shipping_addresses/);
  });

  it("disparaît avec le compte, sans que personne ait à y penser", () => {
    expect(sql).toMatch(
      /profile_id[\s\S]{0,120}references public\.profiles \(id\) on delete cascade/,
    );
  });

  it("protège les lignes", () => {
    expect(sql).toMatch(
      /alter table public\.shipping_addresses enable row level security/,
    );
  });

  it("n’autorise personne à lire l’adresse d’un autre", () => {
    // Chaque instruction complète, jusqu'au point-virgule : c'est la clause
    // `using` qui décide, et elle vient après le verbe.
    const policies = [
      ...sql.matchAll(/create\s+policy\s+"([^"]+)"[\s\S]*?;/gi),
    ];

    expect(policies.length).toBeGreaterThanOrEqual(5);

    const participantPolicies = policies.filter(([, name]) =>
      name.includes("participants"),
    );

    expect(participantPolicies.length).toBe(4);
    for (const [block] of participantPolicies) {
      expect(block).toMatch(/auth\.uid\(\)\) = profile_id/);
    }
  });

  it("laisse les administrateurs lire, jamais écrire", () => {
    // Une adresse corrigée par un organisateur plutôt que par la personne
    // concernée est une adresse dont personne ne répond.
    const adminPolicies = [
      ...sql.matchAll(
        /create\s+policy\s+"admins[^"]*"[\s\S]*?on public\.shipping_addresses for (\w+)/gi,
      ),
    ].map((match) => match[1].toLowerCase());

    expect(adminPolicies).toEqual(["select"]);
  });

  it("laisse le participant effacer la sienne sans quitter le jeu", () => {
    // Le droit à l'effacement ne doit pas se payer d'un abandon.
    expect(sql).toMatch(
      /create policy "participants erase their own address"[\s\S]*?for delete/i,
    );
  });

  it("n’en garde qu’une par personne et par édition", () => {
    expect(sql).toMatch(/unique \(profile_id, edition_id\)/);
  });

  it("laisse le tarif déclarer s’il y a quelque chose à poster", () => {
    // « Les niveaux deux et trois » est vrai aujourd'hui et cesse de l'être
    // dès qu'un niveau est ajouté ou réordonné — sans que rien ne le dise.
    expect(sql).toMatch(/add column if not exists requires_shipping/);
  });
});

describe("le formulaire d’adresse", () => {
  const address = code("src/lib/shipping/address.ts");

  it("n’impose aucun format d’adresse", () => {
    // Le marché est la France et l'UE. Une expression régulière refuserait un
    // lieu-dit sans numéro, une BP, un code postal belge — des adresses que
    // La Poste traite sans difficulté.
    expect(address).not.toMatch(/\^\\d\{5\}\$/);
    expect(address).not.toMatch(/regex\([^)]*postal/i);
  });

  it("passe par la session du participant, pas par la clé de service", () => {
    expect(address).not.toMatch(/createAdminClient/);
    expect(code("src/lib/shipping/actions.ts")).not.toMatch(
      /createAdminClient/,
    );
  });

  it("ne demande rien à qui n’a rien à recevoir", () => {
    // Collecter des adresses dont on n'a pas l'usage est exactement ce que la
    // minimisation interdit.
    expect(address).toMatch(/requires_shipping/);
    expect(address).toMatch(/status !== "active"/);
  });

  it("ne bloque jamais le jeu", () => {
    // La médaille est une contrepartie, pas un ticket d'entrée.
    const layout = code("src/app/(participant)/jeu/layout.tsx");

    expect(layout).not.toMatch(/shipping|adresse/i);
  });
});

/* ---------------------------------------------------------------------------
 * L'export
 * ------------------------------------------------------------------------ */

describe("l’export des livraisons", () => {
  const row = {
    tierName: "Sportif chevronné",
    displayName: "Moustache42",
    recipientName: "Jean Dupont",
    line1: "12 rue des Lilas",
    line2: "",
    postalCode: "67000",
    city: "Strasbourg",
    country: "FR",
  };

  it("protège une virgule dans une ville", () => {
    // Sans cela, « Saint-Denis, La Réunion » couperait la ligne en deux.
    expect(escapeCsvField("Saint-Denis, La Réunion")).toBe(
      '"Saint-Denis, La Réunion"',
    );
  });

  it("protège un guillemet", () => {
    expect(escapeCsvField('L"Hôpital')).toBe('"L""Hôpital"');
  });

  it.each(["=1+1", "+33612345678", "-12 rue", "@nom"])(
    "neutralise un champ commençant par %s",
    (value) => {
      // Un tableur évalue ces débuts de champ comme des formules. Un fichier
      // qui exécute du code à l'ouverture est une vraie façon de perdre une
      // machine — et celui-ci sera ouvert par un bénévole.
      expect(escapeCsvField(value)).toBe(`"'${value}"`);
    },
  );

  it("écrit un fichier qu’Excel lit sans accents cassés", () => {
    const csv = toCsv([row]);

    // Sans marque d'ordre d'octets, Excel sous Windows lit l'UTF-8 comme du
    // Latin-1 : « Strasbourg » passe, « chevronné » non.
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
  });

  it("porte un en-tête en français", () => {
    const [header] = toCsv([row]).replace("﻿", "").split("\r\n");

    expect(header).toContain('"Destinataire"');
    expect(header).toContain('"Code postal"');
    expect(header).not.toMatch(/[a-z]+_[a-z]+/);
  });

  it("contient l’adresse, une ligne par colis", () => {
    const lines = toCsv([row, row]).trim().split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Jean Dupont"');
    expect(lines[1]).toContain('"67000"');
  });

  it("nomme le fichier de façon datée", () => {
    expect(exportFilename(2026, "2026-11-30")).toBe(
      "livraisons-2026-2026-11-30.csv",
    );
  });
});

describe("la route de téléchargement", () => {
  const route = code("src/app/(admin)/admin/livraisons/export/route.ts");

  it("revérifie le rôle, parce qu’aucune mise en page ne le fait ici", () => {
    // Le garde qui protège chaque *page* du back-office est dans le layout,
    // et un gestionnaire de route n'en a pas au-dessus de lui. L'oublier
    // publierait l'adresse de chaque participant à qui devine l'adresse.
    expect(route).toMatch(/requireAdmin\(\)/);
    expect(route).toMatch(/status:\s*404/);
  });

  it("n’est mise en cache nulle part", () => {
    expect(route).toMatch(/no-store/);
    expect(route).toMatch(/private/);
  });

  it("arrive comme une pièce jointe", () => {
    // Ouvert dans un onglet, un fichier d'adresses finit dans l'historique
    // d'une machine partagée.
    expect(route).toMatch(/Content-Disposition[\s\S]{0,40}attachment/);
  });
});
