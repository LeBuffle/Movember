import { redirect } from "next/navigation";

import { AccessForm } from "@/components/gate/access-form";
import { unlockAccess } from "@/lib/gate/actions";
import { gateCode } from "@/lib/gate/access";

export const metadata = {
  title: "Accès à la préproduction",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The way in to a non-production environment.
 *
 * A page rather than the browser's password window, and that is the whole
 * point of it. An application added to a phone's home screen does not share
 * the browser's credential store and has no address bar to ask — it answered
 * `401 Unauthorized` and stopped there, which made the one environment where
 * the installed application can be checked the one place it could not be
 * checked (story 1.8).
 *
 * Deliberately says nothing about the project: whoever lands here without the
 * code learns only that a code exists.
 */
export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // No gate in production, and no reason for this page to exist there.
  if (!gateCode()) {
    redirect("/");
  }

  const query = await searchParams;
  const raw = query.suite;
  const next = Array.isArray(raw) ? raw[0] : raw;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="text-center">
        <span className="text-brand-blue text-2xl font-extrabold tracking-tight">
          DEFI
        </span>
        <h1 className="text-ink mt-4 text-2xl font-bold tracking-tight">
          Environnement de test
        </h1>
        <p className="text-ink-muted mt-2 text-sm">
          Cette version n’est pas ouverte au public. Saisissez le code d’accès
          qui vous a été communiqué.
        </p>
      </div>

      <div className="mt-8">
        <AccessForm action={unlockAccess} next={next} />
      </div>
    </main>
  );
}
