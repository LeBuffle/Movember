import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260806100000_activity_connections.sql",
  ),
  "utf8",
).replace(/--.*$/gm, "");

/* =========================================================================
 * Lier un compte sportif
 *
 * Deux choses peuvent mal tourner et coûter cher : un même compte Strava
 * relié à deux comptes de jeu — qui partagerait les mêmes défis réussis — et
 * un jeton qui fuite, lequel ouvre tout l'historique sportif de quelqu'un.
 * ====================================================================== */

describe("le schéma des connexions", () => {
  it("ferme la faille du compte Strava partagé", () => {
    // Deux participants sur le même compte Strava partageraient les mêmes
    // activités, donc les mêmes défis, donc les mêmes points. Aucun code
    // applicatif ne remplace un index ici : deux autorisations simultanées
    // passeraient toutes les deux un contrôle.
    expect(migration).toMatch(
      /unique index activity_connections_one_game_account[\s\S]*?\(provider, provider_account_id\)[\s\S]*?where disconnected_at is null/,
    );
  });

  it("laisse un compte délié repartir ailleurs", () => {
    // L'index est partiel : un compte vraiment délié doit pouvoir être relié
    // à nouveau, par son propriétaire ou par qui a racheté la montre.
    expect(migration).toMatch(/where disconnected_at is null/);
  });

  it("n’autorise qu’une liaison vivante par participant", () => {
    expect(migration).toMatch(
      /unique index activity_connections_one_per_participant[\s\S]*?\(profile_id, provider\)/,
    );
  });

  it("délie sans supprimer", () => {
    expect(migration).toMatch(/disconnected_at timestamptz/);
  });

  it("n’ouvre aucune lecture, pas même au propriétaire", () => {
    // La sécurité au niveau des lignes filtre des lignes, pas des colonnes :
    // laisser quelqu'un lire sa propre ligne lui donnerait son propre jeton
    // d'accès depuis l'API.
    expect(migration).not.toMatch(/create policy/i);
    expect(migration).toMatch(
      /alter table public\.activity_connections enable row level security/,
    );
  });

  it("garde ce qui a réellement été accordé", () => {
    // Quelqu'un peut approuver une portée plus étroite que celle demandée, et
    // l'échec qui suit est sinon un mystère.
    expect(migration).toMatch(/scopes text\[\] not null/);
  });
});

describe("le chiffrement des jetons", () => {
  const ORIGINAL = process.env.TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = ORIGINAL;
  });

  it("fait l’aller-retour", async () => {
    const { encryptToken, decryptToken } =
      await import("@/lib/activities/crypto");

    const chiffre = encryptToken("jeton-strava");

    expect(chiffre).not.toBe(null);
    expect(chiffre).not.toContain("jeton-strava");
    expect(decryptToken(chiffre!)).toBe("jeton-strava");
  });

  it("ne produit jamais deux fois le même chiffré", async () => {
    // Sans vecteur d'initialisation aléatoire, deux jetons identiques se
    // reconnaîtraient dans un export.
    const { encryptToken } = await import("@/lib/activities/crypto");

    expect(encryptToken("même")).not.toBe(encryptToken("même"));
  });

  it("refuse un chiffré modifié plutôt que de le déchiffrer de travers", async () => {
    const { encryptToken, decryptToken } =
      await import("@/lib/activities/crypto");

    const chiffre = encryptToken("jeton-strava")!;
    const altere = `${chiffre.slice(0, -4)}AAAA`;

    expect(decryptToken(altere)).toBe(null);
  });

  it("refuse plutôt que d’écrire en clair sans clé", async () => {
    // Un jeton en clair que tout le monde en aval croit chiffré serait pire
    // que le refus.
    delete process.env.TOKEN_ENCRYPTION_KEY;

    const { encryptToken, encryptionAvailable } =
      await import("@/lib/activities/crypto");

    expect(encryptionAvailable()).toBe(false);
    expect(encryptToken("jeton-strava")).toBe(null);
  });

  it("refuse une clé de mauvaise taille", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "trop-court";

    const { encryptionAvailable } = await import("@/lib/activities/crypto");

    expect(encryptionAvailable()).toBe(false);
  });

  it("compare l’état sans révéler jusqu’où il correspondait", async () => {
    const { secretsMatch } = await import("@/lib/activities/crypto");

    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abc", "abd")).toBe(false);
    expect(secretsMatch("abc", "abcd")).toBe(false);
  });
});

