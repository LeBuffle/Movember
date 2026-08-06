import { unstable_cache } from "next/cache";

import { getGallery } from "@/lib/cards/gallery";
import { collectiveTotals } from "@/lib/leaderboards/collective";
import { getRegistrationTiers } from "@/lib/registration/tiers";

/**
 * The public pages' data, cached in memory rather than baked into the build.
 *
 * **Why this file exists.** The home page and the card gallery were declared
 * with `revalidate`, which makes Next.js render them **during `docker
 * build`** — in a container that has no database credentials, because the
 * environment file is mounted at run time and never at build time. Every
 * image therefore shipped a home page whose price list was empty and whose
 * counters said "compteur en préparation", and it stayed that way until five
 * minutes and two visits had passed. Deploy, look, see nothing changed: that
 * was not a caching subtlety, it was a page built blind.
 *
 * So the pages render per request — which is correct, since correctness of
 * what is displayed matters more here than a few milliseconds — and the
 * queries behind them are cached instead. One database round trip every five
 * minutes, whatever the traffic, and HTML that always reflects the database
 * as it is rather than as it was at build time.
 *
 * These callbacks read no cookie and no header: they all go through
 * `createAnonClient`, which exists for exactly this reason. A cached function
 * that touched the session would serve one visitor's data to the next.
 *
 * **Never use these on the payment path.** `getRegistrationTiers` is
 * deliberately left uncached for `/participer/<slug>` and for the Stripe
 * session: a price corrected during the registration rush must be charged
 * immediately, not in five minutes. What is displayed may lag; what is
 * charged may not.
 */

const FIVE_MINUTES = 300;
const TEN_MINUTES = 600;

/** The three formulas, for the public home page only. */
export const getPublicTiers = unstable_cache(
  getRegistrationTiers,
  ["public-tiers"],
  { revalidate: FIVE_MINUTES },
);

/** Kilometres, hours and the amount actually collected. */
export const getPublicTotals = unstable_cache(
  collectiveTotals,
  ["public-totals"],
  { revalidate: FIVE_MINUTES },
);

/** The published cards. Slower-moving: the catalogue is set in September. */
export const getPublicGallery = unstable_cache(getGallery, ["public-gallery"], {
  revalidate: TEN_MINUTES,
});
