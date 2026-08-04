import type { Metadata, Viewport } from "next";
import "./globals.css";

import { THEME_COLOR } from "@/lib/brand";

export const metadata: Metadata = {
  title: "DEFI Movember",
  description:
    "Un mois, un défi par jour, une collection à compléter. Collecte de fonds au profit de la fondation Movember.",
  /* The manifest link is written by hand below, not declared here — the
     reason is documented at the tag itself. */
  /* iOS ignores the manifest icons entirely and reads this one instead. */
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Le DEFI",
    /* Deliberately not `black-translucent`: that mode draws the page behind
       the status bar and requires every screen to handle
       `env(safe-area-inset-top)` by hand, which is a lot of ways to end up
       with a title hidden under the notch. `default` reserves the strip and
       lets iOS fill it from the page background. */
    statusBarStyle: "default",
  },
  other: {
    /* Next renders `appleWebApp.capable` as the modern
       `mobile-web-app-capable`. Checked against the served HTML, not
       assumed. iOS before 15.4 only understands Apple's original spelling
       and, without it, opens the app inside browser chrome even once it is
       on the home screen. Recent iOS reads `display: standalone` from the
       manifest instead and ignores both. */
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  /* Tints the system chrome around the app. Matches `theme_color` in the
     manifest — both read the same constant so they cannot diverge. */
  themeColor: THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      {/*
        The manifest link, written by hand for one attribute Next does not
        expose: `crossOrigin`.

        A manifest is fetched WITHOUT credentials by default. Behind the
        password that protects the preview environment, that request comes
        back 401 — the browser then has no manifest, and offers no way to
        install the application. Which makes the preview environment the one
        place where installation cannot be tested, and installation is
        precisely what has to be tested there.

        Next handles this case, but only for itself: it sets the attribute
        when `VERCEL_ENV === "preview"` (see
        `next/dist/lib/metadata/generate/basic.js`). We are behind the same
        kind of gate without being on Vercel, so we set it ourselves.

        Harmless in production, where there is no gate: the manifest is
        simply requested with the site's own cookies.
      */}
      <link
        rel="manifest"
        href="/manifest.webmanifest"
        crossOrigin="use-credentials"
      />
      <body className="antialiased">{children}</body>
    </html>
  );
}