describe("la source Strava", () => {
  const source = code("src/lib/activities/sources/strava.ts");

  it("ne demande que la portée nécessaire", () => {
    // Demander plus large « au cas où » est ce qui fait échouer une revue de
    // conformité — et le participant lit la liste sur l'écran de Strava.
    expect(source).toMatch(/STRAVA_SCOPE = "activity:read_all"/);
    expect(source).not.toMatch(/profile:write|activity:write/);
  });

  it("échange le code côté serveur", () => {
    // Le secret de l'application n'atteint jamais le navigateur.
    expect(source).toMatch(/^import "server-only";/m);
    expect(source).toMatch(/STRAVA_CLIENT_SECRET/);
  });

  it("ne fait pas confiance à la forme de la réponse", () => {
    // Un jeton de rafraîchissement manquant serait sinon stocké comme la
    // chaîne « undefined », et la liaison casserait quelques heures plus tard.
    expect(source).toMatch(/typeof body\.refresh_token !== "string"/);
  });

  it("distingue un refus définitif d’une indisponibilité", () => {
    // La story 3.7 doit pouvoir arrêter de réessayer dans un cas et pas dans
    // l'autre.
    expect(source).toMatch(/status === 400 \|\| response\.status === 401/);
    expect(source).toMatch(/sourceFailure\("denied"\)/);
    expect(source).toMatch(/sourceFailure\("unavailable"\)/);
  });

  it("ne reste pas suspendue si Strava ne répond pas", () => {
    expect(source).toMatch(/AbortSignal\.timeout/);
  });

  it("date une activité sur l’heure locale de l’athlète", () => {
    // Utiliser l'instant UTC est exactement ce qui fait basculer une sortie
    // de 23h40 sur le lendemain.
    expect(source).toMatch(/start_date_local/);
  });

  it("compte le temps en mouvement, pas le temps écoulé", () => {
    // Un défi de trente minutes d'effort ne doit pas se régler par deux
    // heures de pause café.
    expect(source).toMatch(/moving_time/);
  });

  it("ne lit aucun champ interdit", () => {
    // Architecture D9 : ni tracé, ni fréquence cardiaque, ni puissance, ni
    // cadence. La story 3.4 en fera un test de schéma complet.
    for (const forbidden of [
      "polyline",
      "start_latlng",
      "end_latlng",
      "heartrate",
      "average_watts",
      "cadence",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

describe("le départ vers le fournisseur", () => {
  const start = code("src/app/api/activites/connexion/[fournisseur]/route.ts");

  it("vérifie le consentement, pas seulement l’écran", () => {
    // Masquer un bouton est une politesse, pas un contrôle.
    expect(start).toMatch(/mayConnectActivitySource\(\)/);
  });

  it("exige une session", () => {
    expect(start).toMatch(/if \(!user\) return back\("session"\)/);
  });

  it("refuse avant le départ si le chiffrement n’est pas configuré", () => {
    // Envoyer quelqu'un chez Strava, le faire approuver, puis découvrir qu'on
    // ne peut rien stocker est le pire des ordres.
    expect(start).toMatch(/encryptionAvailable\(\)/);
  });

  it("fabrique un état imprévisible côté serveur", () => {
    expect(start).toMatch(/randomBytes\(32\)/);
  });

  it("garde l’état dans un cookie que le navigateur ne lit pas", () => {
    expect(start).toMatch(/httpOnly: true/);
  });

  it("laisse le cookie survivre au retour depuis Strava", () => {
    // `strict` ne serait pas envoyé sur cette redirection : le retour
    // échouerait pour tout le monde, à chaque fois.
    expect(start).toMatch(/sameSite: "lax"/);
  });

  it("fait expirer l’état", () => {
    // Dans son propre module : un fichier de route Next.js ne peut exporter
    // que des gestionnaires de requête, et la construction le refuse.
    expect(code("src/lib/activities/oauth-state.ts")).toMatch(
      /STATE_TTL_SECONDS = 600/,
    );
    expect(start).toMatch(/maxAge: STATE_TTL_SECONDS/);
  });
});

describe("le retour du fournisseur", () => {
  const back = code("src/app/api/activites/retour/[fournisseur]/route.ts");

  it("compare l’état, et il vient du cookie", () => {
    // Sans lui, un lien préparé par quelqu'un d'autre relie SON compte Strava
    // au compte de la victime, et tout ce qu'il enregistre marque pour elle.
    expect(back).toMatch(
      /secretsMatch\(expected, `\$\{fournisseur\}:\$\{received\}`\)/,
    );
    expect(back).toMatch(/erreur=etat/);
  });

  it("brûle l’état quoi qu’il arrive", () => {
    expect(back).toMatch(/response\.cookies\.delete\(STATE_COOKIE\)/);
  });

  it("traite un refus comme une décision, pas comme une panne", () => {
    expect(back).toMatch(/erreur=refus/);
  });

  it("revérifie le consentement au retour", () => {
    // Un consentement retiré dans un autre onglet pendant que l'écran Strava
    // était ouvert ne doit pas produire de liaison.
    expect(back).toMatch(/mayConnectActivitySource\(\)/);
  });

  it("n’écrit qu’après un échange complet", () => {
    // Rien de à moitié lié ne doit rester derrière.
    expect(back.indexOf("exchanged.ok")).toBeLessThan(
      back.indexOf("linkAccount("),
    );
  });

  it("enregistre la portée réellement accordée", () => {
    expect(back).toMatch(/searchParams\.get\("scope"\)/);
  });

  it("dit clairement qu’un compte est déjà relié ailleurs", () => {
    expect(back).toMatch(/erreur=deja-lie/);
  });
});

describe("ce que le participant lit", () => {
  const page = code("src/app/(participant)/mon-compte/activites/page.tsx");

  it("explique chaque échec par quelque chose d’actionnable", () => {
    // « Une erreur est survenue » serait vrai pour tous et utile pour aucun.
    for (const reason of [
      "refus",
      "deja-lie",
      "etat",
      "consentement",
      "injoignable",
    ]) {
      // `deja-lie` porte des guillemets dans l'objet, à cause du tiret.
      expect(page).toMatch(new RegExp(`"?${reason}"?:`));
    }
  });

  it("ne montre le bouton qu’avec le consentement", () => {
    expect(page.indexOf("consent.granted")).toBeLessThan(
      page.indexOf("api/activites/connexion/strava"),
    );
  });

  it("ne montre jamais un jeton", () => {
    expect(page).not.toMatch(/access_token|accessToken/);
  });
});

describe("le retrait du consentement", () => {
  const actions = code("src/lib/activities/consent-actions.ts");

  it("délie le compte sportif", () => {
    // Garder la liaison vivante sans consentement, ce serait détenir un jeton
    // qu'on n'a plus le droit d'utiliser — et continuer à collecter les
    // sorties de quelqu'un qui vient de dire stop.
    expect(actions).toMatch(/action === "withdrawn"[\s\S]{0,80}unlinkAccount/);
  });
});
