import Link from "next/link";
import { notFound } from "next/navigation";

import { ChallengeForm } from "@/components/admin/challenge-form";
import { Alert } from "@/components/ui/alert";
import { saveChallenge } from "@/lib/challenges/admin-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Modifier un défi — back-office",
};

export default async function EditChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const { data } = await supabase
    .from("challenges")
    .select(
      "id, title, description, evaluator, config, sport_family, difficulty, points, duration_scope, duration_days, is_active",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin/defis" className="underline underline-offset-4">
            Défis
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Modifier le défi
        </h1>
      </div>

      {!data.is_active && (
        <Alert tone="warning" title="Ce défi est retiré du tirage">
          Il n’est plus attribué à personne. Vous pouvez le modifier ici, puis
          le remettre en jeu depuis la liste.
        </Alert>
      )}

      <ChallengeForm
        action={saveChallenge}
        challenge={{
          id: data.id,
          title: data.title,
          description: data.description ?? "",
          evaluator: data.evaluator,
          // Passed raw: the form converts to the units a volunteer types in.
          config: (data.config ?? {}) as Record<string, unknown>,
          sport_family: data.sport_family,
          difficulty: data.difficulty,
          points: String(data.points),
          duration_scope: data.duration_scope,
          duration_days:
            data.duration_days === null ? "" : String(data.duration_days),
        }}
      />
    </div>
  );
}
