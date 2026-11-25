import Link from "next/link";
import { notFound } from "next/navigation";

import { CardDelete, CardPublishToggle } from "@/components/admin/card-actions";
import { CardForm } from "@/components/admin/card-form";
import { Alert } from "@/components/ui/alert";
import { getCard } from "@/lib/cards/admin";
import {
  deleteCard,
  saveCard,
  setCardPublished,
} from "@/lib/cards/admin-actions";

export const metadata = {
  title: "Modifier une carte — back-office",
};

/**
 * One card's screen.
 *
 * Carries the publication switch and, when it is still possible, the
 * deletion. **Deletion is only offered on a card that was never published**
 * — the write refuses otherwise, and a database trigger refuses after that
 * (story 5.6 AC 4), but a button whose only outcome is a refusal teaches
 * people to ignore refusals.
 */
export default async function EditCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getCard(id);

  if (!card) notFound();

  const published = card.publishedAt !== null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin/cartes" className="underline underline-offset-4">
            Cartes
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          {card.title}
        </h1>
      </div>

      <div className="border-line bg-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div>
          <p className="text-ink font-semibold">
            {published ? "En jeu" : "Brouillon"}
          </p>
          <p className="text-ink-muted text-sm">
            {published
              ? `Publiée le ${formatDate(card.publishedAt!)}. ${circulation(card.grants)}`
              : "Jamais publiée : elle n’a jamais pu être tirée."}
          </p>
        </div>

        <CardPublishToggle
          action={setCardPublished}
          id={card.id}
          published={published}
        />
      </div>

      {published && !card.imagePath && (
        <Alert tone="warning" title="Cette carte est en jeu sans visuel">
          Elle s’affiche avec ses initiales dans les collections. Ajoutez son
          image quand elle arrive : rien d’autre n’est à faire.
        </Alert>
      )}

      <CardForm
        action={saveCard}
        card={{
          id: card.id,
          title: card.title,
          description: card.description,
          rarity: card.rarity,
          imagePath: card.imagePath,
          published,
        }}
      />

      {!published && (
        <section className="border-line space-y-2 border-t pt-6">
          <h2 className="text-ink text-lg font-bold">Supprimer</h2>
          <p className="text-ink-muted text-sm">
            Possible tant que cette carte n’a jamais été publiée. Une fois
            publiée, elle ne pourra plus être supprimée — quelqu’un pourrait
            l’avoir dans sa collection, et un défi réussi ne doit jamais
            disparaître d’un historique.
          </p>

          <CardDelete action={deleteCard} id={card.id} />
        </section>
      )}
    </div>
  );
}

function circulation(grants: number): string {
  if (grants === 0) return "Personne ne l’a encore obtenue.";

  return `${grants} exemplaire${grants > 1 ? "s" : ""} en circulation.`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
