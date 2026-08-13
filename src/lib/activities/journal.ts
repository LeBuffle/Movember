import "server-only";

import type { SportFamily } from "@/lib/challenges/sports";
import { editionStartDate } from "@/lib/edition/start";
import type { LeaderboardCategory } from "@/lib/leaderboards/categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Les dernières sorties de quelqu'un, dans la catégorie consultée (15.3).
 *
 * **Un classement dit qui gagne ; il ne dit jamais comment.** « 340 km de
 * vélo » ne se traduit pas en quelque chose qu'on peut faire soi-même ; « six
 * sorties de 55 km le week-end », si. C'est un levier d'assiduité, pas de
 * compétition.
 *
 * **Toutes les exclusions sont dans la requête, aucune dans l'écran.** Un
 * filtre applicatif est un filtre que le deuxième écran oubliera — et ici
 * l'oubli publie des données de santé. Trois exclusions, et chacune vient
 * d'une décision :
 *
 *   - la sortie était masquée chez le fournisseur (J3, story 15.1) ;
 *   - son auteur a coupé l'affichage (J1, story 15.2) ;
 *   - son auteur est suspendu, donc absent de tout (story 8.7).
 *
 * **Le titre n'est pas caché : il n'est pas demandé.** La différence est
 * celle entre une donnée absente d'une réponse et une donnée présente mais
 * non affichée. La seconde finit dans un outil de développement, dans un
 * cache, ou dans le prochain écran qui réutilise cette fonction.
 */

/** Dix. Comprendre un rythme, pas auditer un mois. */
const JOURNAL_SIZE = 10;

export type JournalEntry = {
  sportFamily: SportFamily;
  /** `YYYY-MM-DD`, le jour de jeu — pas l'heure de départ. */
  localDate: string;
  distanceMeters: number;
  durationSeconds: number;
  elevationMeters: number;
};

export type Journal =
  | { state: "ok"; entries: JournalEntry[] }
  /** Le participant a coupé l'affichage. Ce n'est pas une panne. */
  | { state: "hidden" }
  | { state: "unavailable" };

/**
 * Les familles de sport que porte une catégorie de classement.
 *
 * `null` veut dire « toutes » : Sorties et Temps comptent tous sports
 * confondus, et les filtrer par famille répondrait à une autre question que
 * celle qui a été posée.
 *
 * Les catégories qui ne parlent pas de sport — points, défis, cartes —
 * n'ouvrent pas de journal du tout : elles récompensent des défis, et le défi
 * de quelqu'un d'autre ne regarde personne.
 */
export function familiesFor(
  category: LeaderboardCategory,
): SportFamily[] | null | "none" {
  switch (category) {
    case "run":
      return ["run"];
    case "bike":
      return ["bike"];
    case "walk":
      return ["walk"];
    case "activities":
    case "duration":
      return null;
    default:
      return "none";
  }
}

/** Qui a le droit de lire un journal : un participant inscrit et actif. */
async function readerIsPlaying(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  // Lu à travers la session du lecteur : la sécurité au niveau des lignes
  // décide, pas cette fonction.
  const { data } = await supabase
    .from("registrations")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

export async function readJournal(
  profileId: string,
  category: LeaderboardCategory,
): Promise<Journal> {
  const families = familiesFor(category);
  if (families === "none") return { state: "unavailable" };

  if (!(await readerIsPlaying())) return { state: "unavailable" };

  const admin = createAdminClient();

  // Le réglage et la suspension, en une lecture. Un suspendu n'a pas de
  // journal, comme il n'a pas de rang.
  const { data: owner } = await admin
    .from("profiles")
    .select("activities_opt_out, suspended_at, deleted_at")
    .eq("id", profileId)
    .maybeSingle();

  if (!owner || owner.deleted_at || owner.suspended_at) {
    return { state: "unavailable" };
  }

  if (owner.activities_opt_out) return { state: "hidden" };

  const start = await editionStartDate();

  let query = admin
    .from("activities")
    // Cinq colonnes. Le titre n'y est pas, et c'est le cœur de la story.
    .select(
      "sport_family, local_date, distance_meters, duration_seconds, elevation_meters",
    )
    .eq("profile_id", profileId)
    // Masquée chez le fournisseur, ou importée avant qu'on sache le demander.
    .eq("is_private", false)
    .gte("started_at", start.toISOString())
    .order("started_at", { ascending: false })
    .limit(JOURNAL_SIZE);

  if (families) query = query.in("sport_family", families);

  const { data, error } = await query;

  if (error) {
    console.error("[sorties] journal illisible", { code: error.code });
    return { state: "unavailable" };
  }

  return {
    state: "ok",
    entries: (data ?? []).map((row) => ({
      sportFamily: row.sport_family as SportFamily,
      localDate: row.local_date,
      distanceMeters: row.distance_meters,
      durationSeconds: row.duration_seconds,
      elevationMeters: row.elevation_meters,
    })),
  };
}
