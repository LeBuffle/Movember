import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Diagnostic des notifications (story 6.9)
 *
 * **Le symptôme ne distingue rien.** « Je reçois un e-mail au lieu d'une
 * notification » est exactement ce que l'application fait, correctement, pour
 * qui n'a pas d'appareil actif. Et « ne pas avoir d'appareil actif » recouvre
 * trois situations sans rapport, qui se réparent de trois façons différentes :
 *
 *   - l'abonnement n'a jamais été enregistré ;
 *   - il l'a été puis retiré, le téléphone ayant disparu ;
 *   - la table n'est pas lisible, et alors *tout le monde* bascule sur
 *     l'e-mail, sans que rien ne le dise.
 *
 * Ce fichier tient ce qui distingue ces trois cas, et ce que le diagnostic
 * n'a pas le droit d'afficher pour y arriver.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

/** Retire les commentaires : un commentaire n'est pas une garantie. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const diagnostic = code(read("src/lib/notifications/diagnostic.ts"));
const actions = code(read("src/lib/notifications/diagnostic-actions.ts"));
const send = code(read("src/lib/notifications/send.ts"));

/* -------------------------------------------------------------------------
 * Ce que le diagnostic ne montre pas
 * ---------------------------------------------------------------------- */

describe("le diagnostic ne divulgue rien", () => {
  it("aucune adresse d’abonnement n’est lue", () => {
    // Une adresse d'abonnement est une capacité : qui l'a peut faire sonner
    // le téléphone de quelqu'un. Ne pas la sélectionner vaut mieux que ne pas
    // l'afficher — la seconde finit dans un outil de développement.
    const select = diagnostic.slice(
      diagnostic.indexOf(".select("),
      diagnostic.indexOf('.eq("profile_id"'),
    );

    expect(select).not.toContain("endpoint");
    expect(select).not.toContain("p256dh");
    expect(select).not.toContain("auth");
  });

  it("ni le modèle exact de l’appareil", () => {
    // L'agent utilisateur nomme un modèle et une version d'OS. Il est
    // enregistré parce qu'un bénévole doit savoir de quel téléphone on parle ;
    // la réponse à cette question tient en un mot.
    expect(diagnostic).toMatch(/function deviceKind/);
    expect(diagnostic).toMatch(/return "ordinateur"/);
  });
});

/* -------------------------------------------------------------------------
 * Les trois causes, distinguées
 * ---------------------------------------------------------------------- */

describe("les trois causes d’un e-mail reçu à la place d’une notification", () => {
  it("aucun abonnement jamais enregistré", () => {
    expect(diagnostic).toMatch(/if \(devices\.length === 0\)/);
  });

  it("des abonnements, tous retirés", () => {
    // `disabled_at` est le champ qui décide, et aucun écran ne le montre : un
    // participant dont l'appareil a été retiré voit exactement ce que voit un
    // participant qui ne s'est jamais abonné.
    expect(diagnostic).toMatch(/if \(live\.length === 0\)/);
    expect(diagnostic).toMatch(/row\.disabled_at !== null/);
  });

  it("et la table qui ne répond pas — le cas qui touche tout le monde", () => {
    // `withDevices` renvoie un ensemble vide quand la lecture échoue et
    // bascule donc l'édition entière sur l'e-mail, sans le dire. C'est la
    // seule panne de cette liste qui ne se voit sur aucun compte en
    // particulier.
    const dispatch = code(read("src/lib/notifications/dispatch.ts"));

    expect(dispatch).toMatch(/return new Set\(\)/);
    expect(diagnostic).toMatch(/Lecture des abonnements/);
  });
});

describe("le service worker fait partie de la chaîne", () => {
  it("son absence est une étape à part entière", () => {
    // Ajouté après la montée en Next 16 : le nouveau moteur de construction
    // ne fabrique pas ce fichier et ne le signale pas. L'application se
    // déploie entière, et plus aucun téléphone ne peut rien recevoir.
    expect(diagnostic).toMatch(/existsSync/);
    expect(diagnostic).toMatch(/"public", "sw\.js"/);
  });
});

/* -------------------------------------------------------------------------
 * L'envoi de test
 * ---------------------------------------------------------------------- */

describe("l’envoi de test", () => {
  it("ne passe pas par le registre anti-doublon", () => {
    // C'est sa raison d'être. Un envoi ordinaire réserve la livraison avant
    // d'envoyer : relancé, il n'envoie rien — et une réparation qu'on ne peut
    // pas vérifier se lit comme un échec de plus.
    const fn = send.slice(
      send.indexOf("export async function sendTestPush"),
      send.indexOf("function describe("),
    );

    expect(fn).not.toMatch(/claimDelivery/);
  });

  it("retire quand même un appareil réellement mort", () => {
    // Un test qui découvre une adresse morte doit la retirer comme le ferait
    // un envoi ordinaire, sinon le diagnostic suivant retrouve le même
    // appareil en état trompeusement actif.
    const fn = send.slice(
      send.indexOf("export async function sendTestPush"),
      send.indexOf("function describe("),
    );

    expect(fn).toMatch(/if \(isGone\(status\)\) await retire/);
  });

  it("un appareil qui échoue n’emporte pas le second", () => {
    const fn = send.slice(
      send.indexOf("export async function sendTestPush"),
      send.indexOf("function describe("),
    );

    expect(fn).toMatch(/Promise\.allSettled/);
  });

  it("et il rend le code de réponse, qui est ce qui départage", () => {
    // 410 « ce téléphone n'existe plus », 403 « votre signature est refusée ».
    // Deux réparations opposées derrière un même « je n'ai rien reçu ».
    expect(send).toMatch(/function explain/);
    expect(send).toMatch(/status === 403 \|\| status === 401/);
    expect(send).toMatch(/status === 404 \|\| status === 410/);
  });
});

/* -------------------------------------------------------------------------
 * Qui a le droit
 * ---------------------------------------------------------------------- */

describe("les gardes", () => {
  it("les quatre actions passent par le contrôle administrateur", () => {
    const guards = actions.match(/await requireAdmin\(\)/g) ?? [];

    expect(guards).toHaveLength(4);
  });

  it("le diagnostic personnel ne prend aucun identifiant", () => {
    // Un écran dont le travail est de répondre à « pourquoi les miennes
    // n'arrivent pas » n'a pas à savoir lire l'état de quelqu'un d'autre.
    const own = actions.slice(
      actions.indexOf("export async function diagnoseNotificationsAction"),
      actions.indexOf("export type TestSendState"),
    );

    expect(own).toMatch(/diagnoseNotifications\(admin\.id\)/);
    expect(own).not.toMatch(/formData\.get/);
  });

  it("faire sonner le téléphone d’un autre est journalisé", () => {
    // Le diagnostic lit ; celui-ci agit sur l'appareil de quelqu'un d'autre.
    // C'est la définition d'un geste dont on doit pouvoir dire qui l'a fait.
    const other = actions.slice(
      actions.indexOf("export async function sendTestToParticipantAction"),
    );

    expect(other).toMatch(/logAdminAction/);
    expect(other).toMatch(/action: "notifications\.test_sent"/);
  });

  it("et le journal ne porte pas de donnée personnelle", () => {
    // Une entrée d'audit survit au compte auquel elle se rapporte.
    const other = actions.slice(
      actions.indexOf("export async function sendTestToParticipantAction"),
    );

    expect(other).not.toMatch(/email|display_name|endpoint/);
  });
});
