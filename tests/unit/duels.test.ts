import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { withinDuelWindow } from "@/lib/duels/evaluate";
import {
  EXPIRY_MESSAGE_KEYS,
  EXPIRY_MESSAGES,
  expiryMessage,
} from "@/lib/duels/messages";
import { SEND_MESSAGES } from "@/lib/duels/send";

/* =========================================================================
 * Défis entre joueurs (epic 12)
 *
 * **C'est le premier mécanisme où deux participants agissent l'un sur
 * l'autre**, et c'est aussi le seul geste payant où le navigateur choisit une
 * personne. Ce fichier protège les quatre choses qui, si elles cèdent, font
 * perdre de l'argent ou de la confiance :
 *
 *   - un crédit débité sans défi envoyé, ou l'inverse ;
 *   - un webhook rejoué qui crédite deux fois ;
 *   - une sortie du matin qui valide un défi reçu le soir ;
 *   - un participant qu'on ne peut plus protéger.
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
    .replace(/^\s*--.*$/gm, "");
}

const migration = code(
  read("supabase/migrations/20260806300000_player_duels.sql"),
);
const purchase = code(read("src/lib/duels/purchase.ts"));
const checkout = code(read("src/lib/duels/checkout.ts"));
const creditActions = code(read("src/lib/duels/credit-actions.ts"));
const actions = code(read("src/lib/duels/actions.ts"));
const evaluateSource = code(read("src/lib/duels/evaluate.ts"));
const notify = code(read("src/lib/duels/notify.ts"));
const sweep = code(read("src/lib/duels/sweep.ts"));
const wallet = code(read("src/lib/duels/wallet.ts"));
const catalogue = code(read("src/lib/duels/catalogue.ts"));
const activation = code(read("src/lib/registration/activation.ts"));
const breakdown = code(read("src/lib/accounting/breakdown.ts"));
const exportSource = code(read("src/lib/accounting/export.ts"));
const crontab = read("deploy/crontab");
const seed = read("supabase/seed.sql");

/* -------------------------------------------------------------------------
 * 12.1 — le grand livre
 * ---------------------------------------------------------------------- */

