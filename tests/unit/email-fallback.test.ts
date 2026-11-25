import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { notificationEmail, escapeHtml } from "@/lib/email/templates";
import { buildPayload } from "@/lib/notifications/payload";
import {
  signUnsubscribe,
  verifyUnsubscribe,
} from "@/lib/notifications/unsubscribe";

/* =========================================================================
 * Le repli e-mail (story 6.4)
 *
 * Un canal de premier rang, pas une rustine : il concerne tous ceux qui
 * n'installeront pas l'application — et sur iPhone, ce sera beaucoup de
 * monde. Les traiter comme des participants de seconde zone serait exactement
 * ce que l'epic cherche à éviter.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const client = code(read("src/lib/email/client.ts"));
const fallback = code(read("src/lib/notifications/email-fallback.ts"));
const dispatch = code(read("src/lib/notifications/dispatch.ts"));
const actions = code(read("src/lib/notifications/unsubscribe-actions.ts"));
const page = code(read("src/app/(public)/desabonnement/page.tsx"));
const form = code(read("src/components/notifications/unsubscribe-form.tsx"));

/* Le jeton est signé à partir de TOKEN_ENCRYPTION_KEY. Les tests posent leur
   propre valeur pour ne dépendre d'aucun environnement. */
process.env.TOKEN_ENCRYPTION_KEY ??= "a".repeat(64);

