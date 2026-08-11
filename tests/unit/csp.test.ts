import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Politique de sécurité du contenu (story 1.2, corrigée le 11 août)
 *
 * **Le défaut qu'elle a produit est le pire genre : silencieux et
 * trompeur.** `img-src` n'autorisait que notre propre domaine. Les visuels
 * des cartes vivent chez Supabase — le navigateur refusait donc de les
 * charger, et l'image apparaissait cassée exactement comme si le
 * téléversement avait échoué. Il avait réussi.
 *
 * Pire : l'aperçu au moment de l'import fonctionnait, parce qu'il affiche le
 * fichier local (`blob:`). Tout allait bien jusqu'à l'enregistrement.
 *
 * Ces tests figent les deux points d'extension. Une politique resserrée par
 * inadvertance casserait de nouveau l'album sans casser un seul test — d'où
 * ce fichier.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

const compose = readFileSync(
  path.join(root, "deploy/docker-compose.yml"),
  "utf8",
);

const example = readFileSync(path.join(root, "deploy/.env.example"), "utf8");

const csp = compose.match(/Content-Security-Policy:\s*"([^"]+)"/)?.[1] ?? "";

/** Une directive de la politique, telle qu'elle sera envoyée. */
function directive(name: string): string {
  const found = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

  return found ?? "";
}

describe("la politique est bien posée", () => {
  it("existe et interdit par défaut", () => {
    expect(csp).not.toBe("");
    expect(directive("default-src")).toBe("default-src 'self'");
  });

  it("refuse l’encadrement et les greffons", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
  });
});

describe("les images", () => {
  it("acceptent une origine extérieure, réglable sans redéploiement", () => {
    // C'est le correctif du 11 août. Sans ce point d'extension, aucun visuel
    // de carte ne s'affiche, et le message d'erreur n'existe que dans la
    // console du navigateur.
    expect(directive("img-src")).toMatch(/\$\{CSP_IMG_SRC:-\}/);
  });

  it("laissent passer l’aperçu local et les images intégrées", () => {
    // `blob:` est l'aperçu au moment de l'import ; `data:` sert aux icônes
    // intégrées. Les retirer casserait le formulaire de carte.
    const images = directive("img-src");

    expect(images).toMatch(/\bblob:/);
    expect(images).toMatch(/\bdata:/);
  });

  it("et la variable est documentée avec son piège", () => {
    // Une variable vide qui casse l'album sans message est une variable qui
    // doit s'expliquer là où on la renseigne.
    expect(example).toMatch(/^CSP_IMG_SRC=$/m);
    // L'apostrophe est droite ou typographique selon les fichiers ; ce qui
    // compte est que le piège soit écrit, pas comment il est ponctué.
    expect(example).toMatch(/visuels des cartes ne s['’]affichent pas/);
  });
});

describe("les appels sortants", () => {
  it("gardent leur propre point d’extension", () => {
    // Supabase et Stripe. Séparé de `img-src` à dessein : autoriser une
    // origine à fournir des images n'est pas l'autoriser à recevoir des
    // requêtes, et l'inverse non plus.
    expect(directive("connect-src")).toMatch(/\$\{CSP_CONNECT_SRC:-\}/);
    expect(example).toMatch(/^CSP_CONNECT_SRC=$/m);
  });

  it("et le paiement peut être soumis chez Stripe", () => {
    expect(directive("form-action")).toMatch(/checkout\.stripe\.com/);
  });
});
