import Link from "next/link";

import { ChallengeToggle } from "@/components/admin/challenge-toggle";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { setChallengeActive } from "@/lib/challenges/admin-actions";
import {
  catalogueHealth,
  escapeLikePattern,
  hasActiveFilters,
  parseCatalogueFilters,
} from "@/lib/challenges/catalogue";
import { readChallengeConfig } from "@/lib/challenges/config";
import { describeChallenge } from "@/lib/challenges/describe";
import {
  EVALUATORS,
  isEvaluatorKey,
} from "@/lib/challenges/evaluators/registry";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  SPORT_FAMILIES,
  SPORT_FAMILY_LABELS,
  type Difficulty,
  type SportFamily,
} from "@/lib/challenges/sports";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

/**
 * The catalogue, as a volunteer sees it.
 *
 * Each row shows the **sentence the participant will read**, not the raw
 * settings. A threshold typed in the wrong unit is invisible in
 * `{"min_distance_meters": 5}` and obvious in "Parcourir 5 m" — and the point
 * of this screen is that someone scrolling it in September catches that.
 *
 * Filters live in the address bar rather than in component state: the list
 * survives a back button, and it can be sent to someone else as a link.
 */

export const metadata = {
  title: "Défis — back-office",
};

const SELECT_CLASSES =
  "bg-surface text-ink border-line min-h-11 w-full rounded-lg border px-3 text-base";

type Row = {
  id: string;
  title: string;
  evaluator: string;
  config: Record<string, unknown>;
  sport_family: string;
  difficulty: string;
  points: number;
  is_active: boolean;
};

