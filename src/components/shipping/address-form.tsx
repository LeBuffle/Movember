"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AddressFormState } from "@/lib/shipping/actions";
import type { StoredAddress } from "@/lib/shipping/address";

/**
 * Where to send the medal.
 *
 * Free-text fields, deliberately. A strict format check would reject a
 * lieu-dit with no street number, a "BP", a Belgian postcode — real addresses
 * that a postman handles without difficulty and a regular expression does
 * not. What is checked is what the database will accept, so a refusal is a
 * sentence here rather than an error nobody can read.
 */
function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending
        ? "Enregistrement…"
        : editing
          ? "Enregistrer les modifications"
          : "Enregistrer mon adresse"}
    </Button>
  );
}

export function AddressForm({
  action,
  address,
}: {
  action: (
    previous: AddressFormState,
    formData: FormData,
  ) => Promise<AddressFormState>;
  address: StoredAddress | null;
}) {
  const [state, formAction] = useActionState<AddressFormState, FormData>(
    action,
    {},
  );

  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      {state.saved && (
        <Alert tone="success" title="Adresse enregistrée">
          Vous pourrez la corriger jusqu’à la fin du jeu.
        </Alert>
      )}

      <Input
        name="recipient_name"
        label="Nom du destinataire"
        hint="Le nom qui figurera sur le colis — pas votre pseudonyme."
        defaultValue={address?.recipient_name ?? ""}
        error={errors.recipient_name}
        autoComplete="name"
        maxLength={120}
      />

      <Input
        name="line1"
        label="Adresse"
        hint="Numéro et rue, ou lieu-dit."
        defaultValue={address?.line1 ?? ""}
        error={errors.line1}
        autoComplete="address-line1"
        maxLength={160}
      />

      <Input
        name="line2"
        label="Complément (facultatif)"
        hint="Bâtiment, étage, boîte aux lettres."
        defaultValue={address?.line2 ?? ""}
        error={errors.line2}
        autoComplete="address-line2"
        maxLength={160}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          name="postal_code"
          label="Code postal"
          defaultValue={address?.postal_code ?? ""}
          error={errors.postal_code}
          autoComplete="postal-code"
          maxLength={16}
        />

        <Input
          name="city"
          label="Ville"
          defaultValue={address?.city ?? ""}
          error={errors.city}
          autoComplete="address-level2"
          maxLength={100}
        />
      </div>

      <Input
        name="country"
        label="Pays"
        hint="Code à deux lettres : FR pour la France, BE pour la Belgique."
        defaultValue={address?.country ?? "FR"}
        error={errors.country}
        autoComplete="country"
        maxLength={2}
        className="sm:max-w-32"
      />

      <SubmitButton editing={Boolean(address)} />
    </form>
  );
}
