import Link from "next/link";

import { DrawRunner } from "@/components/admin/draw-runner";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { runDailyDraw } from "@/lib/challenges/admin-actions";
import { todayInParis } from "@/lib/challenges/daily-draw";
import { EDITION_YEAR } from "@/lib/edition/calendar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Attribution du jour — back-office",
};

export const dynamic = "force-dynamic";

/**
 * Whether everybody got their challenge this morning — and the button if not.
 *
 * This screen exists for one situation: it is six in the morning on a
 * Wednesday in November, somebody says their challenge is missing, and the
 * person who can do something about it is holding a phone. So it answers the
 * question first — how many have one, how many do not — and offers the fix
 * second.
 */
export default async function DailyDrawPage() {
  const date = todayInParis();
  const supabase = await createClient();

  const { data: edition } = await supabase
    .from("editions")
    .select("id")
    .eq("year", EDITION_YEAR)
    .maybeSingle();

  const counts = edition
    ? await Promise.all([
        supabase
          .from("registrations")
          .select("profile_id", { count: "exact", head: true })
          .eq("edition_id", edition.id)
          .eq("status", "active"),
        supabase
          .from("challenge_assignments")
          .select("id", { count: "exact", head: true })
          .eq("edition_id", edition.id)
          .eq("assigned_for", date)
          .in("source", ["draw", "catchup"]),
      ])
    : null;

  const participants = counts?.[0]?.count ?? 0;
  const assigned = counts?.[1]?.count ?? 0;
  const missing = Math.max(0, participants - assigned);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/admin/defis" className="underline underline-offset-4">
            Défis
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Attribution du jour
        </h1>
        <p className="text-ink-muted mt-2">
          Le {date}, heure de Paris. La tâche automatique passe chaque matin à 5
          h 04 ; ce bouton fait exactement la même chose, à la demande.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Participants actifs</CardTitle>
          <CardBody>
            <p className="text-brand-blue text-3xl font-extrabold">
              {participants}
            </p>
          </CardBody>
        </Card>

        <Card accent={missing > 0}>
          <CardTitle>Défis attribués aujourd’hui</CardTitle>
          <CardBody>
            <p className="text-brand-blue text-3xl font-extrabold">
              {assigned}
            </p>
            <p className="mt-1 text-sm">
              {missing === 0
                ? "Tout le monde a son défi."
                : `${missing} participant${missing > 1 ? "s" : ""} sans défi du jour.`}
            </p>
          </CardBody>
        </Card>
      </div>

      <Alert tone="info" title="Appuyer deux fois ne change rien">
        Les participants qui ont déjà leur défi sont ignorés, le tirage donne
        toujours le même résultat pour une personne et un jour, et la base
        refuse une seconde attribution. En cas de doute, relancez.
      </Alert>

      <DrawRunner action={runDailyDraw} />
    </div>
  );
}
