import "server-only";

import { decryptToken } from "@/lib/activities/crypto";
import { validAccessToken } from "@/lib/activities/refresh";
import { stravaConfigured, stravaProbe } from "@/lib/activities/sources/strava";
import { editionStartDate } from "@/lib/edition/start";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Walking the Strava chain, one link at a time (runbook §12 quinquies).
 *
 * **Because "Strava n'a pas répondu" was true and useless.** The chain has
 * six places it can break, four of them never touch the network, and Strava's
 * own dashboard cannot show any of those four — nothing ever arrives there.
 * A message that covers all six equally sends whoever is repairing it to read
 * server logs, which is not possible from a phone during a rehearsal.
 *
 * So this walks the chain and says where it stopped. Administrators only, on
 * demand: the last step spends one call against the quota shared by every
 * participant, which is fine once and wrong on every page load.
 *
 * Nothing secret is returned — presence, lengths and status codes. A
 * diagnostic that prints a token is a diagnostic that ends up in a screenshot
 * sent over a messaging app.
 */

export type DiagnosticStep = {
  label: string;
  state: "ok" | "ko" | "warn";
  detail: string;
};

export type Diagnostic = {
  steps: DiagnosticStep[];
  /** Said in one line, for somebody who reads nothing else. */
  verdict: string;
};

