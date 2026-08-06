import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { urlBase64ToUint8Array } from "@/lib/notifications/vapid";

/* =========================================================================
 * L'abonnement aux notifications (story 6.1)
 *
 * Une application de jeu quotidien sans rappel quotidien perd ses joueurs en
 * une semaine. Et la demande d'autorisation est le seul geste de
 * l'application qui ne se rattrape pas : refusée une fois, le navigateur ne
 * la reproposera jamais.
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
  read("supabase/migrations/20260806170000_push_subscriptions.sql"),
);
const store = code(read("src/lib/notifications/subscriptions.ts"));
const actions = code(read("src/lib/notifications/actions.ts"));
const vapid = code(read("src/lib/notifications/vapid.ts"));
const worker = code(read("src/app/sw.ts"));
const permission = code(
  read("src/components/notifications/push-permission.tsx"),
);
const env = read(".env.example");

describe("la table des abonnements", () => {
  it("identifie un abonnement par son point de terminaison, pas par la personne", () => {
    // AC 5 : un participant a légitimement plusieurs appareils.
    expect(migration).toMatch(
      /create unique index push_subscriptions_endpoint_key/,
    );
    expect(migration).toMatch(/\(endpoint\)/);
  });

  it("n'ouvre aucune politique d'écriture", () => {
    // failure_count, last_success_at et disabled_at sont la comptabilité de
    // l'expéditeur : la sécurité filtre des lignes, pas des colonnes, donc
    // écrire sa propre ligne reviendrait à pouvoir remettre à zéro ce qui
    // permet de retirer un abonnement mort.
    expect(migration).not.toMatch(/for insert/i);
    expect(migration).not.toMatch(/for update/i);
    expect(migration).not.toMatch(/for delete/i);
    expect(migration).not.toMatch(/for all/i);
  });

  it("laisse chacun lire ses propres appareils", () => {
    expect(migration).toMatch(
      /create policy "participants read their own subscriptions"[\s\S]*?auth\.uid\(\)\) = profile_id/,
    );
  });

  it("active la sécurité au niveau des lignes", () => {
    expect(migration).toMatch(
      /alter table public\.push_subscriptions enable row level security/,
    );
  });
});

describe("enregistrer un abonnement", () => {
  it("ne double jamais un point de terminaison déjà connu", () => {
    // AC 6. Un navigateur redonne le même endpoint quand la page redemande —
    // réouverture, nouvelle autorisation, rotation du service. Deux lignes
    // voudraient dire deux notifications, et ça se lit comme un bug du jeu.
    expect(store).toMatch(/\.upsert\(/);
    expect(store).toMatch(/onConflict: "endpoint"/);
  });

  it("prend l'identité dans la session, jamais en paramètre", () => {
    const region = store.slice(
      store.indexOf("export async function saveSubscription"),
    );

    expect(region).toMatch(/getUser\(\)/);
    expect(region).toMatch(/profile_id: user\.id/);
  });

  it("réanime un abonnement que l'expéditeur avait désactivé", () => {
    // Un abonnement proposé à nouveau est vivant à nouveau.
    expect(store).toMatch(/failure_count: 0/);
    expect(store).toMatch(/disabled_at: null/);
  });

  it("porte la garde d'identité dans la suppression elle-même", () => {
    const region = store.slice(
      store.indexOf("export async function removeSubscription"),
    );

    expect(region).toMatch(/\.eq\("profile_id", user\.id\)/);
  });

  it("refuse un abonnement inexploitable plutôt que de le stocker", () => {
    // Sinon on le découvre à trois heures du matin, au milieu d'un lot.
    expect(actions).toMatch(/startsWith\("https:\/\/"\)/);
  });
});

describe("les clés VAPID", () => {
  it("séparent ce qui va au navigateur de ce qui signe", () => {
    // La confusion des deux est le défaut classique de Web Push, et elle ne
    // produit aucune erreur visible.
    expect(vapid).toMatch(/NEXT_PUBLIC_VAPID_PUBLIC_KEY/);
    expect(vapid).not.toMatch(/VAPID_PRIVATE_KEY/);
  });

  it("sont documentées avec la commande qui les génère", () => {
    expect(env).toMatch(/web-push generate-vapid-keys/);
  });

  it("se convertissent correctement en octets pour le navigateur", () => {
    // base64url → octets. Copié de travers une fois, puis débogué une heure.
    const bytes = urlBase64ToUint8Array("SGVsbG8");

    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it("acceptent les caractères propres à base64url", () => {
    const bytes = urlBase64ToUint8Array("-_8");

    expect(Array.from(bytes)).toEqual([251, 255]);
  });
});

describe("le service worker", () => {
  it("affiche la notification reçue", () => {
    expect(worker).toMatch(/addEventListener\("push"/);
    expect(worker).toMatch(/showNotification/);
  });

  it("ouvre l'écran concerné quand on la touche", () => {
    // AC 7.
    expect(worker).toMatch(/addEventListener\("notificationclick"/);
    expect(worker).toMatch(/openWindow/);
  });

  it("reprend une fenêtre déjà ouverte plutôt que d'en ajouter une", () => {
    // Sur un téléphone, ouvrir un doublon de l'application fait perdre ce qui
    // était à l'écran.
    expect(worker).toMatch(/matchAll/);
    expect(worker).toMatch(/client\.focus\(\)/);
  });

  it("ne navigue jamais hors de l'application", () => {
    expect(worker).toMatch(/function safePath/);
    expect(worker).toMatch(/\/\^\\\/\(\?!\[\/\\\\\]\)\//);
  });

  it("survit à une notification sans contenu", () => {
    // Certains services en envoient une pour réveiller le worker, et un
    // worker qui lève une exception cesse de traiter la suivante.
    expect(worker).toMatch(/if \(!data\) return \{\}/);
  });

  it("n'a pas remplacé la politique de cache", () => {
    // Les événements ajoutés sont les nôtres ; Serwist garde fetch, install
    // et activate (story 1.8).
    expect(worker).toMatch(/serwist\.addEventListeners\(\)/);
    expect(worker).not.toMatch(/defaultCache/);
  });
});

describe("la demande d'autorisation", () => {
  it("n'est jamais déclenchée au chargement", () => {
    // AC 3. Une demande spontanée est refusée par réflexe, et le refus est
    // définitif — le navigateur ne la reproposera plus jamais.
    const effects =
      permission.match(/useEffect\([\s\S]*?\}, \[[^\]]*\]\);/g) ?? [];

    for (const effect of effects) {
      expect(effect).not.toMatch(/requestPermission/);
    }

    expect(permission).toMatch(/const enable = async/);
    expect(
      permission.slice(permission.indexOf("const enable = async")),
    ).toMatch(/requestPermission/);
  });

  it("accepte un refus sans le redemander", () => {
    // AC 4.
    expect(permission).toMatch(/support === "denied"/);
    expect(permission).toMatch(/ne nous laissera plus/);
  });

  it("dit à un iPhone non installé ce qui manque, plutôt que d'échouer", () => {
    expect(permission).toMatch(/needs-install/);
    expect(permission).toMatch(/écran d’accueil/);
  });

  it("n'exige jamais que la notification soit silencieuse", () => {
    // Tous les navigateurs l'imposent, et on ne voudrait pas l'inverse.
    expect(permission).toMatch(/userVisibleOnly: true/);
  });

  it("se tait tant que rien n'est configuré", () => {
    // Sans clé publique, l'application n'offre rien plutôt que d'échouer.
    expect(permission).toMatch(/if \(!publicKey\)/);
  });
});
