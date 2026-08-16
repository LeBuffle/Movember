"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SuperTeamState } from "@/lib/super-teams/manage-actions";

/**
 * The organisation's screen for a federation (story 14.2).
 *
 * Modelled on `/admin/equipes` on purpose, down to the shape of the forms.
 * The back-office is run by volunteers who are not developers: two collective
 * screens that do not look alike are two things to learn instead of one.
 */

type Action = (
  previous: SuperTeamState,
  formData: FormData,
) => Promise<SuperTeamState>;

function SubmitButton({
  idle,
  busy,
  variant = "primary",
  size,
}: {
  idle: string;
  busy: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}

export function CreateSuperTeamForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<SuperTeamState, FormData>(
    action,
    {},
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        setName("");
        setDescription("");
      }}
      className="space-y-4"
    >
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <Input
        name="name"
        label="Nom de la super-équipe"
        hint="Le nom de la fédération, tel que ses équipes le reconnaîtront."
        value={name}
        error={state.fieldErrors?.name}
        onChange={(event) => setName(event.target.value)}
        maxLength={80}
      />

      <Textarea
        name="description"
        label="Description (facultatif)"
        hint="Son capitaine pourra la modifier ensuite."
        value={description}
        error={state.fieldErrors?.description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={1000}
      />

      <SubmitButton idle="Créer la super-équipe" busy="Création…" />
    </form>
  );
}

export function AttachTeamForm({
  action,
  superTeamId,
  teams,
}: {
  action: Action;
  superTeamId: string;
  teams: Array<{ id: string; name: string; memberCount: number }>;
}) {
  const [state, formAction] = useActionState<SuperTeamState, FormData>(
    action,
    {},
  );
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");

  if (teams.length === 0) {
    return (
      <p className="text-ink-muted text-sm">
        Toutes les équipes de l’édition appartiennent déjà à une super-équipe.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="superTeamId" value={superTeamId} />

      <Select
        name="teamId"
        label="Rattacher une équipe"
        options={teams.map((team) => ({
          value: team.id,
          label: `${team.name} — ${team.memberCount} membre${team.memberCount > 1 ? "s" : ""}`,
        }))}
        value={teamId}
        onChange={(event) => setTeamId(event.target.value)}
        className="min-w-64"
      />

      <SubmitButton idle="Rattacher" busy="…" variant="secondary" size="sm" />

      {state.message && (
        <p role="alert" className="text-danger w-full text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}

/**
 * Detaching, behind a confirmation that says what it does **and what it does
 * not**.
 *
 * The second half is the one that matters. The gesture is frightening for a
 * good reason, and an administrator who does not dare detach a team calls the
 * Product Owner instead — so the sentence spells out that the team keeps its
 * members, its points and its general rank.
 */
export function DetachTeamForm({
  action,
  teamId,
  teamName,
}: {
  action: Action;
  teamId: string;
  teamName: string;
}) {
  const [state, formAction] = useActionState<SuperTeamState, FormData>(
    action,
    {},
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          Détacher
        </Button>

        {state.message && (
          <p className="text-ink-muted text-sm">{state.message}</p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="teamId" value={teamId} />

      <Alert tone="warning" title={`Détacher ${teamName} ?`}>
        Elle sortira du classement interne de cette super-équipe. Elle garde ses
        membres, ses points et son rang au classement général.
      </Alert>

      <div className="flex gap-2">
        <SubmitButton idle="Détacher" busy="…" variant="danger" size="sm" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function AssignSuperCaptainForm({
  action,
  superTeamId,
  members,
}: {
  action: Action;
  superTeamId: string;
  members: Array<{ profileId: string; displayName: string; teamName: string }>;
}) {
  const [state, formAction] = useActionState<SuperTeamState, FormData>(
    action,
    {},
  );
  const [profileId, setProfileId] = useState(members[0]?.profileId ?? "");

  if (members.length === 0) {
    return (
      <p className="text-ink-muted text-sm">
        Le capitaine se choisit parmi les membres des équipes rattachées. Il n’y
        en a pas encore.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="superTeamId" value={superTeamId} />

      <Select
        name="profileId"
        label="Désigner le capitaine"
        hint="Il pourra changer le logo et la description, rien d’autre."
        options={members.map((member) => ({
          value: member.profileId,
          label: `${member.displayName} (${member.teamName})`,
        }))}
        value={profileId}
        onChange={(event) => setProfileId(event.target.value)}
        className="min-w-64"
      />

      <SubmitButton idle="Désigner" busy="…" variant="secondary" size="sm" />

      {state.message && (
        <p role="alert" className="text-danger w-full text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function DeleteSuperTeamForm({
  action,
  superTeamId,
  name,
  teamCount,
}: {
  action: Action;
  superTeamId: string;
  name: string;
  teamCount: number;
}) {
  const [state, formAction] = useActionState<SuperTeamState, FormData>(
    action,
    {},
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          Supprimer la super-équipe
        </Button>

        {state.message && (
          <p className="text-ink-muted text-sm">{state.message}</p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="superTeamId" value={superTeamId} />

      <Alert tone="warning" title={`Supprimer ${name} ?`}>
        {teamCount === 0
          ? "Aucune équipe n’y est rattachée."
          : `Ses ${teamCount} équipes seront détachées. Aucune ne sera supprimée : elles gardent leurs membres, leurs points et leur rang au classement général.`}
      </Alert>

      <div className="flex gap-2">
        <SubmitButton idle="Supprimer" busy="…" variant="danger" size="sm" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