export async function diagnoseStrava(profileId: string): Promise<Diagnostic> {
  const steps: DiagnosticStep[] = [];

  const stop = (verdict: string): Diagnostic => ({ steps, verdict });

  /* 1 — the application's own credentials -------------------------------- */

  if (!stravaConfigured()) {
    steps.push({
      label: "Identifiants de l’application Strava",
      state: "ko",
      detail:
        "STRAVA_CLIENT_ID ou STRAVA_CLIENT_SECRET est absent du fichier d’environnement du serveur. Aucun appel n’est même tenté — ce qui explique qu’aucune requête n’apparaisse côté Strava.",
    });

    return stop(
      "L’application n’a pas ses identifiants Strava. À corriger sur le serveur, pas dans le code.",
    );
  }

  steps.push({
    label: "Identifiants de l’application Strava",
    state: "ok",
    detail: "Présents dans l’environnement du serveur.",
  });

  /* 2 — the key that reads the stored tokens ----------------------------- */

  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    steps.push({
      label: "Clé de chiffrement des jetons",
      state: "ko",
      detail:
        "TOKEN_ENCRYPTION_KEY est absente. Les jetons enregistrés sont illisibles : chaque participant devra reconnecter son compte.",
    });

    return stop("La clé de chiffrement des jetons manque sur le serveur.");
  }

  steps.push({
    label: "Clé de chiffrement des jetons",
    state: "ok",
    detail: "Présente.",
  });

  /* 3 — the edition's window --------------------------------------------- */

  const start = await editionStartDate();
  const started = new Date() >= start;

  steps.push({
    label: "Fenêtre de l’édition",
    state: started ? "ok" : "warn",
    detail: started
      ? `Les sorties sont récupérées à partir du ${start.toISOString().slice(0, 10)}.`
      : `L’édition commence le ${start.toISOString().slice(0, 10)} : rien n’est récupéré avant. Ce n’est pas une panne.`,
  });

  /* 4 — the link itself --------------------------------------------------- */

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("activity_connections")
    .select(
      "id, access_token, refresh_token, expires_at, status, refreshing_at, last_synced_at, scopes",
    )
    .eq("profile_id", profileId)
    .eq("provider", "strava")
    .is("disconnected_at", null)
    .maybeSingle();

  if (!link) {
    steps.push({
      label: "Liaison en base",
      state: "ko",
      detail: "Aucun compte Strava relié pour ce profil.",
    });

    return stop("Ce compte n’a pas de liaison Strava.");
  }

  const expired = new Date(link.expires_at).getTime() <= Date.now();

  steps.push({
    label: "Liaison en base",
    state: link.status === "active" ? "ok" : "ko",
    detail:
      `Statut « ${link.status} ». Jeton ${expired ? "expiré" : "encore valide"} ` +
      `(échéance ${new Date(link.expires_at).toLocaleString("fr-FR")}). ` +
      (link.refreshing_at
        ? `⚠️ Un rafraîchissement est marqué en cours depuis le ${new Date(link.refreshing_at).toLocaleString("fr-FR")} — il se libère seul au bout de deux minutes.`
        : "Aucun rafraîchissement en cours."),
  });

  /* 4 bis — the scope actually granted -----------------------------------
   *
   * **Demandée n'est pas accordée.** L'écran d'autorisation de Strava laisse
   * décocher la lecture des activités, et une liaison ainsi réduite se
   * comporte parfaitement — jusqu'au moment où l'on demande des sorties, et
   * où Strava répond 401. Le compte a l'air relié, et il l'est ; il ne donne
   * simplement pas ce qu'il faut.
   *
   * L'écran des paramètres Strava affiche « étendue : read » pour le jeton
   * personnel du développeur, ce qui n'est pas la même chose que la portée
   * accordée par un participant — d'où l'intérêt de lire celle qu'on a
   * réellement enregistrée plutôt que de la supposer. */

  const scopes = link.scopes ?? [];
  const canReadActivities = scopes.some(
    (scope) => scope === "activity:read_all" || scope === "activity:read",
  );

  steps.push({
    label: "Portée accordée par le participant",
    state: canReadActivities ? "ok" : "ko",
    detail: canReadActivities
      ? `Accordée : ${scopes.join(", ")}.`
      : `Accordée : ${scopes.join(", ") || "aucune"}. La lecture des activités n’en fait pas partie — l’autorisation a été donnée sans cocher « voir vos activités ». Il faut reconnecter le compte et accepter cette case.`,
  });

  /* 5 — can the stored tokens be read? ------------------------------------ */

  const readable =
    decryptToken(link.access_token) !== null &&
    decryptToken(link.refresh_token) !== null;

  steps.push({
    label: "Lecture des jetons enregistrés",
    state: readable ? "ok" : "ko",
    detail: readable
      ? "Les deux jetons se déchiffrent."
      : "Les jetons ne se déchiffrent pas : la clé a changé depuis leur enregistrement. Il faut reconnecter le compte.",
  });

  if (!readable) {
    return stop(
      "Les jetons enregistrés sont illisibles. Reconnecter le compte Strava suffit.",
    );
  }

  /* 6 — getting a usable token, refreshing if due ------------------------- */

  const token = await validAccessToken(profileId);

  if (!token.ok) {
    const explain: Record<string, string> = {
      broken:
        "Strava a refusé le jeton de rafraîchissement. L’autorisation a été retirée, ou le secret client du serveur ne correspond plus à l’application Strava.",
      busy: "Un autre appel tient le verrou de rafraîchissement. Il se libère seul en deux minutes — réessayez.",
      missing: "La liaison a disparu entre deux lectures.",
      unavailable:
        "Le rafraîchissement du jeton a échoué sans réponse exploitable de Strava. Le plus souvent : le serveur ne joint pas www.strava.com.",
    };

    steps.push({
      label: "Obtention d’un jeton valide",
      state: "ko",
      detail: explain[token.reason] ?? token.reason,
    });

    return stop(
      "La chaîne s’arrête au rafraîchissement du jeton — avant tout appel à l’API de Strava.",
    );
  }

  steps.push({
    label: "Obtention d’un jeton valide",
    state: "ok",
    detail: "Jeton d’accès obtenu.",
  });

  /* 7 — one real call ----------------------------------------------------- */

  const probe = await stravaProbe(token.token);

  if (probe.status === null) {
    steps.push({
      label: "Appel réel à Strava",
      state: "ko",
      detail: `La requête n’est jamais partie : ${probe.detail}. C’est une panne de sortie réseau du serveur — et c’est pour cela que Strava n’enregistre aucune requête.`,
    });

    return stop("Le serveur ne joint pas Strava.");
  }

  const ok = probe.status >= 200 && probe.status < 300;

  steps.push({
    label: "Appel réel à Strava",
    state: ok ? "ok" : "ko",
    detail: ok
      ? "Strava répond normalement."
      : `Strava répond ${probe.status}. ${probe.detail}`,
  });

  if (ok && !canReadActivities) {
    return stop(
      "Strava répond, mais l’autorisation ne couvre pas la lecture des activités. Reconnectez le compte en acceptant « voir vos activités ».",
    );
  }

  if (ok) {
    return stop(
      link.last_synced_at
        ? "Tout répond. Si des sorties manquent, c’est une question de fenêtre de dates, pas de liaison."
        : "Tout répond. Lancez une resynchronisation : la liaison n’a encore jamais rapatrié de sortie.",
    );
  }

  if (probe.status === 429) {
    return stop(
      "Quota d’appels épuisé. Attendre le quart d’heure suivant — insister prolonge la coupure pour tout le monde.",
    );
  }

  if (probe.status === 401 || probe.status === 403) {
    return stop(
      "Strava refuse ce jeton. L’autorisation a été retirée, ou la portée demandée ne couvre pas la lecture des activités.",
    );
  }

  return stop(`Strava répond ${probe.status}. Le détail est au-dessus.`);
}
