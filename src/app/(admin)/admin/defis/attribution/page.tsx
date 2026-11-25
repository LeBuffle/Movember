import Link from "next/link";

import {
  CancelCommonChallenge,
  CommonChallengeForm,
} from "@/components/admin/common-challenge-form";
import { DrawRunner } from "@/components/admin/draw-runner";
import { SimulatedActivities } from "@/components/admin/simulated-activities";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { injectSimulatedActivities } from "@/lib/activities/actions";
import { SIMULATION_ALLOWED } from "@/lib/activities/simulation";
import {
  cancelCommonChallenge,
  runDailyDraw,
  scheduleCommonChallenge,
} from "@/lib/challenges/admin-actions";
import {
  listChallengeOptions,
  listCommonChallenges,
} from "@/lib/challenges/common";
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

  const [commons, options] = await Promise.all([
    listCommonChallenges(),
    listChallengeOptions(),
  ]);

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

      <section aria-labelledby="commun" className="space-y-4">
        <div>
          <h2 id="commun" className="text-ink text-xl font-bold">
            Défi commun
          </h2>
          <p className="text-ink-muted mt-1 text-sm">
            Le même défi pour tout le monde un jour donné — le 11 novembre, un
            week-end. C’est ce qui donne au mois ses moments partagés : sans
            lui, chacun avance seul avec ses propres défis.
          </p>
        </div>

        {commons.length > 0 && (
          <ul className="border-line divide-line divide-y rounded-xl border">
            {commons.map((common) => (
              <li
                key={common.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div>
                  <p className="text-ink font-medium">
                    {common.scheduledFor} — {common.challengeTitle}
                  </p>
                  <p className="text-ink-muted text-sm">
                    {common.mode === "replace"
                      ? "À la place du défi du jour"
                      : "En plus du défi du jour"}
                    {common.cancelled && " — annulé"}
                  </p>
                </div>

                {common.cancellable && (
                  <CancelCommonChallenge
                    action={cancelCommonChallenge}
                    id={common.id}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <CommonChallengeForm
          action={scheduleCommonChallenge}
          challenges={options}
        />
      </section>

      {SIMULATION_ALLOWED && (
        <section aria-labelledby="simulees" className="space-y-4">
          <div>
            <h2 id="simulees" className="text-ink text-xl font-bold">
              Activités simulées
            </h2>
            <p className="text-ink-muted mt-1 text-sm">
              Une dizaine de sorties inventées — course, vélo, natation, marche,
              renforcement — injectées sur votre propre compte. Elles font
              tourner le moteur de bout en bout sans aucun compte Strava : le
              défi se valide, les points tombent, l’historique se remplit.
            </p>
          </div>

          {/* Absent from production, not merely disabled: made-up activities
              on the real edition would put points on a real leaderboard, and
              there is no undoing that quietly. */}
          <Alert tone="warning" title="Préproduction uniquement">
            Cette section n’existe pas en production. Ces activités sont
            fabriquées : elles ne viennent d’aucune montre et ne prouvent rien.
          </Alert>

          <SimulatedActivities action={injectSimulatedActivities} day={date} />
        </section>
      )}
    </div>
  );
}
