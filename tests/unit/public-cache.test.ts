import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Les pages publiques ne sont pas construites à l'aveugle
 *
 * `revalidate` faisait pré-calculer ces pages PENDANT `docker build`, dans
 * un conteneur sans identifiants de base : chaque image embarquait une page
 * d'accueil sans tarifs et une galerie vide, et cela durait cinq minutes et
 * deux visites après chaque déploiement.
 *
 * Le symptôme était « je déploie et je ne vois aucun changement ». Il a
 * coûté une demi-journée.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const PUBLIC_PAGES = [
  "src/app/page.tsx",
  "src/app/(public)/cartes/page.tsx",
] as const;

describe("les pages publiques qui lisent la base", () => {
  it.each(PUBLIC_PAGES)("%s se rend à la demande", (page) => {
    expect(code(read(page))).toMatch(/export const dynamic = "force-dynamic";/);
  });

  it.each(PUBLIC_PAGES)("%s ne déclare pas revalidate", (page) => {
    // C'est précisément ce qui déclenche le pré-calcul à la construction.
    expect(code(read(page))).not.toMatch(/export const revalidate/);
  });

  it("et leurs requêtes sont mises en cache, pas leur rendu", () => {
    const cache = code(read("src/lib/public-cache.ts"));

    expect(cache).toMatch(/unstable_cache/);
    expect(cache).toMatch(/revalidate: FIVE_MINUTES/);

    for (const page of PUBLIC_PAGES) {
      expect(code(read(page))).toMatch(/@\/lib\/public-cache/);
    }
  });
});

describe("ce qui est facturé n'est jamais mis en cache", () => {
  it("le chemin de paiement lit le tarif sans passer par le cache", () => {
    // Un tarif corrigé pendant la ruée des inscriptions doit être facturé
    // tout de suite, pas dans cinq minutes. Ce qui est affiché peut
    // retarder ; ce qui est prélevé, non.
    for (const page of [
      "src/app/(participant)/participer/[niveau]/page.tsx",
      "src/app/(participant)/participer/[niveau]/paiement/page.tsx",
    ]) {
      const source = code(read(page));

      expect(source).toMatch(/getTierBySlug/);
      expect(source).not.toMatch(/public-cache/);
    }
  });

  it("et le cache public ne sert que trois lectures, toutes anonymes", () => {
    // Une fonction mise en cache qui toucherait à la session servirait les
    // données d'un visiteur au suivant.
    const cache = code(read("src/lib/public-cache.ts"));

    expect(cache).not.toMatch(/cookies\(\)|headers\(\)|getUser/);
    expect(cache.match(/unstable_cache\(/g)).toHaveLength(3);
  });
});
