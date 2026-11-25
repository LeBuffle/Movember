import Link from "next/link";

import { RarityWeightsForm } from "@/components/admin/rarity-weights-form";
import { rarityBoard } from "@/lib/cards/admin";
import { saveRarityWeights } from "@/lib/cards/admin-actions";

export const metadata = {
  title: "Probabilités des cartes — back-office",
};

/**
 * The draw odds.
 *
 * The screen that justifies `card_rarities` being a table rather than an
 * enum. A legendary too rare demoralises, one too common is worth nothing,
 * and nobody will know which until November is under way — so the adjustment
 * has to take a minute from a phone, not a deployment.
 */
export default async function RaritiesPage() {
  const lines = await rarityBoard();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin/cartes" className="underline underline-offset-4">
            Cartes
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Probabilités
        </h1>
        <p className="text-ink-muted mt-2">
          À quelle fréquence chaque rareté sort d’un défi réussi. Les valeurs
          sont <strong>relatives</strong> : 60/28/10/2 et 600/280/100/20
          décrivent exactement le même jeu. Vous pouvez donc en modifier une
          seule sans avoir à recalculer les autres.
        </p>
      </div>

      <RarityWeightsForm action={saveRarityWeights} lines={lines} />
    </div>
  );
}
