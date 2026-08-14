import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Ce qui fabrique l'application (montée en Next.js 16, 14 août)
 *
 * **Le seul test du projet qui protège contre un silence.** Next 16 construit
 * avec Turbopack par défaut, et Turbopack ne sait pas fabriquer notre service
 * worker. Le premier essai a produit une application complète, sans erreur,
 * sans avertissement dans le journal de déploiement — et sans mode hors-ligne
 * ni notifications. Rien à l'écran ne l'aurait dit.
 *
 * Le drapeau `--webpack` est ce qui l'empêche. Il ressemble exactement au
 * genre de détail qu'on retire en faisant du ménage.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

const pkg = JSON.parse(read("package.json")) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

/** Retire les commentaires : un commentaire n'est pas une garantie. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const config = code(read("next.config.ts"));

describe("la construction utilise webpack, pas Turbopack", () => {
  it("le drapeau est sur la commande de construction", () => {
    expect(pkg.scripts.build).toContain("--webpack");
  });

  it("et sur celle de développement, pour que les deux se ressemblent", () => {
    // Un serveur de développement qui ne compile pas le service worker donne
    // une confiance qui ne survit pas au déploiement.
    expect(pkg.scripts.dev).toContain("--webpack");
  });

  it("le service worker est bien ce qui en dépend", () => {
    // Si un jour Serwist sait faire avec Turbopack, c'est cette ligne qui
    // dira quoi vérifier avant de retirer le drapeau.
    expect(config).toContain("withSerwistInit");
    expect(config).toMatch(/swDest: "public\/sw\.js"/);
  });
});

describe("Next.js et son écosystème avancent ensemble", () => {
  it("la configuration ESLint suit la version de Next", () => {
    // Deux versions majeures différentes et les règles vérifiées ne sont plus
    // celles du framework qui construit.
    expect(pkg.devDependencies["eslint-config-next"]).toBe(
      pkg.dependencies.next,
    );
  });

  it("les deux versions sont figées, sans accent circonflexe", () => {
    // Une montée de version majeure ne doit jamais arriver par un
    // `npm install` de routine, un soir de novembre.
    expect(pkg.dependencies.next).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies["eslint-config-next"]).toMatch(
      /^\d+\.\d+\.\d+$/,
    );
  });
});

describe("l’allègement du rapporteur d’erreurs est demandé à Sentry", () => {
  it("par son option, plus par un greffon webpack écrit à la main", () => {
    // Le greffon posait `__SENTRY_DEBUG__` et `__SENTRY_TRACING__` lui-même.
    // L'option du SDK fait exactement la même chose — vérifié : le paquet
    // produit est identique à l'octet près — et elle suivra les renommages du
    // SDK toute seule.
    expect(config).toMatch(/treeshake: \{ removeDebugLogging: true/);
    expect(config).toMatch(/removeTracing: true/);
    expect(config).not.toMatch(/DefinePlugin/);
  });

  it("et l’option dépréciée a disparu", () => {
    expect(config).not.toMatch(/disableLogger/);
  });
});
