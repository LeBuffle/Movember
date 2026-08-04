import { describe, expect, it } from "vitest";

import { authErrorMessage } from "@/lib/auth/messages";
import { isAuthRoute, requiresAdmin, requiresSession } from "@/lib/auth/routes";
import { displayNameSchema, passwordSchema } from "@/lib/auth/schemas";

describe("route protection", () => {
  it.each([
    ["/mon-compte", true],
    ["/mon-compte/parametres", true],
    ["/jeu/defi-du-jour", true],
    ["/admin", true],
    ["/admin/defis", true],
    ["/", false],
    ["/connexion", false],
    ["/cgv", false],
  ])("%s requiert une session : %s", (path, expected) => {
    expect(requiresSession(path)).toBe(expected);
  });

  it.each([
    ["/admin", true],
    ["/admin/participants", true],
    ["/mon-compte", false],
    // A path merely starting with the same letters must not be treated as
    // admin: `/administration-publique` is not `/admin`.
    ["/administration-publique", false],
  ])("%s requiert le rôle administrateur : %s", (path, expected) => {
    expect(requiresAdmin(path)).toBe(expected);
  });

  it("reconnaît les pages de connexion", () => {
    expect(isAuthRoute("/connexion")).toBe(true);
    expect(isAuthRoute("/inscription")).toBe(true);
    expect(isAuthRoute("/mon-compte")).toBe(false);
  });
});

describe("les messages d'erreur ne révèlent pas si un compte existe", () => {
  it("dit « adresse ou mot de passe » sans distinguer les deux cas", () => {
    const message = authErrorMessage(new Error("Invalid login credentials"));

    expect(message).toBe("Adresse e-mail ou mot de passe incorrect.");
    // Enumerating participants must not be possible through this form.
    expect(message).not.toMatch(/aucun compte|n'existe pas|inconnu/i);
  });

  it("traduit les erreurs connues en français", () => {
    expect(authErrorMessage(new Error("User already registered"))).toMatch(
      /existe déjà/i,
    );
    expect(authErrorMessage(new Error("Email not confirmed"))).toMatch(
      /confirmée/i,
    );
    expect(
      authErrorMessage(new Error("profiles_display_name_unique violation")),
    ).toMatch(/pseudonyme est déjà utilisé/i);
  });

  it("ne laisse jamais fuiter une erreur technique brute", () => {
    const raw = "PGRST301: JWSError JWSInvalidSignature at pg_catalog";
    const message = authErrorMessage(new Error(raw));

    expect(message).not.toContain("PGRST301");
    expect(message).not.toContain("pg_catalog");
    expect(message).toMatch(/une erreur est survenue/i);
  });
});

describe("validation du pseudonyme", () => {
  it.each(["Jean-Pierre", "MoustacheDor", "L'Ours", "Coureur 42", "Ana_B"])(
    "accepte « %s »",
    (name) => {
      expect(displayNameSchema.safeParse(name).success).toBe(true);
    },
  );

  it.each([
    ["A", "trop court"],
    ["a".repeat(31), "trop long"],
    ["<script>alert(1)</script>", "balises"],
    ["moustache@dor", "caractère interdit"],
    ["   ", "espaces seuls"],
  ])("rejette « %s » (%s)", (name) => {
    expect(displayNameSchema.safeParse(name).success).toBe(false);
  });

  it("supprime les espaces autour", () => {
    const parsed = displayNameSchema.safeParse("  MoustacheDor  ");

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("MoustacheDor");
  });
});

describe("validation du mot de passe", () => {
  it("exige 8 caractères", () => {
    expect(passwordSchema.safeParse("court").success).toBe(false);
    expect(passwordSchema.safeParse("assez long").success).toBe(true);
  });

  it("accepte une phrase de passe longue", () => {
    expect(
      passwordSchema.safeParse("mon chien court vite le matin").success,
    ).toBe(true);
  });
});
