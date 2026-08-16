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

/**
 * La politique, telle qu'elle est définie une seule fois dans le fichier.
 *
 * Un seul `x-csp` ancré, référencé par les deux environnements : c'est ce qui
 * garantit qu'ils ne peuvent pas diverger.
 */
const csp = compose.match(/^x-csp:\s*&csp\s*"([^"]+)"/m)?.[1] ?? "";

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

describe("les deux environnements ne peuvent pas se marcher dessus", () => {
  /* **Le défaut du 11 août.** Production et préproduction déclaraient le même
     middleware Traefik, `movember-security`, depuis deux conteneurs. Cela ne
     tenait que tant que les deux définitions étaient identiques — et un
     déploiement les fait différer par construction : un conteneur est recréé
     avec la nouvelle politique pendant que l'autre tourne encore avec
     l'ancienne. Traefik voit alors le même nom déclaré deux fois avec des
     valeurs différentes, refuse de trancher, et abandonne les routeurs qui
     s'y réfèrent.

     Le symptôme est un 404 sur l'environnement qu'on n'a PAS déployé. En
     novembre, un déploiement de préproduction aurait mis la production hors
     ligne. */

  it("chaque environnement a son propre middleware d’en-têtes", () => {
    expect(compose).toMatch(/x-security-headers:\s*&security-headers\b/);
    expect(compose).toMatch(
      /x-security-headers-staging:\s*&security-headers-staging\b/,
    );
  });

  it("et leurs noms sont distincts", () => {
    expect(compose).toMatch(
      /middlewares\.movember-security\.headers\.stsSeconds/,
    );
    expect(compose).toMatch(
      /middlewares\.movember-security-staging\.headers\.stsSeconds/,
    );
  });

  it("chaque routeur pointe vers le sien", () => {
    expect(compose).toMatch(
      /routers\.movember\.middlewares:.*\bmovember-security@docker/,
    );
    expect(compose).toMatch(
      /routers\.movember-staging\.middlewares:.*\bmovember-security-staging@docker/,
    );
  });

  it("la production ne référence jamais le middleware de préproduction", () => {
    const line =
      compose.match(/routers\.movember\.middlewares:(.*)/)?.[1] ?? "";

    expect(line).not.toMatch(/movember-security-staging/);
  });

  it("mais la politique elle-même n’est écrite qu’une fois", () => {
    // Deux noms, une seule valeur : le risque écarté est le conflit de
    // définition, pas la divergence de contenu.
    expect(compose.match(/^x-csp:/gm) ?? []).toHaveLength(1);
    expect(
      compose.match(/customResponseHeaders\.Content-Security-Policy: \*csp/g) ??
        [],
    ).toHaveLength(2);
  });
});
