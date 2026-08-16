import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { appManifest } from "@/lib/pwa/manifest";
import { BACKGROUND_COLOR, THEME_COLOR } from "@/lib/brand";
import {
  CACHEABLE_PREFIXES,
  OFFLINE_PATH,
  isCacheablePath,
} from "@/lib/pwa/cache-policy";
import { getDisplayMode } from "@/lib/pwa/display-mode";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");
const readBinary = (relative: string) =>
  readFileSync(path.join(root, relative));

/** Width and height straight out of the PNG IHDR chunk. */
function pngDimensions(file: Buffer) {
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

/* =========================================================================
 * Ce que le service worker a le droit de garder sur l'appareil
 *
 * Le point sensible de la story 1.8. Un participant connecte son compte
 * Strava : allure, durée, parfois localisation. Rien de tout cela ne doit
 * survivre dans un cache que le participant ignore.
 * ====================================================================== */

describe("politique de cache", () => {
  it.each([
    "/_next/static/chunks/main-abc123.js",
    "/_next/static/css/app.css",
    "/icons/icon-512.png",
    "/icons/apple-touch-icon.png",
  ])("autorise la mise en cache de %s", (pathname) => {
    expect(isCacheablePath(pathname)).toBe(true);
  });

  it.each([
    ["/mon-compte", "page personnelle"],
    ["/mon-compte/parametres", "page personnelle"],
    ["/jeu/defi-du-jour", "défi du jour"],
    ["/admin/participants", "back-office"],
    ["/api/health", "route d’API"],
    ["/api/strava/activites", "activités sportives"],
    ["/auth/confirmation", "jeton d’authentification"],
    ["/", "page d’accueil"],
    ["/connexion", "formulaire de connexion"],
    // Un chemin qui commence comme un préfixe autorisé sans l'être :
    // « /iconsecrets » n'est pas « /icons/ ».
    ["/iconsecrets/fuite.json", "faux préfixe"],
    ["/_next/staticky", "faux préfixe"],
  ])("refuse la mise en cache de %s (%s)", (pathname) => {
    expect(isCacheablePath(pathname)).toBe(false);
  });
});

describe("le service worker n’élargit pas la politique de cache", () => {
  // Les commentaires du fichier expliquent ce qu'il ne faut PAS faire et
  // citent donc les termes recherchés. C'est le code qui est inspecté ici,
  // pas la prose.
  const source = read("src/app/sw.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("n’utilise pas la configuration toute faite de Serwist", () => {
    // `defaultCache` met en cache les pages et les réponses d'API. Il est
    // proposé partout dans la documentation, c'est donc précisément la
    // erreur qui sera commise un jour par inadvertance.
    expect(source).not.toMatch(/defaultCache/);
    expect(source).not.toMatch(/@serwist\/next\/worker/);
  });

  it("n’a pas plus de stratégies de cache que de préfixes autorisés", () => {
    // NetworkOnly ne stocke rien : elle n'est pas comptée. Toute autre
    // stratégie écrit dans un cache et doit donc correspondre à un préfixe
    // déclaré dans cache-policy.ts.
    const storingStrategies =
      source.match(
        /new (CacheFirst|CacheOnly|NetworkFirst|StaleWhileRevalidate)\b/g,
      ) ?? [];

    expect(storingStrategies).toHaveLength(CACHEABLE_PREFIXES.length);
  });

  it("dérive ses préfixes de cache-policy.ts plutôt que de les réécrire", () => {
    expect(source).toMatch(/from "@\/lib\/pwa\/cache-policy"/);

    for (const prefix of CACHEABLE_PREFIXES) {
      expect(source).not.toContain(`"${prefix}"`);
    }
  });
});

