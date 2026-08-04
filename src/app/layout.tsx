import type { Metadata, Viewport } from "next";
import "./globals.css";

import { THEME_COLOR } from "@/lib/brand";

export const metadata: Metadata = {
  title: "DEFI Movember",
  description:
    "Un mois, un défi par jour, une collection à compléter. Collecte de fonds au profit de la fondation Movember.",
  /* Next adds `<link rel="manifest">` on its own from `app/manifest.ts`.
     What it cannot guess is the Apple side: iOS ignores the manifest icons
     entirely and reads this one instead. */
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