describe("le service d'envoi", () => {
  it("est complètement inerte sans clé", () => {
    // Même arrangement que Sentry et Stripe : l'application marche, les
    // e-mails ne partent pas, et le journal le dit. C'est l'état actuel.
    expect(client).toMatch(/export function emailConfigured/);
    expect(client).toMatch(/if \(!emailConfigured\(\)\)/);
    expect(client).toMatch(/reason: "unconfigured"/);
  });

  it("n'ajoute aucune dépendance", () => {
    // Une requête, trois en-têtes, un corps JSON.
    expect(client).toMatch(/await fetch\(ENDPOINT/);
    expect(client).not.toMatch(/from "resend"/);
  });

  it("ne journalise jamais une adresse", () => {
    // Une ligne de journal survit au compte auquel elle se rapporte.
    const logs = client.match(/console\.\w+\([\s\S]*?\);/g) ?? [];

    for (const line of logs) {
      expect(line).not.toMatch(/message\.to/);
      expect(line).not.toMatch(/recipient/);
    }
  });

  it("pose l'en-tête de désabonnement en un clic", () => {
    // C'est ce que les fournisseurs lisent, et ce qui garde un expéditeur de
    // masse hors du dossier indésirable — bien plus que la formulation.
    expect(client).toMatch(/List-Unsubscribe/);
    expect(client).toMatch(/List-Unsubscribe=One-Click/);
  });

  it("abandonne un envoi qui traîne", () => {
    expect(client).toMatch(/AbortSignal\.timeout/);
  });
});

describe("le contenu de l'e-mail", () => {
  const content = notificationEmail({
    payload: buildPayload({
      title: "Votre défi du jour",
      body: "5 km avant le café.",
      url: "/jeu",
    }),
    actionUrl: "https://exemple.fr/jeu",
    unsubscribeUrl: "https://exemple.fr/desabonnement?jeton=abc",
  });

  it("porte toujours une version texte", () => {
    // Un message en HTML seul est un signal de courrier indésirable connu, et
    // certains clients n'affichent que ça.
    expect(content.text.length).toBeGreaterThan(0);
    expect(content.text).toMatch(/Votre défi du jour/);
  });

  it("ne charge rien depuis l'extérieur, logo compris", () => {
    // Rien à charger, donc rien de bloqué, rien à consentir, et un message
    // qui ressemble moins à de la publicité. Le logo est délibérément absent
    // ici : ces e-mails partent souvent, et une image bloquée par défaut en
    // tête d'un rappel quotidien est du bruit qui demande une autorisation.
    // Le mail de bienvenue, lui, le porte — il arrive une fois et il est lu.
    expect(content.html).not.toMatch(/<img/);
    expect(content.html).not.toMatch(/<script/);
    expect(content.html).not.toMatch(/<link/);
  });

  it("porte le lien de désabonnement dans le corps aussi", () => {
    // L'en-tête est ce que le fournisseur lit ; le lien est ce qu'un humain
    // trouve.
    expect(content.html).toMatch(/desabonnement/);
    expect(content.text).toMatch(/desabonnement/);
  });

  it("rappelle l'indépendance vis-à-vis de la fondation", () => {
    expect(content.text).toMatch(/sans lien avec la fondation Movember/);
    expect(content.html).toMatch(/sans lien avec la fondation Movember/);
  });

  it("échappe ce qu'un bénévole a saisi", () => {
    // Un titre de défi vient d'un formulaire du back-office. Il contiendra une
    // apostrophe, un « & », tôt ou tard un « < ».
    const risky = notificationEmail({
      payload: buildPayload({ title: "Fromage & <script>", url: "/jeu" }),
      actionUrl: "https://exemple.fr/jeu",
    });

    expect(risky.html).not.toMatch(/<script>/);
    expect(risky.html).toMatch(/&amp;/);
    expect(escapeHtml("a<b>&'\"")).toBe("a&lt;b&gt;&amp;&#39;&quot;");
  });

  it("part sans lien de désabonnement plutôt que de ne pas partir", () => {
    const bare = notificationEmail({
      payload: buildPayload({ title: "Titre", url: "/jeu" }),
      actionUrl: "https://exemple.fr/jeu",
    });

    expect(bare.html.length).toBeGreaterThan(0);
    expect(bare.text).not.toMatch(/desabonnement/);
  });
});

describe("jamais les deux canaux", () => {
  it("le répartiteur range chacun dans un seul", () => {
    // AC 3. Un doublon n'est pas deux fois plus d'attention.
    expect(dispatch).toMatch(/byChannel\[channel\]\.push\(profileId\)/);
    expect(dispatch).toMatch(/byChannel\.push/);
    expect(dispatch).toMatch(/byChannel\.email/);
  });

  it("les deux branches réservent dans le même registre", () => {
    // C'est ce qui garantit qu'un participant ne reçoit pas le même message
    // une fois par push et une fois par e-mail via deux chemins différents.
    expect(dispatch).toMatch(/claimDelivery/);
    expect(code(read("src/lib/notifications/send.ts"))).toMatch(
      /claimDelivery/,
    );
  });

  it("une panne d'e-mail ne retient pas le push", () => {
    // AC 6. Les deux canaux touchent des gens différents : rien à sérialiser.
    expect(dispatch).toMatch(/await Promise\.all\(\[\s*sendPush/);
  });
});

describe("les envois e-mail", () => {
  it("partent par lots plus petits que le push", () => {
    // Un fournisseur d'e-mail limite le débit, et une rafale de huit cents
    // est ce qui fait brider un domaine d'expédition jeune.
    expect(fallback).toMatch(/const BATCH_SIZE = 20/);
  });

  it("ignorent un compte supprimé", () => {
    expect(fallback).toMatch(/\.is\("deleted_at", null\)/);
  });

  it("comptent « non configuré » à part de « échoué »", () => {
    // Sinon le compte rendu paraîtrait alarmant pendant des mois.
    expect(fallback).toMatch(/reason === "unconfigured"/);
  });
});

describe("le lien de désabonnement", () => {
  it("se vérifie sans session", () => {
    // AC 4. Quelqu'un qui veut que ça s'arrête ne veut pas se connecter — et
    // un lien qui exige une connexion devient un signalement en indésirable.
    const token = signUnsubscribe("profil-123")!;

    expect(token).not.toBeNull();
    expect(verifyUnsubscribe(token)).toEqual({
      ok: true,
      profileId: "profil-123",
    });
  });

  it("refuse un jeton modifié", () => {
    const token = signUnsubscribe("profil-123")!;
    const tampered = token.replace("profil-123", "profil-999");

    expect(verifyUnsubscribe(tampered).ok).toBe(false);
  });

  it("refuse un jeton mal formé", () => {
    expect(verifyUnsubscribe("nimportequoi").ok).toBe(false);
    expect(verifyUnsubscribe("").ok).toBe(false);
  });

  it("expire", () => {
    const long = 1000 * 60 * 60 * 24 * 200;
    const token = signUnsubscribe("profil-123", Date.now() - long)!;

    const checked = verifyUnsubscribe(token);

    expect(checked.ok).toBe(false);
    expect(checked.ok === false && checked.reason).toBe("expired");
  });

  it("vérifie la signature avant la date", () => {
    // Un jeton périmé et un jeton falsifié ne doivent pas se distinguer par
    // le temps que met la réponse.
    const unsubscribe = code(read("src/lib/notifications/unsubscribe.ts"));
    const signatureAt = unsubscribe.indexOf("constantTimeEquals(signature");
    const expiryAt = unsubscribe.indexOf("MAX_AGE_SECONDS)");

    expect(signatureAt).toBeGreaterThan(-1);
    expect(signatureAt).toBeLessThan(expiryAt);
  });

  it("ne réutilise pas la clé de chiffrement telle quelle", () => {
    // Une signature faite pour cet usage ne doit jamais pouvoir être rejouée
    // ailleurs.
    const unsubscribe = code(read("src/lib/notifications/unsubscribe.ts"));

    expect(unsubscribe).toMatch(/const LABEL = /);
    expect(unsubscribe).toMatch(/\.update\(LABEL\)/);
  });
});

describe("la page de désabonnement", () => {
  it("ne lit aucune session", () => {
    expect(page).not.toMatch(/getUser/);
    expect(page).not.toMatch(/redirect\(ROUTES/);
  });

  it("ne se déclenche pas au chargement", () => {
    // Les clients de messagerie et les scanners suivent les liens sans que
    // personne n'ait rien lu.
    expect(form).toMatch(/<form action=\{formAction\}/);
    expect(form).not.toMatch(/useEffect/);
  });

  it("écrit avec la clé de service, l'identité venant du jeton", () => {
    expect(actions).toMatch(/verifyUnsubscribe/);
    expect(actions).toMatch(/createAdminClient/);
    expect(actions).toMatch(/profile_id: checked\.profileId/);

    const verifyAt = actions.indexOf("verifyUnsubscribe");
    const writeAt = actions.indexOf(".upsert(");

    expect(verifyAt).toBeLessThan(writeAt);
  });

  it("coupe le canal e-mail, pas les catégories", () => {
    // Quelqu'un qui appuie veut qu'on laisse sa boîte tranquille, pas
    // arrêter de jouer.
    expect(actions).toMatch(/channel_email: false/);
    expect(actions).not.toMatch(/cat_/);
  });
});
