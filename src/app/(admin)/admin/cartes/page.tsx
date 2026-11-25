import Link from "next/link";

import { CardPublishToggle } from "@/components/admin/card-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { listCards, type AdminCard } from "@/lib/cards/admin";
import { setCardPublished } from "@/lib/cards/admin-actions";
import { RARITY_ORDER } from "@/lib/cards/draw";
import { parseCardFilters, RARITY_LABELS } from "@/lib/cards/form";

/**
 * The card catalogue, as a volunteer sees it.
 *
 * **Drafts first.** They are the ones that need something done to them — a
 * visual, a proofread, a publication — and in September the whole list will
 * be drafts. Sorting by date would bury the one card added this morning under
 * forty finished ones.
 *
 * Publishing happens from this list rather than from inside each card,
 * because the September routine is "the visuals for six cards just arrived":
 * six taps on one screen, not six navigations.
 */

export const metadata = {
  title: "Cartes — back-office",
};

const SELECT_CLASSES =
  "bg-surface text-ink border-line min-h-11 w-full rounded-lg border px-3 text-base";

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseCardFilters(params);
  const view = await listCards(filters);

  if (!view.editionId) {
    return (
      <Alert tone="danger" title="Édition introuvable">
        L’édition n’existe pas encore en base. Les cartes s’y rattachent, donc
        rien ne peut être créé tant qu’elle manque.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-3xl font-bold tracking-tight">Cartes</h1>
          <p className="text-ink-muted mt-2">
            Le jeu de cartes dans lequel les défis réussis puisent. Une carte
            publiée est tirable immédiatement, sans mise à jour de
            l’application.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/cartes/raretes"
            className={buttonClasses({ variant: "ghost" })}
          >
            Probabilités
          </Link>
          <Link href="/admin/cartes/nouvelle" className={buttonClasses()}>
            Créer une carte
          </Link>
        </div>
      </div>

      <CatalogueHealth
        published={view.totals.published}
        draft={view.totals.draft}
      />

      {params.enregistre && (
        <Alert tone="success" title="Carte enregistrée">
          Elle apparaît dans la liste ci-dessous. Tant qu’elle n’est pas
          publiée, elle n’est jamais tirée.
        </Alert>
      )}

      {params.supprime && (
        <Alert tone="success" title="Carte supprimée">
          Elle n’avait jamais été publiée, donc personne ne l’avait.
        </Alert>
      )}

      <form
        method="get"
        action="/admin/cartes"
        className="border-line bg-surface grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-ink text-sm font-medium">État</span>
          <select
            name="etat"
            defaultValue={filters.status}
            className={SELECT_CLASSES}
          >
            <option value="all">Toutes</option>
            <option value="draft">Brouillons</option>
            <option value="published">Publiées</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-ink text-sm font-medium">Rareté</span>
          <select
            name="rarete"
            defaultValue={filters.rarity ?? ""}
            className={SELECT_CLASSES}
          >
            <option value="">Toutes</option>
            {RARITY_ORDER.map((rarity) => (
              <option key={rarity} value={rarity}>
                {RARITY_LABELS[rarity]}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={buttonClasses({ size: "sm" })}>
          Filtrer
        </button>
      </form>

      {view.failed && (
        <Alert tone="danger" title="Le catalogue n’a pas pu être lu">
          Réessayez dans un instant. Si cela persiste, la base est probablement
          injoignable.
        </Alert>
      )}

      {!view.failed && view.cards.length === 0 && (
        <Alert tone="info" title="Aucune carte ici">
          {filters.status === "all" && !filters.rarity
            ? "Le jeu de cartes est vide. Créez la première carte — le visuel peut venir plus tard."
            : "Aucune carte ne correspond à ces filtres."}
        </Alert>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {view.cards.map((card) => (
          <CardRow key={card.id} card={card} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Where the catalogue stands, said in one sentence.
 *
 * An empty catalogue is not an error — it is the normal state until the
 * visuals arrive — but it does have a consequence worth stating plainly: no
 * card comes out of a completed challenge, and the participant sees nothing
 * explaining why.
 */
function CatalogueHealth({
  published,
  draft,
}: {
  published: number;
  draft: number;
}) {
  if (published === 0) {
    return (
      <Alert tone="warning" title="Aucune carte publiée">
        Les défis réussis comptent leurs points normalement, mais ne donnent
        aucune carte pour l’instant.{" "}
        {draft > 0
          ? `${draft} carte${draft > 1 ? "s" : ""} attend${draft > 1 ? "ent" : ""} d’être publiée${draft > 1 ? "s" : ""}.`
          : "Créez et publiez une première carte pour lancer les tirages."}
      </Alert>
    );
  }

  return (
    <Alert
      tone="success"
      title={`${published} carte${published > 1 ? "s" : ""} en jeu`}
    >
      Elles sont tirables dès maintenant.{" "}
      {draft > 0
        ? `${draft} autre${draft > 1 ? "s" : ""} en brouillon.`
        : "Aucun brouillon en attente."}
    </Alert>
  );
}

const RARITY_TONE: Record<string, "neutral" | "blue" | "orange" | "success"> = {
  commune: "neutral",
  rare: "blue",
  epique: "orange",
  legendaire: "success",
};

function CardRow({ card }: { card: AdminCard }) {
  const published = card.publishedAt !== null;

  return (
    <li
      className={[
        "border-line bg-surface flex gap-3 rounded-xl border p-3",
        published ? "" : "opacity-80",
      ].join(" ")}
    >
      <div className="bg-surface-sunken h-20 w-15 shrink-0 overflow-hidden rounded-lg">
        {card.imagePath ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             A back-office thumbnail served straight from storage. Putting
             the optimiser between a volunteer uploading a picture and seeing
             it would be one more thing that can be broken on the morning it
             matters. */
          <img
            src={card.imagePath}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-ink-muted flex h-full w-full items-center justify-center text-xs">
            Sans
            <br />
            visuel
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/cartes/${card.id}`}
          className="text-ink font-semibold underline-offset-4 hover:underline"
        >
          {card.title}
        </Link>

        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={RARITY_TONE[card.rarity] ?? "neutral"}>
            {RARITY_LABELS[card.rarity]}
          </Badge>

          {published ? (
            <Badge tone="success">En jeu</Badge>
          ) : (
            <Badge tone="neutral">Brouillon</Badge>
          )}

          {!card.imagePath && published && (
            <Badge tone="danger">Visuel manquant</Badge>
          )}
        </div>
      </div>

      <CardPublishToggle
        action={setCardPublished}
        id={card.id}
        published={published}
      />
    </li>
  );
}
