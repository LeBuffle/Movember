import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * L'identité visuelle
 *
 * **Le logo est une obligation autant qu'un habillage.** `CLAUDE.md` §5
 * interdit tout logo et tout visuel de la fondation Movember, et impose qu'un
 * visiteur ne puisse pas croire qu'il est sur l'application officielle. Ce
 * fichier tient les deux bouts : que le logo du projet soit bien là, et qu'il
 * soit dérivé de la source officielle plutôt que redessiné à la main.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

function sizeKo(relative: string): number {
  return statSync(path.join(root, relative)).size / 1024;
}

describe("les fichiers de marque", () => {
  it("dérivent tous d’une source unique, conservée dans le dépôt", () => {
    // Sans la source, un changement de logo redevient un travail d'image à la
    // main — et neuf fichiers qui doivent rester identiques entre eux finissent
    // toujours par diverger.
    expect(() => sizeKo("public/brand/logo-source.jpeg")).not.toThrow();
    expect(read("scripts/prepare-brand.mjs")).toMatch(/logo-source\.jpeg/);
  });

  it("existent dans les quatre déclinaisons que l’application utilise", () => {
    for (const file of [
      "public/brand/logo.png", // pleine résolution, source des dérivés
      "public/brand/marque.png", // sans le mot, pour les icônes
      "public/brand/logo-en-tete.png", // en-tête du site
      "public/brand/logo-web.png", // écrans de connexion et e-mails
    ]) {
      expect(sizeKo(file), file).toBeGreaterThan(1);
    }
  });

  it("et les tailles web restent légères", () => {
    // L'en-tête est chargé sur chaque page publique, y compris la page
    // d'accueil, qui est la plus visitée et celle vers laquelle mène un
    // partage. Un logo d'un tiers de mégaoctet s'y verrait.
    expect(sizeKo("public/brand/logo-en-tete.png")).toBeLessThan(40);
    expect(sizeKo("public/brand/logo-web.png")).toBeLessThan(150);
  });
});

describe("les icônes viennent de la marque, pas du logo entier", () => {
  const generator = read("scripts/generate-icons.mjs");

  it("l’icône n’embarque pas le mot « DÉFI »", () => {
    // Lue à 192 pixels sur un téléphone, l'inscription devient trois taches
    // grises qui mangent la place de ce qui reste reconnaissable — et le
    // système écrit le nom en dessous de toute façon.
    expect(generator).toMatch(
      /markFile = path\.join\(brandDir, "marque\.png"\)/,
    );
    expect(generator).toMatch(/logoFile = path\.join\(brandDir, "logo\.png"\)/);
  });

  it("elle est opaque : une icône transparente laisse voir le fond d’écran", () => {
    // Cette marque a de vrais trous, entre la moustache et le cercle.
    expect(generator).toMatch(/rgb\("#ffffff"\)/);
  });

  it("et la version masquable tient dans la zone que tous les lanceurs gardent", () => {
    // Android recadre à la forme de son lanceur ; seul le cercle centré de
    // 80 % de diamètre — rayon 204,8 sur une grille de 512 — y survit partout.
    expect(generator).toMatch(/MASKABLE_RADIUS = 204\.8/);
    expect(generator).toMatch(/STANDARD_RADIUS = \d+/);
  });

  it("la portée de l’encre est mesurée, pas supposée", () => {
    // La vérification naïve — « la boîte englobante tient-elle dans le cercle
    // sûr » — traite les coins de la boîte comme s'ils étaient dessinés. Ils ne
    // le sont pas : la marque est ronde, et s'y fier rétrécirait l'icône d'un
    // tiers pour rien.
    expect(generator).toMatch(/async function inkRadius/);
    expect(generator).toMatch(/Math\.hypot\(x - centreX, y - centreY\)/);
  });
});

describe("le logo est là où un visiteur en a besoin", () => {
  it("dans l’en-tête public, à côté du nom écrit", () => {
    // Le logo dit « DÉFI », le projet s'appelle « DEFI Movember » : c'est le
    // second qu'un visiteur doit pouvoir lire.
    const header = read("src/components/layout/site-header.tsx");

    expect(header).toMatch(/<Logo \/>/);
    expect(header).toMatch(/Movember/);
  });

  it("sur les écrans de connexion et d’inscription", () => {
    // On y arrive par un lien d'e-mail aussi souvent que depuis le site, et un
    // formulaire nu sans rien qui dise à qui il appartient a exactement la
    // forme d'une page d'hameçonnage.
    expect(read("src/components/auth/auth-form.tsx")).toMatch(
      /<Logo size="large"/,
    );
  });

  it("et dans le mail de bienvenue, en adresse absolue", () => {
    // Un e-mail se lit hors du site : un chemin relatif à rien ne résout rien.
    const templates = read("src/lib/email/templates.ts");

    expect(templates).toMatch(/absoluteUrl\("\/brand\/logo-web\.png"\)/);
    expect(templates).toMatch(/alt="DEFI Movember"/);
  });

  it("mais pas dans les notifications, qui ne chargent rien", () => {
    // Décision de la story 6.4, maintenue : ces e-mails partent souvent, et une
    // image bloquée par défaut en tête d'un rappel quotidien est du bruit.
    const templates = read("src/lib/email/templates.ts");
    const notification = templates.slice(
      templates.indexOf("export function notificationEmail"),
      templates.indexOf("export function welcomeEmail"),
    );

    expect(notification).not.toMatch(/logoHtml\(\)/);
  });
});

describe("l’identité reste celle du projet", () => {
  it("le texte de remplacement nomme le projet, pas l’image", () => {
    // Un lecteur d'écran qui annonce « logo » n'apprend rien à qui l'écoute.
    const logo = read("src/components/layout/logo.tsx");

    expect(logo).toMatch(/alt="DEFI Movember"/);
    expect(logo).not.toMatch(/alt="[Ll]ogo"/);
  });

  it("les dimensions sont écrites, pour que l’en-tête ne saute pas", () => {
    // Sans elles, l'en-tête se décale quand le logo arrive — à chaque
    // chargement à froid, c'est-à-dire au moment précis où quelqu'un décide
    // s'il fait confiance au site.
    const logo = read("src/components/layout/logo.tsx");

    expect(logo).toMatch(/width=\{source\.width\}/);
    expect(logo).toMatch(/height=\{source\.height\}/);
  });

  it("et rien n’emprunte à la fondation", () => {
    // CLAUDE.md §5. La contrainte est juridique avant d'être esthétique.
    for (const file of [
      "src/components/layout/logo.tsx",
      "src/components/layout/site-header.tsx",
      "scripts/prepare-brand.mjs",
    ]) {
      expect(read(file), file).not.toMatch(
        /movember-?foundation|logo officiel de la fondation/i,
      );
    }
  });
});