describe("le portefeuille", () => {
  it("est un grand livre, pas un compteur", () => {
    // Un solde stocké dans une colonne se corrige à la main le jour où il est
    // faux, et personne ne sait plus pourquoi.
    expect(migration).toMatch(/create table public\.duel_credit_entries/);
    expect(migration).toMatch(/coalesce\(sum\(delta\), 0\)/);
    expect(migration).not.toMatch(
      /credit_balance integer|balance integer not null/,
    );
  });

  it("et le solde se demande à la base, pas à la liste affichée", () => {
    // La liste est plafonnée à trente lignes pour l'écran. La sommer donnerait
    // un solde juste pour les nouveaux venus et faux pour les autres.
    expect(wallet).toMatch(/rpc\(\s*"duel_credit_balance"/);
  });

  it("un mouvement ne vaut jamais zéro", () => {
    expect(migration).toMatch(/check \(delta <> 0/);
  });

  it("un solde ne peut pas devenir négatif, et la garde est en base", () => {
    // Deux onglets ouverts et deux envois simultanés passeraient n'importe
    // quelle vérification faite dans l'application.
    expect(migration).toMatch(/forbid_negative_duel_balance/);
    expect(migration).toMatch(/pg_advisory_xact_lock/);
    expect(migration).toMatch(
      /after insert or update on public\.duel_credit_entries/,
    );
  });

  it("personne n’écrit son propre solde ni son propre défi", () => {
    // La sécurité au niveau des lignes filtre des LIGNES et non des COLONNES :
    // qui peut écrire sa ligne de grand livre peut écrire `delta`.
    const policies = migration.slice(migration.indexOf("enable row level"));

    for (const table of [
      "public.duel_credit_entries",
      "public.duels",
      "public.duel_lot_purchases",
    ]) {
      const writes = policies.match(
        new RegExp(
          `on ${table.replace(".", "\\.")} for (insert|update|delete|all)`,
          "g",
        ),
      );
      expect(writes, `politique d'écriture sur ${table}`).toBeNull();
    }
  });

  it("un défi ne peut pas se pointer sur lui-même", () => {
    expect(migration).toMatch(/check \(sender_id <> receiver_id\)/);
  });

  it("et le catalogue vit en base, pas dans le code", () => {
    expect(migration).toMatch(/create table public\.duel_types/);
    expect(seed).toMatch(/insert into public\.duel_types/);
    // Trois défis, ceux que le PO a énoncés.
    expect(seed).toMatch(/'course-2km'/);
    expect(seed).toMatch(/'velo-10km'/);
    expect(seed).toMatch(/'activite'/);
    expect(catalogue).not.toMatch(/2000|10000/);
  });
});

/* -------------------------------------------------------------------------
 * 12.2 — l'achat de crédits
 * ---------------------------------------------------------------------- */

describe("l’achat de crédits", () => {
  it("le montant vient de la base, jamais du navigateur", () => {
    expect(checkout).toMatch(/unit_amount: lot\.priceCents/);
    expect(creditActions).toMatch(/getLotBySlug\(slug\)/);
    // Le formulaire n'envoie qu'un identifiant de lot.
    expect(creditActions).toMatch(/formData\.get\("lot"\)/);
    expect(creditActions).not.toMatch(/formData\.get\("prix"|amount/);
  });

  it("seul le webhook crédite le portefeuille", () => {
    // Le retour depuis Stripe est déclenché par un navigateur : il ne prouve
    // rien, et sur un téléphone il n'arrive souvent pas du tout.
    expect(purchase).toMatch(/duel_credit_entries/);
    expect(creditActions).not.toMatch(/duel_credit_entries/);
    expect(creditActions).toMatch(/status: "pending"/);
  });

  it("un webhook rejoué ne crédite jamais deux fois", () => {
    // La contrainte d'unicité est toute l'idempotence de ce fichier.
    expect(migration).toMatch(
      /constraint duel_credit_entries_purchase_unique unique \(purchase_id\)/,
    );
    expect(purchase).toMatch(/UNIQUE_VIOLATION = "23505"/);
    expect(purchase).toMatch(/duplicateCredit/);
  });

  it("et un échec de créditation redemande à Stripe de revenir", () => {
    // Répondre 200 sur un échec classerait l'affaire : argent encaissé,
    // portefeuille vide, et plus rien pour s'en apercevoir.
    expect(purchase).toMatch(
      /return \{ ok: false, reason: "credit-insert-failed" \}/,
    );
  });

  it("le branchement se fait sur le kind, jamais sur le montant", () => {
    // Un lot à 10 € et un niveau d'inscription à 10 € sont indiscernables par
    // le montant. Ils ne le sont jamais par le kind.
    expect(checkout).toMatch(/kind: "credits"/);
    expect(activation).toMatch(
      /\(session\.metadata \?\? \{\}\)\.kind === "credits"/,
    );
    expect(activation).toMatch(/handleCreditPurchase\(session\)/);
  });

  it("seuls les inscrits actifs achètent", () => {
    expect(creditActions).toMatch(/registration\?\.status !== "active"/);
  });
});

/* -------------------------------------------------------------------------
 * 12.3 — l'envoi
 * ---------------------------------------------------------------------- */

describe("l’envoi d’un défi", () => {
  it("le débit et la création sont indissociables", () => {
    // Un crédit débité sans défi envoyé est une réclamation ; un défi envoyé
    // sans crédit débité est une faille.
    const fn = migration.slice(
      migration.indexOf("create function public.send_duel"),
      migration.indexOf("create function public.expire_duels"),
    );

    expect(fn).toMatch(/insert into public\.duels/);
    expect(fn).toMatch(/insert into public\.duel_credit_entries/);
    expect(fn).toMatch(/'depense'/);
  });

  it("et rien n’est écrit avant que tous les refus soient passés", () => {
    // Un refus ne coûte donc aucun crédit — plutôt qu'un crédit pris puis
    // rendu, qui laisse une fenêtre où le solde est faux.
    const fn = migration.slice(
      migration.indexOf("create function public.send_duel"),
      migration.indexOf("create function public.expire_duels"),
    );

    const firstWrite = fn.indexOf("insert into public.duels");

    for (const refusal of [
      "'self'",
      "'type-unavailable'",
      "'receiver-unavailable'",
      "'opted-out'",
      "'capped'",
      "'no-credit'",
    ]) {
      expect(fn.indexOf(refusal), refusal).toBeLessThan(firstWrite);
    }
  });

  it("l’identité vient de la session, la cible du formulaire", () => {
    expect(actions).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(actions).toMatch(/senderId: user\.id/);
    expect(actions).toMatch(/formData\.get\("joueur"\)/);
    expect(actions).not.toMatch(/formData\.get\("expediteur"\)/);
  });

  it("l’échéance est posée à l’envoi, depuis la base", () => {
    expect(migration).toMatch(/now\(\) \+ make_interval\(hours => v_hours\)/);
    expect(migration).toMatch(/hours integer not null default 24/);
  });

  it("chaque refus a une phrase qui n’accuse pas le lecteur", () => {
    for (const [status, message] of Object.entries(SEND_MESSAGES)) {
      expect(message.length, status).toBeGreaterThan(20);
      expect(message, status).not.toMatch(/erreur \d|error|null|undefined/i);
    }

    // Celle du plafond est la phrase du PO, et elle dit que rien n'a été perdu.
    expect(SEND_MESSAGES.capped).toMatch(/Retentez demain/);
    expect(SEND_MESSAGES.capped).toMatch(/crédit n’a pas été utilisé/);
  });

  it("sans crédit, l’écran propose d’en acheter", () => {
    const screen = code(
      read("src/app/(participant)/jeu/defis-joueurs/envoyer/page.tsx"),
    );

    expect(screen).toMatch(/wallet\.balance < 1/);
    expect(screen).toMatch(/\/jeu\/defis-joueurs\/credits/);
  });
});

/* -------------------------------------------------------------------------
 * 12.4 — la protection du destinataire
 * ---------------------------------------------------------------------- */

describe("la protection du destinataire", () => {
  it("le plafond est glissant, pas calendaire", () => {
    // « Cinq par jour » remis à zéro à minuit autorise dix défis en deux
    // heures, à 23 h et à 1 h — précisément la soirée dont on veut protéger.
    expect(migration).toMatch(/sent_at > now\(\) - interval '24 hours'/);
    expect(migration).not.toMatch(/date_trunc\('day'/);
  });

  it("et il vit sur l’édition, modifiable en une instruction SQL", () => {
    expect(migration).toMatch(/duel_cap_per_day integer not null default 5/);
  });

  it("la riposte gratuite ne compte pas dans le plafond", () => {
    // Sinon une personne très sollicitée ne pourrait plus riposter — alors que
    // la riposte est la récompense du défi relevé.
    expect(migration).toMatch(
      /where receiver_id = p_receiver[\s\S]{0,200}free = false/,
    );
  });

  it("l’interrupteur est vérifié par le serveur, pas par le bouton", () => {
    expect(migration).toMatch(
      /duels_opt_out from public\.profiles where id = p_receiver/,
    );
    expect(migration).toMatch(/'opted-out'/);
  });

  it("et le participant l’actionne lui-même, sur sa propre ligne", () => {
    expect(actions).toMatch(
      /from\("profiles"\)[\s\S]{0,120}duels_opt_out: optOut/,
    );
    expect(actions).toMatch(/\.eq\("id", user\.id\)/);
    // Par sa session, pas par la clé de service : c'est sa colonne.
    expect(actions).not.toMatch(
      /createAdminClient\(\)[\s\S]{0,400}duels_opt_out/,
    );
  });

  it("on ne défie qu’un participant actif et non suspendu", () => {
    expect(migration).toMatch(/r\.status = 'active'/);
    expect(migration).toMatch(/p\.suspended_at is null/);
    expect(migration).toMatch(/p\.deleted_at is null/);
  });

  it("et l’organisation peut consulter les envois d’un participant", () => {
    const admin = code(read("src/lib/admin/participants.ts"));

    expect(admin).toMatch(/async function duelHistory/);
    expect(admin).toMatch(/\.eq\("sender_id", id\)/);
    expect(admin).toMatch(/\.eq\("receiver_id", id\)/);
  });
});

/* -------------------------------------------------------------------------
 * 12.5 — la validation
 * ---------------------------------------------------------------------- */

describe("la fenêtre temporelle", () => {
  const sent = "2026-11-05T18:00:00.000Z";
  const expires = "2026-11-06T18:00:00.000Z";

  const outing = (startedAt: string, durationSeconds = 1800) => ({
    startedAt,
    durationSeconds,
  });

  it("refuse la sortie du matin, et c’est tout l’intérêt du mécanisme", () => {
    // Sans cette règle, un défi reçu à 18 h se valide avec la course de 7 h,
    // sans bouger de sa chaise.
    expect(
      withinDuelWindow(outing("2026-11-05T07:00:00.000Z"), sent, expires),
    ).toBe(false);
  });

  it("refuse aussi une sortie commencée à la seconde même de l’envoi", () => {
    // Strictement après : l'égalité serait une porte ouverte à une sortie
    // lancée avant que le défi n'existe.
    expect(withinDuelWindow(outing(sent), sent, expires)).toBe(false);
  });

  it("accepte une sortie postérieure et terminée à temps", () => {
    expect(
      withinDuelWindow(outing("2026-11-05T19:00:00.000Z"), sent, expires),
    ).toBe(true);
  });

  it("refuse une sortie commencée à temps mais finie après l’échéance", () => {
    // « Vous avez 24 heures pour le relever » : une course lancée cinq minutes
    // avant la fin et terminée une heure plus tard n'a pas été faite dedans.
    expect(
      withinDuelWindow(outing("2026-11-06T17:55:00.000Z", 3600), sent, expires),
    ).toBe(false);
  });

  it("et une date illisible ne valide jamais rien", () => {
    expect(withinDuelWindow(outing("pas une date"), sent, expires)).toBe(false);
    expect(withinDuelWindow(outing("2026-11-05T19:00:00Z"), "", expires)).toBe(
      false,
    );
  });
});

describe("la validation d’un défi reçu", () => {
  it("une activité saisie à la main ne valide rien", () => {
    expect(evaluateSource).toMatch(/if \(activity\.isManual\) return/);
  });

  it("elle réutilise le moteur de l’epic 4 plutôt qu’un second jeu de règles", () => {
    expect(evaluateSource).toMatch(
      /import \{ evaluate \} from "@\/lib\/challenges\/evaluators\/evaluate"/,
    );
    expect(evaluateSource).toMatch(/evaluate\(duel\.duel_types\.evaluator/);
  });

  it("et une même sortie peut valider le défi du jour et un défi reçu", () => {
    // La personne a couru une fois et satisfait deux demandes, dont une
    // qu'elle n'avait pas choisie. Refuser serait la punir d'avoir été défiée.
    const store = code(read("src/lib/activities/store.ts"));

    expect(store).toMatch(/await applyActivity\(activity\)/);
    expect(store).toMatch(/await applyActivityToDuels\(activity\)/);
  });

  it("un défi relevé ne rapporte ni point ni carte", () => {
    // Décision P7 : c'est elle qui rend inutile tout garde-fou contre deux
    // amis qui se renverraient des défis en boucle.
    expect(evaluateSource).not.toMatch(/points|card_grants|grantCard/i);
    expect(migration).not.toMatch(/points integer/);
  });

  it("le marquage porte sa garde, il ne la retient pas", () => {
    expect(evaluateSource).toMatch(/\.eq\("status", "open"\)/);
  });

  it("et l’expiration ne touche à rien d’autre que le défi", () => {
    const fn = migration.slice(
      migration.indexOf("create function public.expire_duels"),
    );

    expect(fn).toMatch(/set status = 'expired'/);
    expect(fn).not.toMatch(/points|leaderboard|card/i);
  });
});

/* -------------------------------------------------------------------------
 * 12.6 — la riposte et l'humour
 * ---------------------------------------------------------------------- */

describe("la riposte", () => {
  it("est gratuite : elle n’écrit aucun mouvement de crédit", () => {
    const fn = migration.slice(
      migration.indexOf("create function public.send_duel"),
      migration.indexOf("create function public.expire_duels"),
    );

    expect(fn).toMatch(
      /if not v_free then[\s\S]{0,300}insert into public\.duel_credit_entries/,
    );
  });

  it("ne part qu’à l’expéditeur d’origine, et sur un défi relevé", () => {
    expect(migration).toMatch(/d\.receiver_id = p_sender/);
    expect(migration).toMatch(/d\.sender_id = p_receiver/);
    expect(migration).toMatch(/d\.status = 'met'/);
  });

  it("et il n’y en a qu’une par défi, garantie par la base", () => {
    expect(migration).toMatch(
      /constraint duels_one_riposte unique \(parent_duel_id\)/,
    );
    expect(migration).toMatch(/'already-riposted'/);
  });

  it("elle respecte l’interrupteur, mais pas le plafond", () => {
    const fn = migration.slice(
      migration.indexOf("create function public.send_duel"),
      migration.indexOf("create function public.expire_duels"),
    );

    // L'interrupteur est vérifié avant la séparation riposte / défi payant.
    expect(fn.indexOf("'opted-out'")).toBeLessThan(
      fn.indexOf("if v_free then"),
    );
    // Le plafond, lui, est dans la branche payante.
    expect(fn.indexOf("'capped'")).toBeGreaterThan(
      fn.indexOf("if v_free then"),
    );
  });
});

describe("les messages d’échec", () => {
  it("sont écrits par l’application, jamais par un participant", () => {
    // Un champ de message entre participants transformerait le mécanisme en
    // messagerie, avec ce que cela suppose de modération et de responsabilité.
    const form = code(read("src/components/duels/send-duel-form.tsx"));

    expect(form).not.toMatch(/<textarea|type="text"/);
    expect(migration).not.toMatch(/message text|body text/);
  });

  it("visent le défi, jamais la personne", () => {
    // « Ton défi a été plus fort que lui » et non « il n'a pas réussi ». La
    // nuance décide de la différence entre un jeu et une brimade.
    for (const message of EXPIRY_MESSAGES) {
      expect(message.text.length).toBeGreaterThan(20);
      expect(message.text).not.toMatch(/nul|paresseux|échoué|raté|lâche/i);
    }
  });

  it("sont tirés une fois et rangés, pas retirés à chaque affichage", () => {
    // Une phrase qui change à chaque rafraîchissement se lit comme un bug
    // plutôt que comme une plaisanterie.
    expect(migration).toMatch(/expiry_message_key text/);
    expect(migration).toMatch(/expiry_message_key = p_message_keys\[/);
  });

  it("et une clé inconnue ne laisse pas un blanc à l’écran", () => {
    expect(expiryMessage("clé-qui-n-existe-pas")).toBe(
      EXPIRY_MESSAGES[0]!.text,
    );
    expect(expiryMessage(null).length).toBeGreaterThan(20);
  });

  it("les clés annoncées à la base sont bien celles du catalogue", () => {
    expect(EXPIRY_MESSAGE_KEYS).toEqual(EXPIRY_MESSAGES.map((m) => m.key));
    expect(new Set(EXPIRY_MESSAGE_KEYS).size).toBe(EXPIRY_MESSAGE_KEYS.length);
  });

  it("le destinataire d’un défi expiré ne reçoit aucun reproche", () => {
    // Il n'a rien fait de mal : il n'a pas demandé ce défi.
    const fn = notify.slice(
      notify.indexOf("export async function notifyDuelExpired"),
    );

    expect(fn).toMatch(/profileIds: \[duel\.sender_id\]/);
    expect(fn.slice(0, fn.indexOf("}"))).not.toMatch(/receiver_id/);
  });
});

/* -------------------------------------------------------------------------
 * 12.7 — les notifications
 * ---------------------------------------------------------------------- */

describe("les notifications de défi", () => {
  it("ont leur propre catégorie", () => {
    // Sinon quelqu'un qui veut son rappel quotidien mais pas les défis coupera
    // tout, et perdra le message dont le jeu entier dépend.
    const payload = code(read("src/lib/notifications/payload.ts"));
    const prefs = code(read("src/lib/notifications/preferences.ts"));

    expect(payload).toMatch(/"defi_joueur"/);
    expect(prefs).toMatch(/defi_joueur: "cat_defi_joueur"/);
    expect(
      read("supabase/migrations/20260806310000_duel_notifications.sql"),
    ).toMatch(/cat_defi_joueur boolean not null default true/);
  });

  it("passent toutes par la porte unique des préférences", () => {
    const sends = notify.match(/await notify\(\{/g) ?? [];

    expect(sends.length).toBe(4);
    expect(notify).not.toMatch(/sendPush\(|sendFallbackEmails\(/);
  });

  it("aucune n’est envoyée deux fois pour le même événement", () => {
    for (const key of [
      "defi-joueur-recu",
      "defi-joueur-releve",
      "defi-joueur-expire",
      "defi-joueur-rappel",
    ]) {
      expect(notify, key).toMatch(new RegExp(`dedupeKey: \`${key}:`));
    }
  });

  it("le rappel part une seule fois, et pas au milieu de la nuit", () => {
    // Le créneau horaire est dans la crontab et pas dans le code : c'est un
    // calendrier, pas une condition à recalculer à chaque appel.
    expect(crontab).toMatch(/^\d+ 8-22 \* \* \* .*cron\/defis-joueurs/m);
    expect(sweep).toMatch(/REMINDER_HOURS/);
  });

  it("et on n’expire pas un défi juste avant de rappeler qu’il court encore", () => {
    // Rappeler un défi expiré quatre minutes plus tôt serait le message le
    // plus agaçant que cette application puisse envoyer.
    expect(sweep.indexOf("expiring")).toBeLessThan(
      sweep.indexOf('rpc("expire_duels"'),
    );
  });
});

/* -------------------------------------------------------------------------
 * 12.8 — la comptabilité
 * ---------------------------------------------------------------------- */

describe("la comptabilisation des crédits", () => {
  it("les crédits ont leur propre nature de paiement", () => {
    // Sans elle, chaque lot vendu tomberait dans « encaissement sans niveau
    // rattaché » — la ligne qui veut dire « quelque chose ne va pas ».
    expect(migration).toMatch(
      /check \(kind in \('registration', 'pack', 'credits', 'refund'\)\)/,
    );
    expect(breakdown).toMatch(/row\.kind === "credits"/);
  });

  it("et une ligne dédiée dans la ventilation, comptée dans le total", () => {
    expect(breakdown).toMatch(/credits\.grossCents/);
    expect(breakdown).toMatch(/summedGross =[\s\S]{0,200}credits\.grossCents/);
  });

  it("un achat de crédits n’est jamais « sans niveau rattaché »", () => {
    const loop = breakdown.slice(
      breakdown.indexOf('if (row.kind === "credits")'),
      breakdown.indexOf("if (!tier)"),
    );

    expect(loop).toMatch(/continue;/);
  });

  it("le montant est intégralement reversable, et la base l’impose", () => {
    expect(migration).toMatch(
      /constraint duel_credit_lots_fully_donated check \(donated_cents = price_cents\)/,
    );
    expect(purchase).toMatch(/donation_cents: grossCents/);
    expect(purchase).toMatch(/counterpart_cents: 0/);
  });

  it("l’export porte un libellé propre", () => {
    expect(exportSource).toMatch(/credits: "Crédits"/);
  });

  it("et l’écran dit combien de crédits ont servi", () => {
    // Ce n'est pas un chiffre comptable, et c'est lui qui dira le 30 novembre
    // quelle part du revenu correspond à la décision P8.
    expect(breakdown).toMatch(/async function creditUsage/);
    expect(breakdown).toMatch(/bought/);
    expect(breakdown).toMatch(/spent/);
  });
});

/* -------------------------------------------------------------------------
 * Ce que l'epic ne doit pas avoir déplacé
 * ---------------------------------------------------------------------- */

describe("le reste du jeu n’a pas bougé", () => {
  it("aucun défi entre joueurs n’entre dans un classement", () => {
    const leaderboards = code(
      read("supabase/migrations/20260806210000_leaderboards.sql"),
    );

    expect(leaderboards).not.toMatch(/duel/i);
  });

  it("les crédits ne sont pas un don défiscalisable, et l’écran le dit", () => {
    const screen = code(
      read("src/app/(participant)/jeu/defis-joueurs/credits/page.tsx"),
    );

    expect(screen).toMatch(/pas d’un don défiscalisable|défiscalisable/);
    expect(screen).toMatch(/aucun reçu fiscal/i);
  });

  it("et le jeu reste jouable sans dépenser un centime de plus", () => {
    // Décision D2 : recevoir des défis, les relever et riposter est gratuit.
    const board = code(
      read("src/app/(participant)/jeu/defis-joueurs/page.tsx"),
    );

    expect(board).toMatch(/ne fait gagner aucun point/);
    expect(migration).toMatch(/free boolean not null default false/);
  });
});
