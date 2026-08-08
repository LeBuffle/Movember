import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Accessibilité (story 11.7)
 *
 * La revue est faite une fois ; **ces tests sont ce qui empêche de la
 * défaire**. Un audit d'accessibilité qui n'est pas outillé est un audit
 * qu'un écran ajouté en octobre annule sans que personne le remarque.
 *
 * Ce que ces tests ne remplacent pas : un passage au clavier et au lecteur
 * d'écran sur l'appareil du PO. Ils couvrent les défauts qu'une machine sait
 * voir — pas la lisibilité d'une phrase ni l'ordre logique d'un écran.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Every screen and every component, found rather than listed.
 *
 * A hand-kept list is a list that stops covering the screen added in October
 * — which is precisely the screen nobody reviewed.
 */
function tsxFilesUnder(directory: string): string[] {
  return readdirSync(path.join(root, directory), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((entry) => entry.endsWith(".tsx"))
    .map((entry) =>
      path.posix.join(directory, entry.split(path.sep).join("/")),
    );
}

const all = [...tsxFilesUnder("src/app"), ...tsxFilesUnder("src/components")];

describe("la structure des pages", () => {
  it("la langue est déclarée une fois, en français", () => {
    // Sans elle, un lecteur d'écran lit du français avec une prononciation
    // anglaise — techniquement conforme, et inécoutable.
    expect(read("src/app/layout.tsx")).toMatch(/<html lang="fr">/);
  });

  it("un lien d’évitement précède tout le reste", () => {
    // Trente jours de novembre, et chaque matin le même bandeau à traverser
    // avant d'atteindre le défi du jour.
    const layout = read("src/app/layout.tsx");

    expect(layout).toMatch(/href="#contenu"/);
    expect(layout).toMatch(/sr-only focus:not-sr-only/);
    // Premier élément du corps : un lien d'évitement placé après le contenu
    // n'évite rien.
    expect(layout.indexOf('href="#contenu"')).toBeLessThan(
      layout.indexOf("{children}"),
    );
  });

  it("et chaque repère principal porte sa cible", () => {
    // Un lien d'évitement qui pointe vers un identifiant absent renvoie en
    // haut de page : le défaut est invisible et le lien est décoratif.
    const withMain = all.filter((file) => code(read(file)).includes("<main"));

    expect(withMain.length).toBeGreaterThan(5);

    for (const file of withMain) {
      // `[^>]*` plutôt qu'un espace : Prettier passe l'attribut à la ligne dès
      // que la balise porte des classes.
      expect(code(read(file)), file).toMatch(/<main\b[^>]*id="contenu"/);
    }
  });
});

describe("les images", () => {
  it("portent toutes un texte de remplacement", () => {
    // `alt=""` est une réponse valide — une image décorative doit être
    // ignorée. Ce qui est refusé, c'est l'absence d'attribut.
    for (const file of all) {
      const source = code(read(file));

      for (const tag of source.match(/<(?:Image|img)\s[^>]*>/g) ?? []) {
        expect(tag, `${file} — ${tag.slice(0, 80)}`).toMatch(/\salt=/);
      }
    }
  });
});

describe("les champs de formulaire", () => {
  /**
   * Un champ est étiqueté de trois façons acceptables, et d'aucune autre :
   * un `htmlFor` qui cite son identifiant, une étiquette qui l'entoure, ou
   * un `aria-label`. Sans l'une des trois, le lecteur d'écran n'annonce que
   * « zone de texte » — et le champ existe sans que personne sache pour quoi.
   */
  function isLabelled(source: string, tag: string, at: number): boolean {
    if (/aria-label|aria-labelledby/.test(tag)) return true;

    const id = tag.match(/\sid=(?:"([^"]+)"|\{([^}]+)\})/);

    if (id) {
      const name = id[1] ?? id[2]!;
      const quoted = id[1] ? `htmlFor="${name}"` : `htmlFor={${name.trim()}}`;
      if (source.includes(quoted)) return true;
    }

    // Une étiquette qui l'entoure : le dernier `<label` avant le champ n'est
    // pas encore refermé.
    const before = source.slice(0, at);
    const opened = before.lastIndexOf("<label");
    return opened !== -1 && before.lastIndexOf("</label>") < opened;
  }

  it("portent tous une étiquette", () => {
    const offenders: string[] = [];

    for (const file of all) {
      const source = code(read(file));
      const pattern = /<input\s[^>]*>/g;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(source)) !== null) {
        const tag = match[0];

        // Un champ caché ne s'annonce pas : il n'a rien à étiqueter.
        if (/type="hidden"/.test(tag)) continue;
        if (isLabelled(source, tag, match.index)) continue;

        offenders.push(`${file} — ${tag.replace(/\s+/g, " ").slice(0, 70)}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("et le composant partagé lie étiquette, indication et erreur", () => {
    // Ce qui vaut mieux que de le refaire à la main sur chaque écran.
    const input = code(read("src/components/ui/input.tsx"));

    expect(input).toMatch(/htmlFor=\{inputId\}/);
    expect(input).toMatch(/aria-describedby=/);
    expect(input).toMatch(/aria-invalid=/);
  });
});

describe("les boutons et les liens ne sont pas interchangeables", () => {
  it("aucun `div` ni `span` ne porte un clic", () => {
    // Un `div` cliquable n'est pas atteignable au clavier, ne s'annonce pas
    // comme un bouton, et ne réagit pas à la barre d'espace. C'est la
    // première cause d'inaccessibilité d'une interface moderne.
    for (const file of all) {
      const source = code(read(file));

      for (const tag of source.match(/<(?:div|span|li)\s[^>]*>/g) ?? []) {
        expect(tag, `${file} — ${tag.slice(0, 60)}`).not.toMatch(/onClick=/);
      }
    }
  });
});

describe("ce qui change tout seul est annoncé", () => {
  it("les messages d’état portent un rôle", () => {
    // Un message qui apparaît sans être annoncé n'existe pas pour qui
    // n'écoute pas l'écran. `alert` est réservé aux erreurs, qui
    // interrompent ; le reste est annoncé poliment.
    const alert = code(read("src/components/ui/alert.tsx"));

    expect(alert).toMatch(/role=\{tone === "danger" \? "alert" : "status"\}/);
  });

  it("et la couleur ne porte jamais seule le sens", () => {
    // Un bandeau rouge et un bandeau vert sont le même bandeau pour huit
    // pour cent des hommes — et ce jeu s'adresse d'abord à des hommes.
    const alert = code(read("src/components/ui/alert.tsx"));

    expect(alert).toMatch(/toneLabels/);
    expect(alert).toMatch(/{title \?\? toneLabels\[tone\]}/);
  });
});

describe("les tableaux", () => {
  it("déclarent la portée de leurs en-têtes", () => {
    // Sans `scope`, un lecteur d'écran lit une grille de nombres sans dire de
    // quelle colonne ils viennent. Le back-office en est fait.
    for (const file of all) {
      const source = code(read(file));
      if (!source.includes("<th")) continue;

      for (const tag of source.match(/<th\s[^>]*>/g) ?? []) {
        expect(tag, `${file} — ${tag.slice(0, 60)}`).toMatch(
          /scope="(col|row)"/,
        );
      }
    }
  });
});

describe("la cible tactile", () => {
  it("les boutons gardent une hauteur confortable au doigt", () => {
    // Le jeu se joue sur un téléphone, debout, souvent après une sortie. Un
    // bouton de vingt-quatre pixels se rate.
    const button = code(read("src/components/ui/button.tsx"));

    expect(button).toMatch(/min-h-9/);
    expect(button).toMatch(/min-h-11/);
  });

  it("et la barre d’onglets ne masque pas la dernière ligne", () => {
    // Le défaut classique d'une barre flottante, et celui qui la fait
    // détester.
    const shell = code(read("src/components/layout/participant-shell.tsx"));

    expect(shell).toMatch(/pb-32/);
  });
});
