"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ManageState } from "@/lib/teams/manage-actions";
import type { TeamMember } from "@/lib/teams/manage";

/**
 * The team, and what its captain can do about it.
 *
 * **Every destructive gesture asks first, and names the person.** "Exclure
 * Sophie de l'équipe ?" is a question somebody answers correctly; "Êtes-vous
 * sûr ?" is a question everybody clicks through.
 *
 * A member who is not the captain sees the list and no buttons. Hiding them
 * is a courtesy rather than a protection — the server establishes who the
 * captain is on every call, and would refuse.
 */

type Action = (
  previous: ManageState,
  formData: FormData,
) => Promise<ManageState>;

function ActionButton({
  label,
  busy,
  confirmation,
  variant = "ghost",
}: {
  label: string;
  busy: string;
  confirmation?: string;
  variant?: "ghost" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={(event) => {
        if (confirmation && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? busy : label}
    </Button>
  );
}

function MemberActions({
  member,
  remove,
  handOver,
}: {
  member: TeamMember;
  remove: Action;
  handOver: Action;
}) {
  const [removeState, removeAction] = useActionState<ManageState, FormData>(
    remove,
    {},
  );
  const [handOverState, handOverAction] = useActionState<ManageState, FormData>(
    handOver,
    {},
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <form action={handOverAction}>
          <input type="hidden" name="profileId" value={member.profileId} />
          <ActionButton
            label="Transmettre le rôle"
            busy="…"
            variant="secondary"
            confirmation={`Transmettre le rôle de capitaine à ${member.displayName} ? Vous resterez dans l’équipe comme membre, et ne pourrez plus inviter ni exclure.`}
          />
        </form>

        <form action={removeAction}>
          <input type="hidden" name="profileId" value={member.profileId} />
          <ActionButton
            label="Exclure"
            busy="…"
            confirmation={`Exclure ${member.displayName} de l’équipe ? Ses défis, ses points et ses cartes lui restent — elle ou il ne comptera simplement plus pour l’équipe.`}
          />
        </form>
      </div>

      {(removeState.message ?? handOverState.message) && (
        <p role="alert" className="text-danger text-sm">
          {removeState.message ?? handOverState.message}
        </p>
      )}
    </div>
  );
}

export function MemberList({
  members,
  isCaptain,
  remove,
  handOver,
}: {
  members: TeamMember[];
  isCaptain: boolean;
  remove: Action;
  handOver: Action;
}) {
  return (
    <ul className="border-line divide-line divide-y border-y">
      {members.map((member) => (
        <li
          key={member.profileId}
          className="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div>
            <p className="text-ink font-medium">
              {member.displayName}
              {member.isSelf && (
                <span className="text-ink-muted font-normal"> — vous</span>
              )}
            </p>
            {member.role === "capitaine" && (
              <Badge tone="orange">Capitaine</Badge>
            )}
          </div>

          {isCaptain && !member.isSelf && (
            <MemberActions
              member={member}
              remove={remove}
              handOver={handOver}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export function LeaveTeamForm({
  action,
  isCaptain,
  alone,
}: {
  action: Action;
  isCaptain: boolean;
  alone: boolean;
}) {
  const [state, formAction] = useActionState<ManageState, FormData>(action, {});

  if (state.done) {
    return (
      <p role="status" className="text-ink-muted text-sm">
        {state.message}
      </p>
    );
  }

  // Said before the button rather than discovered by pressing it. A captain
  // who has to hand over first should read that here, not in a refusal.
  if (isCaptain && !alone) {
    return (
      <p className="text-ink-muted text-sm">
        Vous êtes capitaine : transmettez d’abord le rôle à un autre membre pour
        pouvoir quitter l’équipe. Une équipe sans capitaine ne peut plus inviter
        personne.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <ActionButton
        label="Quitter l’équipe"
        busy="…"
        confirmation={
          alone
            ? "Quitter l’équipe ? Vous en êtes le dernier membre : elle sera dissoute. Vos défis, vos points et vos cartes ne bougent pas."
            : "Quitter l’équipe ? Vos défis, vos points et vos cartes ne bougent pas."
        }
      />

      {state.message && (
        <p role="alert" className="text-danger text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
