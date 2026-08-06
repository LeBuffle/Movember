import Link from "next/link";

import { CardForm } from "@/components/admin/card-form";
import { saveCard } from "@/lib/cards/admin-actions";

export const metadata = {
  title: "Nouvelle carte — back-office",
};

export default function NewCardPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin/cartes" className="underline underline-offset-4">
            Cartes
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Créer une carte
        </h1>
        <p className="text-ink-muted mt-2">
          Une carte créée ici n’est pas encore en jeu : elle reste un brouillon
          jusqu’à ce que vous la publiiez. Le visuel peut arriver plus tard.
        </p>
      </div>

      <CardForm action={saveCard} />
    </div>
  );
}
