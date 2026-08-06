import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Quelle version tourne ? (story 1.3)
 *
 * La question se pose une seule fois : pendant un incident. Une réponse vide
 * à ce moment-là oblige à aller la chercher sur le serveur, en pleine panne.
 *
 * Ce test existe parce que la réponse a été vide pendant une journée, et que
 * la cause n'était visible nulle part : une ligne `APP_VERSION=` héritée du
 * modèle d'environnement écrasait celle inscrite dans l'image.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

describe("le modèle d'environnement", () => {
  it("n'affecte jamais APP_VERSION", () => {
    // `env_file` de Docker Compose écrase la valeur inscrite dans l'image.
    // Une ligne vide ici, recopiée dans le fichier du serveur, suffit à
    // effacer le numéro de version du conteneur.
    const env = read(".env.example");

    expect(env).not.toMatch(/^APP_VERSION=/m);
  });

  it("et le dit, pour que personne ne la remette", () => {
    expect(read(".env.example")).toMatch(/APP_VERSION is deliberately ABSENT/);
  });
});

describe("la version affichée", () => {
  it("traite une valeur vide comme une absence", () => {
    // `??` laisserait passer la chaîne vide : c'est exactement ce qui s'est
    // produit. `||` retombe sur la version du paquet.
    const source = read("src/lib/app-version.ts");

    expect(source).toMatch(
      /process\.env\.APP_VERSION \|\| packageJson\.version/,
    );
    expect(source).not.toMatch(/process\.env\.APP_VERSION \?\?/);
  });

  it("comme l'environnement", () => {
    const source = read("src/lib/app-version.ts");

    expect(source).toMatch(/process\.env\.APP_ENVIRONMENT \|\| "development"/);
  });
});

describe("l'image porte la version", () => {
  it("le Dockerfile l'inscrit dans l'étape d'exécution", () => {
    // Sans `ENV` dans l'étape finale, l'argument de construction ne survit
    // pas à l'image : il ne sert qu'au moment du build.
    const dockerfile = read("deploy/Dockerfile");
    const runner = dockerfile.slice(dockerfile.lastIndexOf("FROM node"));

    expect(runner).toMatch(/ARG APP_VERSION/);
    expect(runner).toMatch(/ENV APP_VERSION=\$\{APP_VERSION\}/);
  });

  it("et le script de déploiement la lui passe", () => {
    expect(read("deploy/scripts/deploy.sh")).toMatch(
      /--build-arg "APP_VERSION=\$SHORT_SHA"/,
    );
  });
});
