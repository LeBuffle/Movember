/**
 * Tells whether the app is running from the home screen or from a browser
 * tab.
 *
 * Needed here for story 1.8 AC 10, but written for epic 6, which depends on
 * it: on iPhone, web push only works once the PWA has been added to the home
 * screen (architecture D6). Epic 6 has to know which of two things to show —
 * "activer les notifications" or "installez d'abord l'application" — and
 * getting that backwards means a participant is told to enable something
 * their browser cannot do.
 *
 * Three signals are needed because the platforms disagree:
 *
 * - `display-mode: standalone` is the standard, honoured by Android and by
 *   iOS 16.4+.
 * - `navigator.standalone` is Apple's own flag, and remains the only
 *   reliable signal on older iOS versions.
 * - an `android-app://` referrer means the page is inside a Trusted Web
 *   Activity, where neither of the above is set.
 *
 * The functions take their inputs rather than reading globals, so they can
 * be tested for each platform without a browser.
 */

export type DisplayMode = "installed" | "browser";

/** The parts of `window` this module looks at. */
export type DisplayModeProbe = {
  matchMedia?: (query: string) => { matches: boolean };
  navigator?: { standalone?: boolean };
  document?: { referrer?: string };
};

export function getDisplayMode(probe: DisplayModeProbe): DisplayMode {
  const standardStandalone =
    probe.matchMedia?.("(display-mode: standalone)").matches ?? false;

  /* Apple only. Reading it as a boolean rather than trusting its presence:
     Safari sets it to false in a tab, and other browsers do not set it. */
  const iosStandalone = probe.navigator?.standalone === true;

  const trustedWebActivity =
    probe.document?.referrer?.startsWith("android-app://") ?? false;

  return standardStandalone || iosStandalone || trustedWebActivity
    ? "installed"
    : "browser";
}

export function isInstalled(probe: DisplayModeProbe): boolean {
  return getDisplayMode(probe) === "installed";
}
