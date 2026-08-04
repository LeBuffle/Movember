import type { MetadataRoute } from "next";

import { BACKGROUND_COLOR, THEME_COLOR } from "@/lib/brand";

/**
 * Web app manifest, served at `/manifest.webmanifest`.
 *
 * Written as a Next metadata route rather than as a static
 * `public/manifest.json`: the object is typed, so a misspelt key or a wrong
 * `purpose` is a compile error instead of an icon that silently fails to
 * appear on someone's home screen. Next injects the `<link rel="manifest">`
 * itself, which is one more thing that cannot be forgotten.
 *
 * This story delivers the ability to install. The guided install prompt —
 * with its separate iPhone and Android instructions — belongs to epic 6.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    /* Stable identity of the installed app. Without it the identity is
       derived from `start_url`, and changing that later would look like a
       different app to the browser. */
    id: "/",
    name: "DEFI Movember",
    /* What fits under the icon on a home screen — roughly twelve characters
       before Android and iOS start truncating. */
    short_name: "Le DEFI",
    description:
      "Un mois, un défi sportif par jour, une collection de cartes à compléter. Projet indépendant au profit de la fondation Movember.",
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    /* No browser address bar once installed (AC 5). It is also what makes
       web push possible on iPhone (architecture D6). */
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    categories: ["health", "fitness", "sports"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      /* Separate files, not the same ones reused: Android crops a maskable
         icon to the launcher's shape, so the mark is drawn smaller in these
         two to survive the crop. */
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
