"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatJoinCode } from "@/lib/teams/code";
import { TEAM_KINDS } from "@/lib/teams/kinds";
import type { ManageState } from "@/lib/teams/manage-actions";

/**
 * Creating a team on behalf of a company (FR78).
 *
 * **The code is shown once, right after creation**, because that is the
 * moment somebody forwards it to the company's contact. It stays readable
 * afterwards in the team list on the same screen — this is a convenience, not
 * a one-time secret.
 */
function CreateButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Création…" : "Créer l’équipe"}
    </Button>
  );
}

export function AdminCreateTeamForm({
  action,
}: {
  action: (previous: ManageState, formData: FormData) => Promise<ManageState>;
}) {
  const [state, formAction] = useActionState<ManageState, FormData>(action, {});
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("entreprise");

  if (state.joinCode) {
    return (
      <Alert tone="success" title="Équipe créée">
        <p>Transmettez ce code à la personne qui l’animera :</p>
        <p className="text-brand-orange-ink mt-2 font-mono text-2xl font-extrabold tracking-widest">
          {formatJoinCode(state.joinCode)}
        </p>
        <p className="mt-3 text-sm">
          Vous en êtes capitaine sur le papier. Une fois que son contact a
          rejoint l’équipe, désignez-le capitaine dans la liste ci-dessous.
        </p>
      </Alert>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Input
        name="name"
        label="Nom de l’équipe"
        value={name}
        error={state.fieldErrors?.name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
      />

      <Select
        name="kind"
        label="Type"
        options={TEAM_KINDS.map((entry) => ({
          value: entry.value,
          label: entry.label,
        }))}
        value={kind}
        error={state.fieldErrors?.kind}
        onChange={(event) => setKind(event.target.value)}
      />

      <CreateButton />
    </form>
  );
}

/**
 * Handing a team over to the person who will actually run it.
 *
 * The counterpart of creating one for a company: an administrator captains it
 * on paper until the company's contact has an account.
 */
export function AssignCaptainForm({
  action,
  teamId,
  members,
}: {
  action: (previous: ManageState, formData: FormData) => Promise<ManageState>;
  teamId: string;
  members: Array<{ profileId: string; displayName: string }>;
}) {
  const [state, formAction] = useActionState<ManageState, FormData>(action, {});
  const [profileId, setProfileId] = useState(members[0]?.profileId ?? "");

  if (members.length === 0) {
    return (
      <p className="text-ink-muted text-sm">
        Personne n’a encore rejoint cette équipe.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="teamId" value={teamId} />

      <Select
        name="profileId"
        label="Désigner un capitaine"
        options={members.map((member) => ({
          value: member.profileId,
          label: member.displayName,
        }))}
        value={profileId}
        onChange={(event) => setProfileId(event.target.value)}
        className="min-w-48"
      />

      <Button type="submit" variant="secondary" size="sm">
        Désigner
      </Button>

      {state.message && (
        <p role="alert" className="text-danger text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
