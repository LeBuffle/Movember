import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { welcomeEmail } from "@/lib/email/templates";

/* =========================================================================
 * E-mail de bienvenue (story 2.5)
 *
 * **C'est le document que la personne rouvrira en avril**, en cherchant un
 * reçu fiscal. Il doit répondre lui-même à cette question, sans renvoyer aux
 * conditions générales : une règle publiée n'est pas une règle lue.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const welcome = code(read("src/lib/registration/welcome.ts"));
const activation = code(read("src/lib/registration/activation.ts"));

function content() {
  return welcomeEmail({
    tierName: "Sportif chevronné",
    grossCents: 3000,
    donationCents: 1800,
    gameUrl: "https://defi-movember.fr/jeu",
  });
}

describe("le contenu de l’e-mail", () => {
  it("reprend le niveau, le montant payé et le montant reversé", () => {
    const { html, text } = content();

    for (const part of [html, text]) {
      expect(part).toContain("Sportif chevronné");
      expect(part).toMatch(/30\s?€/);
      expect(part).toMatch(/18\s?€/);
    }
  });

  it("dit que ce n’est pas un don défiscalisable", () => {
    // FR13 croisé avec CLAUDE.md §6. C'est la question qui se pose en avril,
    // et l'e-mail est ce qu'on retrouve à ce moment-là.
    const { html, text } = content();

    for (const part of [html, text]) {
      expect(part).toMatch(/pas un don/);
      expect(part).toMatch(/[Aa]ucun reçu fiscal/);
      expect(part).toMatch(/CERFA/);
    }
  });

  it("indique la prochaine étape, et elle est bien Strava", () => {
    // Une confirmation qui ne fait que confirmer laisse quelqu'un inscrit et
    // incapable de jouer.
    const { html, text } = content();

    for (const part of [html, text]) {
      expect(part).toMatch(/Strava/);
      expect(part).toMatch(/[Ii]nstallez l’application/);
    }
  });

  it("porte toujours une version texte", () => {
    // Un message uniquement en HTML est un signal de courrier indésirable
    // bien connu, et certains clients n'affichent que celle-ci.
    const { text } = content();

    expect(text.length).toBeGreaterThan(200);
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it("rappelle l’indépendance vis-à-vis de la fondation", () => {
    const { html, text } = content();

    for (const part of [html, text]) {
      expect(part).toMatch(/sans lien avec la fondation/);
    }
  });

  it("n’offre pas de désinscription", () => {
    // C'est un message transactionnel sur un paiement, pas un envoi
    // commercial. Proposer de se désabonner d'un reçu n'a pas de sens.
    const { html } = content();

    expect(html).not.toMatch(/désabonnement|Ne plus recevoir/);
  });

  it("écrit les montants en français", () => {
    expect(
      welcomeEmail({
        tierName: "Niveau",
        grossCents: 1250,
        donationCents: 1000,
        gameUrl: "https://x.fr/jeu",
      }).text,
    ).toMatch(/12,50/);
  });
});

describe("l’envoi", () => {
  it("est réclamé en base avant d’être fait", () => {
    // Le webhook peut être livré deux fois, et deux processus peuvent traiter
    // le même événement en même temps. Un test dans le code serait passé par
    // les deux.
    const claim = welcome.indexOf('.is("welcome_email_sent_at", null)');
    const send = welcome.indexOf("await sendEmail(");

    expect(claim).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(send);
  });

  it("et un envoi raté rend la marque", () => {
    // Sinon la marque dirait « envoyé » d'un e-mail jamais parti, et rien ne
    // reviendrait jamais pour lui.
    expect(welcome).toMatch(/const release = async/);
    expect(welcome).toMatch(/welcome_email_sent_at: null/);
  });

  it("ne réclame que sur une inscription active", () => {
    expect(welcome).toMatch(/\.eq\("status", "active"\)/);
  });

  it("les montants viennent de la ligne comptable, pas du tarif", () => {
    // L'e-mail annonce ce qui a réellement été débité, ce que la personne
    // comparera à son relevé bancaire.
    expect(welcome).toMatch(/from\("payments"\)/);
    expect(welcome).toMatch(/gross_cents, donation_cents/);
  });

  it("un service non configuré n’est pas une erreur", () => {
    // C'est l'état normal tant que le compte Resend n'existe pas, et cela ne
    // doit pas remplir les journaux d'erreurs pendant des mois.
    expect(welcome).toMatch(/reason === "unconfigured"/);
    expect(welcome).toMatch(/console\.info\("\[bienvenue\] service d’envoi/);
  });

  it("il ne peut jamais faire échouer une activation", () => {
    // Quelqu'un qui a payé entre dans le jeu quoi qu'il arrive à son e-mail.
    const region = activation.slice(
      activation.indexOf("await sendWelcomeEmail"),
    );

    expect(region).not.toMatch(/return \{ ok: false/);
  });

  it("et il part après l’activation, pas avant", () => {
    const body = activation.slice(
      activation.indexOf("export async function handleCheckoutCompleted"),
    );

    expect(body.indexOf('.eq("status", "pending")')).toBeLessThan(
      body.indexOf("await sendWelcomeEmail"),
    );
  });
});
