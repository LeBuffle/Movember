import Link from "next/link";

import { ChallengeForm } from "@/components/admin/challenge-form";
import { saveChallenge } from "@/lib/challenges/admin-actions";

export const metadata = {
  title: "Nouveau défi — back-office",
};

export default function NewChallengePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin/defis" className="underline underline-offset-4">
            Défis
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Créer un défi
        </h1>
        <p className="text-ink-muted mt-2">
          Rien n’est publié tant que vous n’avez pas enregistré. L’aperçu en bas
          de page montre exactement ce que le participant lira.
        </p>
      </div>

      <ChallengeForm action={saveChallenge} />
    </div>
  );
}
