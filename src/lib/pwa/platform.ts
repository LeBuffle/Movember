/**
 * Which device is reading this, to the only precision that matters.
 *
 * Three families, because there are exactly three sets of instructions to
 * give: on iPhone one adds to the home screen from the share sheet, on
 * Android one accepts a prompt, on a computer one clicks an icon in the
 * address bar. Anything finer — versions, brands, browser builds — would be
 * detail nobody acts on differently.
 *
 * **This detection will be wrong sometimes**, and the interface is built on
 * that assumption rather than against it. It reads a user-agent string, which
 * browsers rewrite freely and which iPadOS deliberately falsifies to look
 * like a Mac. So the answer is a *default choice of tab*, never a gate: the
 * other platforms' instructions stay one tap away (story 6.2 AC 6).
 */

export type Platform = "ios" | "android" | "desktop";

export const PLATFORMS: Platform[] = ["ios", "android", "desktop"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  ios: "iPhone ou iPad",
  android: "Android",
  desktop: "Ordinateur",
};

export type PlatformProbe = {
  userAgent?: string;
  /** iPadOS reports a Mac user agent; only this gives it away. */
  maxTouchPoints?: number;
};

export function detectPlatform(probe: PlatformProbe): Platform {
  const agent = probe.userAgent ?? "";

  if (/iPhone|iPod/i.test(agent)) return "ios";

  /* An iPad since iPadOS 13 says "Macintosh" and means it — the only
     difference from a real Mac is that it has a touch screen. Getting this
     wrong sends an iPad owner looking for an address-bar icon that is not
     there, on the one platform where the install is mandatory. */
  if (/iPad/i.test(agent)) return "ios";
  if (/Macintosh/i.test(agent) && (probe.maxTouchPoints ?? 0) > 1) return "ios";

  if (/Android/i.test(agent)) return "android";

  return "desktop";
}