export default async function AdminChallengesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseCatalogueFilters(params);

  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  if (!edition) {
    return (
      <Alert tone="danger" title="Édition introuvable">
        L’édition {EDITION_YEAR} n’existe pas encore en base. Les défis s’y
        rattachent, donc rien ne peut être créé tant qu’elle manque.
      </Alert>
    );
  }

  // The health indicator counts the whole catalogue, never the filtered view:
  // a filter showing three challenges must not read as a catalogue of three.
  const { count: activeCount } = await supabase
    .from("challenges")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", edition.id)
    .eq("is_active", true);

  let query = supabase
    .from("challenges")
    .select(
      "id, title, evaluator, config, sport_family, difficulty, points, is_active",
    )
    .eq("edition_id", edition.id)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status !== "all") {
    query = query.eq("is_active", filters.status === "active");
  }
  if (filters.sport) query = query.eq("sport_family", filters.sport);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.evaluator) query = query.eq("evaluator", filters.evaluator);
  if (filters.search) {
    query = query.ilike("title", `%${escapeLikePattern(filters.search)}%`);
  }

  const { data, error } = await query;
  const challenges = (data ?? []) as Row[];
  const health = catalogueHealth(activeCount ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-3xl font-bold tracking-tight">Défis</h1>
          <p className="text-ink-muted mt-2">
            Le catalogue dans lequel le tirage quotidien puise. Un défi retiré
            du tirage n’est jamais supprimé.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/defis/attribution"
            className={buttonClasses({ variant: "secondary" })}
          >
            Attribution du jour
          </Link>
          <Link
            href="/admin/defis/arbitrage"
            className={buttonClasses({ variant: "ghost" })}
          >
            Arbitrage
          </Link>
          <Link href="/admin/defis/nouveau" className={buttonClasses()}>
            Créer un défi
          </Link>
        </div>
      </div>

      <Alert tone={health.tone} title={health.title}>
        {health.message}
      </Alert>

      {params.enregistre && (
        <Alert tone="success" title="Défi enregistré">
          Il apparaît dans la liste ci-dessous.
        </Alert>
      )}

      <form
        method="get"
        action="/admin/defis"
        className="border-line bg-surface space-y-3 rounded-xl border p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-sm font-medium">Rechercher</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.search}
              placeholder="Un mot du titre"
              className={SELECT_CLASSES}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-sm font-medium">Type de défi</span>
            <select
              name="type"
              defaultValue={filters.evaluator ?? ""}
              className={SELECT_CLASSES}
            >
              <option value="">Tous les types</option>
              {Object.values(EVALUATORS).map((definition) => (
                <option key={definition.key} value={definition.key}>
                  {definition.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-sm font-medium">Sport</span>
            <select
              name="sport"
              defaultValue={filters.sport ?? ""}
              className={SELECT_CLASSES}
            >
              <option value="">Tous les sports</option>
              {SPORT_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {SPORT_FAMILY_LABELS[family]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-sm font-medium">Difficulté</span>
            <select
              name="difficulte"
              defaultValue={filters.difficulty ?? ""}
              className={SELECT_CLASSES}
            >
              <option value="">Toutes</option>
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {DIFFICULTY_LABELS[level]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-sm font-medium">État</span>
            <select
              name="etat"
              defaultValue={filters.status}
              className={SELECT_CLASSES}
            >
              <option value="active">En jeu</option>
              <option value="inactive">Retirés du tirage</option>
              <option value="all">Tous</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonClasses({ size: "sm" })}>
            Filtrer
          </button>

          {hasActiveFilters(filters) && (
            <Link
              href="/admin/defis"
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              Tout afficher
            </Link>
          )}
        </div>
      </form>

      {error && (
        <Alert tone="danger" title="Le catalogue n’a pas pu être lu">
          Réessayez dans un instant. Si cela persiste, la base est probablement
          injoignable.
        </Alert>
      )}

      {!error && challenges.length === 0 && (
        <Alert tone="info" title="Aucun défi ici">
          {hasActiveFilters(filters)
            ? "Aucun défi ne correspond à ces filtres."
            : "Le catalogue est vide. Créez le premier défi pour commencer."}
        </Alert>
      )}

      <ul className="space-y-3">
        {challenges.map((challenge) => (
          <ChallengeRow key={challenge.id} challenge={challenge} />
        ))}
      </ul>
    </div>
  );
}

function ChallengeRow({ challenge }: { challenge: Row }) {
  const definition = isEvaluatorKey(challenge.evaluator)
    ? EVALUATORS[challenge.evaluator]
    : null;

  // Re-validated on the way out (story 4.1): a row edited straight in SQL, or
  // written before a change to its schema, must be shown as broken rather
  // than described with whatever happens to be in it.
  const config = readChallengeConfig(challenge.evaluator, challenge.config);

  return (
    <li
      className={[
        "border-line bg-surface rounded-xl border p-4",
        challenge.is_active ? "" : "opacity-70",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/defis/${challenge.id}`}
              className="text-ink font-semibold underline-offset-4 hover:underline"
            >
              {challenge.title}
            </Link>

            {!challenge.is_active && <Badge tone="neutral">Retiré</Badge>}
            {!config && <Badge tone="danger">Réglages invalides</Badge>}
          </div>

          {config ? (
            <p className="text-ink-muted mt-1 text-sm">
              {describeChallenge(challenge.evaluator, config).join(" ")}
            </p>
          ) : (
            <p className="text-danger mt-1 text-sm">
              Ce défi ne peut pas être évalué en l’état. Ouvrez-le pour corriger
              ses réglages.
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="blue">
              {definition?.label ?? challenge.evaluator}
            </Badge>
            <Badge tone="neutral">
              {SPORT_FAMILY_LABELS[challenge.sport_family as SportFamily] ??
                challenge.sport_family}
            </Badge>
            <Badge tone="neutral">
              {DIFFICULTY_LABELS[challenge.difficulty as Difficulty] ??
                challenge.difficulty}
            </Badge>
            <Badge tone="orange">{challenge.points} points</Badge>
          </div>
        </div>

        <ChallengeToggle
          action={setChallengeActive}
          id={challenge.id}
          active={challenge.is_active}
        />
      </div>
    </li>
  );
}