describe("la page hors ligne", () => {
  it("existe à l’adresse précachée", () => {
    const route = path.join(root, "src/app/(public)", OFFLINE_PATH, "page.tsx");

    expect(existsSync(route)).toBe(true);
  });

  it("est exclue du middleware, pour ne pas mettre en cache un cookie de session", () => {
    // Le middleware rafraîchit la session et pose donc un `Set-Cookie`. Cette
    // page-là étant conservée dans le cache de l'appareil, un jeton
    // d'authentification s'y retrouverait stocké.
    expect(read("src/middleware.ts")).toContain(OFFLINE_PATH.replace("/", ""));
  });

  it("ne dépend d’aucune donnée du serveur", () => {
    const page = read(`src/app/(public)${OFFLINE_PATH}/page.tsx`);

    expect(page).not.toMatch(/createClient|supabase|fetch\(|cookies\(/);
  });
});

/* =========================================================================
 * Manifeste et icônes
 * ====================================================================== */

describe("manifeste de l’application", () => {
  const generated = appManifest;

  it("s’ouvre sans barre d’adresse une fois installé", () => {
    expect(generated.display).toBe("standalone");
    expect(generated.start_url).toBe("/");
    expect(generated.scope).toBe("/");
  });

  it("est en français et porte une identité stable", () => {
    expect(generated.lang).toBe("fr");
    expect(generated.id).toBe("/");
    expect(generated.name).toBeTruthy();
  });

  it("garde un nom court affichable sous l’icône", () => {
    // Au-delà d'une douzaine de caractères, Android et iOS tronquent.
    expect(generated.short_name!.length).toBeLessThanOrEqual(12);
  });

  it("fournit les deux tailles et les deux usages d’icône", () => {
    const icons = generated.icons ?? [];
    const signature = (purpose: string) =>
      icons
        .filter((icon) => icon.purpose === purpose)
        .map((icon) => icon.sizes)
        .sort();

    expect(signature("any")).toEqual(["192x192", "512x512"]);
    // Sans icône masquable, Android rogne la nôtre dans la forme de son
    // lanceur et coupe la moustache.
    expect(signature("maskable")).toEqual(["192x192", "512x512"]);
  });

  it("déclare des fichiers qui existent, à la taille annoncée", () => {
    for (const icon of generated.icons ?? []) {
      const file = readBinary(path.join("public", icon.src));
      const [width, height] = icon.sizes!.split("x").map(Number);

      expect(pngDimensions(file)).toEqual({ width, height });
    }
  });

  it("ne réutilise pas l’icône standard comme icône masquable", () => {
    // L'erreur classique : déclarer `purpose: "maskable"` sur le même
    // fichier. Le manifeste est alors valide et l'icône est rognée quand
    // même. Les deux fichiers doivent réellement différer.
    const digest = (name: string) =>
      createHash("sha256")
        .update(readBinary(`public/icons/${name}`))
        .digest("hex");

    expect(digest("icon-512.png")).not.toBe(digest("icon-maskable-512.png"));
  });
});

describe("le manifeste reste lisible derrière le mot de passe de la préproduction", () => {
  const layout = read("src/app/layout.tsx");

  it("demande le manifeste avec les identifiants", () => {
    // Un manifeste est demandé SANS identifiants par défaut. Derrière le mot
    // de passe de la préproduction, il répond donc 401, le navigateur n'a
    // aucun manifeste, et il ne propose pas d'installer l'application. La
    // préproduction devient le seul endroit où l'installation ne peut pas
    // être testée — alors que c'est là qu'elle doit l'être.
    expect(layout).toMatch(/crossOrigin="use-credentials"/);
    expect(layout).toMatch(/rel="manifest"/);
  });

  it("ne laisse pas Next poser une seconde balise sans cet attribut", () => {
    // `src/app/manifest.ts` est une convention Next : sa seule présence fait
    // injecter un `<link rel="manifest">` dépourvu de l'attribut, et le
    // document en contient alors deux. D'où le fichier déplacé dans `lib/`
    // et servi par une route ordinaire.
    expect(existsSync(path.join(root, "src/app/manifest.ts"))).toBe(false);
    expect(
      existsSync(path.join(root, "src/app/manifest.webmanifest/route.ts")),
    ).toBe(true);
  });
});

describe("icônes hors manifeste", () => {
  it("fournit l’icône Apple, que le manifeste ne couvre pas", () => {
    // iOS ignore les icônes du manifeste et lit uniquement celle-ci.
    const file = readBinary("public/icons/apple-touch-icon.png");

    expect(pngDimensions(file)).toEqual({ width: 180, height: 180 });
    expect(read("src/app/layout.tsx")).toContain("/icons/apple-touch-icon.png");
  });

  it("garde la balise « capable » historique d’Apple", () => {
    // Next produit `mobile-web-app-capable`, le nom moderne. Les iPhone
    // antérieurs à iOS 15.4 ne connaissent que l'ancien et ouvriraient
    // l'application dans un habillage de navigateur sans lui.
    expect(read("src/app/layout.tsx")).toContain(
      '"apple-mobile-web-app-capable": "yes"',
    );
  });

  it("fournit un favicon aux couleurs du projet", () => {
    const file = readBinary("src/app/favicon.ico");

    // En-tête ICO : deux octets réservés à zéro, puis le type 1.
    expect(file.readUInt16LE(0)).toBe(0);
    expect(file.readUInt16LE(2)).toBe(1);
    expect(file.readUInt16LE(4)).toBeGreaterThan(0);
  });
});

describe("les couleurs de marque ne dérivent pas de la feuille de style", () => {
  const css = read("src/app/globals.css");

  const token = (name: string) =>
    css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1];

  it("theme_color reprend --color-brand-blue", () => {
    expect(THEME_COLOR).toBe(token("brand-blue"));
    expect(appManifest.theme_color).toBe(THEME_COLOR);
  });

  it("background_color reprend --color-surface", () => {
    expect(BACKGROUND_COLOR).toBe(token("surface"));
  });
});

/* =========================================================================
 * Détection du mode installé — reprise par l'epic 6
 * ====================================================================== */

describe("détection du mode installé", () => {
  const probe = ({
    standalone = false,
    ios = undefined as boolean | undefined,
    referrer = "",
  }) => ({
    matchMedia: () => ({ matches: standalone }),
    navigator: { standalone: ios },
    document: { referrer },
  });

  it("reconnaît un Android installé", () => {
    expect(getDisplayMode(probe({ standalone: true }))).toBe("installed");
  });

  it("reconnaît un iPhone installé, y compris avant iOS 16.4", () => {
    // Avant iOS 16.4, Safari ne renseigne pas `display-mode: standalone` :
    // seul le drapeau maison d'Apple répond. C'est le cas qui décide si
    // l'epic 6 propose les notifications ou l'installation.
    expect(getDisplayMode(probe({ standalone: false, ios: true }))).toBe(
      "installed",
    );
  });

  it("reconnaît une Trusted Web Activity Android", () => {
    expect(getDisplayMode(probe({ referrer: "android-app://fr.defi" }))).toBe(
      "installed",
    );
  });

  it("répond « browser » dans un onglet Safari", () => {
    // Safari renseigne `standalone: false` dans un onglet — il faut lire la
    // valeur, pas la présence de la propriété.
    expect(getDisplayMode(probe({ ios: false }))).toBe("browser");
  });

  it("répond « browser » quand aucun signal n’est disponible", () => {
    expect(getDisplayMode({})).toBe("browser");
  });
});
