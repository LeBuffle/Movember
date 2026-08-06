import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildPayload,
  ESSENTIAL_CATEGORIES,
  MAX_BODY,
  MAX_TITLE,
  safePath,
} from "@/lib/notifications/payload";

/* =========================================================================
 * L'envoi par lots (story 6.3)
 *
 * La seule opération du projet qui touche 800 destinataires d'un coup, et
 * celle que l'architecture désigne comme le goulot d'étranglement du
 * 1ᵉʳ novembre — devant le serveur web.
 *
 * Une notification envoyée est envoyée : elle ne se rattrape pas. D'où trois
 * exigences qui n'ont rien à voir avec la vitesse — ne jamais envoyer deux
 * fois, retirer ce qui est mort, et ne pas confondre mort avec fâché.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/--.*$/gm, "");
}

const migration = code(
  read("supabase/migrations/20260806180000_notification_deliveries.sql"),
);
const send = code(read("src/lib/notifications/send.ts"));

describe("un envoi ne part jamais deux fois", () => {
  it("la garde est un index unique, pas une vérification dans le code", () => {
    // AC 5. Deux exécutions qui se chevauchent lisent toutes les deux « pas
    // encore envoyé » et envoient toutes les deux ; seul un index refuse.
    expect(migration).toMatch(
      /create unique index notification_deliveries_once/,
    );
    expect(migration).toMatch(/\(profile_id, dedupe_key\)/);
  });

  it("la ligne est écrite avant l'envoi, jamais après", () => {
    const claimAt = send.indexOf("async function claim");
    const sendAt = send.indexOf("export async function sendPush");
    const insertAt = send.indexOf(".upsert(");
    const deliverAt = send.indexOf("webpush.sendNotification");

    expect(claimAt).toBeGreaterThan(-1);
    expect(sendAt).toBeGreaterThan(-1);
    // La réservation est appelée avant que le premier abonnement soit lu.
    expect(send.slice(sendAt).indexOf("await claim(")).toBeLessThan(
      send.slice(sendAt).indexOf("push_subscriptions"),
    );
    expect(insertAt).toBeLessThan(deliverAt);
  });

  it("un conflit se lit comme « déjà fait », pas comme une erreur", () => {
    expect(send).toMatch(/ignoreDuplicates: true/);
    expect(send).toMatch(/onConflict: "profile_id,dedupe_key"/);
  });

  it("préfère ne rien envoyer à tout envoyer deux fois", () => {
    // Une notification manquée est une déception ; une notification doublée
    // est un défaut sur lequel les gens écrivent.
    const region = send.slice(send.indexOf("async function claim"));

    expect(region).toMatch(/if \(error\)[\s\S]*?return \[\]/);
  });
});

describe("un point de terminaison mort est retiré", () => {
  it("404 et 410 désactivent immédiatement", () => {
    // AC 3. Désinstallation, navigateur effacé, abonnement tourné : c'est le
    // service de push qui dit « cette adresse n'existe plus ».
    expect(send).toMatch(/function isGone/);
    expect(send).toMatch(/status === 404 \|\| status === 410/);
  });

  it("le reste ne désactive pas", () => {
    // AC 4. 429 et tous les 5xx veulent dire « pas maintenant » : retirer
    // là-dessus couperait un participant en bonne santé, silencieusement.
    const region = send.slice(send.indexOf("function isGone"));
    const guard = region.slice(0, region.indexOf("}"));

    expect(guard).not.toMatch(/429/);
    expect(guard).not.toMatch(/50\d/);
  });

  it("un abonnement qui échoue sans fin finit quand même par être retiré", () => {
    expect(send).toMatch(/MAX_FAILURES/);
    expect(send).toMatch(/failures >= MAX_FAILURES/);
  });

  it("un envoi réussi remet le compteur d'échecs à zéro", () => {
    // Sinon cinq échecs étalés sur le mois retirent un appareil qui marche.
    expect(send).toMatch(/last_success_at[\s\S]{0,60}failure_count: 0/);
  });
});

describe("les lots", () => {
  it("découpent l'envoi", () => {
    // AC 1, 2.
    expect(send).toMatch(/const BATCH_SIZE = \d+/);
    expect(send).toMatch(/start \+= BATCH_SIZE/);
  });

  it("laissent un envoi raté n'emporter que lui-même", () => {
    // `all` abandonnerait les quarante-neuf autres au premier rejet — et le
    // 1ᵉʳ novembre au matin, il y aura des rejets.
    expect(send).toMatch(/Promise\.allSettled/);
    expect(send).not.toMatch(/await Promise\.all\(/);
  });
});

describe("le compte rendu", () => {
  it("distingue envoyé, échoué, désactivé et ignoré", () => {
    // AC 6. « Ignoré » et « échoué » ne sont pas la même nouvelle : l'un est
    // quelqu'un qui n'a jamais autorisé, l'autre une notification qui n'est
    // pas arrivée.
    expect(send).toMatch(/sent: number/);
    expect(send).toMatch(/failed: number/);
    expect(send).toMatch(/disabled: number/);
    expect(send).toMatch(/skipped: number/);
  });
});

describe("le contenu d'une notification", () => {
  it("ne transporte rien de personnel", () => {
    // Une charge utile transite par le service de push du fabricant et reste
    // sur l'appareil : ce qui n'est pas envoyé ne peut fuiter ni de l'un ni
    // de l'autre.
    const payload = code(read("src/lib/notifications/payload.ts"));

    expect(payload).not.toMatch(/email/i);
    expect(payload).not.toMatch(/profile_id/);
    expect(payload).not.toMatch(/display_name/);
  });

  it("coupe les longueurs ici, pas sur le téléphone", () => {
    // Chaque plateforme tronque à sa façon et aucune ne prévient : une phrase
    // dont la chute est à la fin devient une phrase sans chute.
    const long = "a".repeat(300);
    const built = buildPayload({ title: long, body: long });

    expect(built.title.length).toBeLessThanOrEqual(MAX_TITLE);
    expect(built.body.length).toBeLessThanOrEqual(MAX_BODY);
  });

  it("coupe sur un mot, pas au milieu d'un autre", () => {
    const built = buildPayload({
      title: "Titre",
      body: `${"mot ".repeat(60)}fin`,
    });

    expect(built.body.endsWith("…")).toBe(true);
    expect(built.body).not.toMatch(/mo…$/);
  });

  it("ne laisse jamais un titre vide", () => {
    expect(buildPayload({ title: "   " }).title).toBe("DEFI Movember");
  });

  it("ne sort jamais de l'application", () => {
    // Contre une faute de frappe dans un message composé depuis le
    // back-office, pas contre un attaquant.
    expect(safePath("https://ailleurs.fr")).toBe("/jeu");
    expect(safePath("//ailleurs.fr")).toBe("/jeu");
    expect(safePath("/\\ailleurs.fr")).toBe("/jeu");
    expect(safePath("/jeu/collection")).toBe("/jeu/collection");
  });
});

describe("le repli e-mail ne concerne que l'essentiel", () => {
  it("trois catégories, pas cinq", () => {
    // Architecture D6 : un e-mail par événement représenterait jusqu'à 70 000
    // envois sur le mois.
    expect(ESSENTIAL_CATEGORIES).toEqual([
      "defi_du_jour",
      "annonce",
      "relance",
    ]);
    expect(ESSENTIAL_CATEGORIES).not.toContain("resultat");
    expect(ESSENTIAL_CATEGORIES).not.toContain("carte");
  });
});

describe("le journal des envois", () => {
  it("n'est lisible que par l'organisation", () => {
    expect(migration).toMatch(
      /create policy "admins read the delivery log"[\s\S]*?is_admin/,
    );
  });

  it("n'est écrit par personne depuis le navigateur", () => {
    expect(migration).not.toMatch(/for insert/i);
    expect(migration).not.toMatch(/for update/i);
    expect(migration).not.toMatch(/for delete/i);
    expect(migration).not.toMatch(/for all/i);
  });

  it("active la sécurité au niveau des lignes", () => {
    expect(migration).toMatch(
      /alter table public\.notification_deliveries enable row level security/,
    );
  });
});

describe("sans clés, rien n'est envoyé et rien n'est cassé", () => {
  it("l'absence de clés est constatée avant toute réservation", () => {
    const region = send.slice(send.indexOf("export async function sendPush"));

    expect(region.indexOf("configure()")).toBeLessThan(
      region.indexOf("await claim("),
    );
  });
});
