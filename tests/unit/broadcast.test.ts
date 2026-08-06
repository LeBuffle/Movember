import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AUDIENCES, isAudience } from "@/lib/notifications/audience";

/* =========================================================================
 * L'envoi manuel depuis le back-office (story 6.8)
 *
 * « Envoyer une notification doit être une saisie, jamais un déploiement »
 * (PRD §2). C'est la story qui rend le mois animable par l'équipe elle-même.
 *
 * Et le vrai garde-fou n'est pas la confirmation : c'est le nombre de
 * destinataires affiché avant le bouton. Un message destiné à une poignée de
 * gens et parti à huit cents ne se rattrape pas.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const audience =
  code(read("src/lib/notifications/broadcast.ts")) +
  code(read("src/lib/notifications/audience.ts"));
const actions = code(read("src/lib/notifications/broadcast-actions.ts"));
const form = code(read("src/components/admin/broadcast-form.tsx"));
const page = code(read("src/app/(admin)/admin/notifications/page.tsx"));
const sections = code(read("src/lib/admin/sections.ts"));

describe("le ciblage", () => {
  it("propose plusieurs audiences", () => {
    // AC 1.
    expect(AUDIENCES.length).toBeGreaterThanOrEqual(3);
    expect(AUDIENCES.map((entry) => entry.value)).toContain("tous");
  });

  it("refuse une audience inventée", () => {
    expect(isAudience("tous")).toBe(true);
    expect(isAudience("tout-le-monde-et-son-chien")).toBe(false);
  });

  it("ne vise que les inscriptions actives", () => {
    // Quelqu'un qui a abandonné en cours de paiement, ou qui a été remboursé,
    // n'est pas un participant et ne doit pas être notifié comme tel.
    expect(audience).toMatch(/\.eq\("status", "active"\)/);
  });

  it("renvoie les identifiants, pas un compte", () => {
    // Compter d'un côté et envoyer de l'autre laisserait les deux diverger
    // entre le moment où on lit le nombre et celui où on appuie.
    expect(audience).toMatch(/Promise<string\[\]>/);
  });
});

describe("le nombre de destinataires", () => {
  it("est calculé côté serveur, par la même requête que l'envoi", () => {
    // AC 2.
    expect(page).toMatch(/audienceMembers/);
    expect(actions).toMatch(/audienceMembers/);
  });

  it("est affiché avant le bouton", () => {
    expect(form).toMatch(/destinataire/);
    expect(form).toMatch(/Envoyer à \$\{recipients\}/);
  });

  it("désactive le bouton quand personne n'est visé", () => {
    expect(form).toMatch(/disabled=\{pending \|\| recipients === 0\}/);
  });
});

describe("les garde-fous", () => {
  it("demandent une confirmation explicite", () => {
    // AC 3.
    expect(form).toMatch(/window\.confirm/);
    expect(form).toMatch(/ne peut pas être annulée/);
  });

  it("empêchent un second envoi par inadvertance", () => {
    // AC 6. Le message porte un identifiant créé au rendu de la page : double
    // appui, bouton retour, rafraîchissement — tous le réutilisent, et le
    // registre refuse le second envoi.
    expect(page).toMatch(/crypto\.randomUUID\(\)/);
    expect(form).toMatch(/name="messageId"/);
    expect(actions).toMatch(/dedupeKey: `annonce:\$\{messageId\}`/);
  });

  it("refusent un titre trop long au lieu de le couper", () => {
    // L'auteur doit voir sa propre phrase, pas découvrir sur un téléphone que
    // sa chute a disparu.
    expect(actions).toMatch(/ne peut pas dépasser 60 caractères/);
  });

  it("ne laissent pas la notification sortir de l'application", () => {
    expect(actions).toMatch(/safePath\(/);
  });
});

describe("les préférences s'appliquent aussi ici", () => {
  it("l'envoi passe par le répartiteur, pas par sendPush", () => {
    // AC 4, et c'est le cas que le critère nomme explicitement.
    expect(actions).toMatch(/from "@\/lib\/notifications\/dispatch"/);
    expect(actions).not.toMatch(/notifications\/send/);
  });

  it("et l'écran le dit", () => {
    expect(page).toMatch(/préférences de\s+chacun sont respectées/);
  });
});

describe("la journalisation", () => {
  it("précède l'envoi", () => {
    // AC 5. Si le processus meurt en plein lot, « quelqu'un a envoyé ça à
    // tout le monde » doit rester lisible.
    const logAt = actions.indexOf("logAdminAction");
    const sendAt = actions.indexOf("await notify(");

    expect(logAt).toBeGreaterThan(-1);
    expect(logAt).toBeLessThan(sendAt);
  });

  it("retient qui, à qui, combien et quoi", () => {
    expect(actions).toMatch(/action: "notification\.broadcast"/);
    expect(actions).toMatch(/audience,/);
    expect(actions).toMatch(/recipients: members\.length/);
    expect(actions).toMatch(/title,/);
  });

  it("vérifie le rôle avant tout", () => {
    const region = actions.slice(
      actions.indexOf("export async function sendBroadcast"),
    );

    expect(region.indexOf("requireAdmin()")).toBeLessThan(
      region.indexOf("audienceMembers("),
    );
  });
});

describe("le compte rendu", () => {
  it("distingue notifications, e-mails, ignorés et échecs", () => {
    // AC 7.
    expect(actions).toMatch(/sent: report\.sent/);
    expect(actions).toMatch(/emailed: report\.emailed/);
    expect(actions).toMatch(/failed: report\.failed/);
    expect(actions).toMatch(/skipped: report\.skipped/);
  });

  it("prévient quand les clés d'envoi manquent", () => {
    // Écrire un message qui n'arrivera nulle part est le pire des retours.
    expect(page).toMatch(/pushSendConfigured\(\)/);
  });
});

describe("la section du back-office", () => {
  it("n'est plus annoncée comme à venir", () => {
    const region = sections.slice(sections.indexOf('slug: "notifications"'));

    expect(region.slice(0, 400)).toMatch(/status: "available"/);
  });
});
