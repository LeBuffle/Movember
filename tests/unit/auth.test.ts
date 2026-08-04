import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { authErrorMessage, linkErrorMessage } from "@/lib/auth/messages";
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

describe("les liens d’e-mail qui échouent disent pourquoi", () => {
  it("explique un lien incomplet", () => {
    expect(linkErrorMessage("lien-invalide")).toMatch(/incomplet/i);
  });

  it("évoque le mauvais navigateur, pas seulement l’expiration", () => {
    // Dire « votre lien a expiré » à quelqu'un qui l'a simplement ouvert sur
    // un autre appareil l'envoie en demander un nouveau, qui échouera pareil.
    const message = linkErrorMessage("lien-expire");

    expect(message).toMatch(/navigateur/i);
    expect(message).toMatch(/même appareil/i);
  });

  it("ne dit rien quand il n’y a rien à dire", () => {
    expect(linkErrorMessage(undefined)).toBeUndefined();
    expect(linkErrorMessage("code-inconnu")).toBeUndefined();
  });

  it("est bien affiché par la page de connexion", () => {
    // Le défaut corrigé : la route de confirmation renvoyait un code que la
    // page ignorait, et le participant tombait sur un formulaire muet.
    const page = readFileSync(
      path.join(
        import.meta.dirname,
        "../../src/app/(public)/connexion/page.tsx",
      ),
      "utf8",
    );

    expect(page).toMatch(/linkErrorMessage\(erreur\)/);
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
