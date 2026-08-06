"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { TeamFormState } from "@/lib/teams/actions";
import { TEAM_KINDS } from "@/lib/teams/membership";

/**
 * Joining a team, or starting one.
 *
 * **Joining comes first on the screen, and that is deliberate.** Most people
 * arrive here because somebody gave them a code; creating a team is the
 * captain's gesture, and there is one captain for every twenty members.
 *
 * Ordinary forms pointing at server actions, so both work before the script
 * arrives — a code is often typed on a phone, standing up, on a bad
 * connection.
 */

type Action = (
  previous: TeamFormState,
  formData: FormData,
) => Promise<TeamFormState>;

function SubmitButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

export function JoinTeamForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<TeamFormState, FormData>(
    action,
    {},
  );
  const [code, setCode] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone="warning">{state.message}</Alert>}

      <Input
        name="code"
        label="Code de l’équipe"
        hint="Huit caractères, donnés par le capitaine. La casse et les tirets n’ont pas d’importance."
        placeholder="ABCD-EFGH"
        value={code}
        error={state.fieldErrors?.code}
        onChange={(event) => setCode(event.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={20}
      />

      <SubmitButton label="Rejoindre l’équipe" busy="Adhésion…" />
    </form>
  );
}

export function CreateTeamForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<TeamFormState, FormData>(
    action,
    {},
  );
  const [name, setName] = useState("");
  const [kind, setKind] = useState(TEAM_KINDS[0]!.value);

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone="warning">{state.message}</Alert>}

      <Input
        name="name"
        label="Nom de l’équipe"
        hint="Ce que les autres verront au classement. Exemple : « Les Moustachus du mardi »."
        value={name}
        error={state.fieldErrors?.name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
      />

      <Select
        name="kind"
        label="Type"
        hint="Sert seulement à s’y retrouver dans les listes. Aucun effet sur le jeu."
        options={TEAM_KINDS.map((entry) => ({
          value: entry.value,
          label: entry.label,
        }))}
        value={kind}
        error={state.fieldErrors?.kind}
        onChange={(event) =>
          setKind(event.target.value as (typeof TEAM_KINDS)[number]["value"])
        }
      />

      <SubmitButton label="Créer l’équipe" busy="Création…" />
    </form>
  );
}
