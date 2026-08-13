import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Consent to the processing of activity data.
 *
 * Collected **before** any redirection to a provider (FR23), separately from
 * the terms of sale, and never pre-ticked. Read through the participant's own
 * session, so row level security answers.
 */

/**
 * The version of the consent text in force.
 *
 * Bumped whenever the wording changes in a way that changes what someone is
 * agreeing to — a new field collected, a new retention period, a new
 * processor. Fixing a typo is not that.
 *
 * The version is recorded with each grant so that "what did they agree to?"
 * has an answer. Whether a change is material enough to require collecting
 * consent again is a decision for the association, not for this constant:
 * re-asking four hundred people is not free either.
 */
export const CONSENT_VERSION = "2026-08-v1";

/**
 * What the participant is told, in the words they are told it.
 *
 * Kept here rather than inline in the page because it is the *substance* of
 * the consent, not decoration — and because a regulator asking "what exactly
 * was shown?" should find it in one place, next to the version it belongs to.
 */
export const CONSENT_COLLECTED = [
  "Le type de sport de chaque sortie",
  "Sa date et son heure de début",
  "Sa durée, sa distance et son dénivelé",
  "Le nom que vous lui avez donné",
] as const;

export const CONSENT_NEVER_COLLECTED = [
  "Votre tracé GPS, et donc les lieux où vous passez",
  "Vos points de départ et d’arrivée",
  "Votre fréquence cardiaque",
  "Votre puissance et votre cadence",
] as const;

/**
 * Ce que les autres participants voient de vos sorties (story 15.5).
 *
 * **Un consentement recueilli avant l'epic 15 ne couvre pas l'epic 15.** Le
 * texte ci-dessus autorise la récupération des activités pour valider des
 * défis ; les montrer à six cents personnes est un traitement différent, et
 * il doit être écrit là où la personne le lit.
 *
 * Posé ici, à côté du reste, parce que la politique de confidentialité et
 * l'écran de consentement doivent dire la même chose : deux fichiers, deux
 * moments de modification, et le premier qui dérive est celui que personne ne
 * relit. Un test compare les deux.
 */
export const ACTIVITY_SHARING = {
  shown: [
    "Le type de sport",
    "La date",
    "La distance, la durée et le dénivelé",
  ],
  hidden: [
    "Le nom que vous avez donné à votre sortie",
    "Votre tracé, et tout ce que le jeu ne stocke pas",
  ],
  /** La phrase qui doit se retrouver mot pour mot aux deux endroits. */
  rule: "Depuis le classement, les autres participants peuvent ouvrir vos dix dernières sorties de la catégorie consultée. Vos sorties masquées sur Strava restent masquées ici, et vous pouvez couper cet affichage à tout moment depuis « Mon compte » — sans rien perdre de votre rang ni de vos points.",
} as const;

export type ConsentState = {
  granted: boolean;
  /** When the current consent was given, if it holds. */
  grantedAt: string | null;
  /** Which text was agreed to. May differ from `CONSENT_VERSION`. */
  version: string | null;
};

const NONE: ConsentState = { granted: false, grantedAt: null, version: null };

/**
 * The current state: the latest event wins.
 *
 * A grant followed by a withdrawal is a withdrawal; a withdrawal followed by
 * a new grant is a grant. Nothing is deleted, so both remain readable.
 */
export async function getConsent(): Promise<ConsentState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NONE;

  const { data, error } = await supabase
    .from("activity_consents")
    .select("action, version, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[consentement] lecture impossible", { code: error.code });
    return NONE;
  }

  if (!data || data.action !== "granted") return NONE;

  return {
    granted: true,
    grantedAt: data.created_at,
    version: data.version,
  };
}

/**
 * Whether an activity source may be connected at all.
 *
 * The one gate every future connection has to pass. Story 3.3 calls it
 * before building an authorisation URL — not because the screen hides the
 * button, but because a screen is not a control.
 */
export async function mayConnectActivitySource(): Promise<boolean> {
  return (await getConsent()).granted;
}
