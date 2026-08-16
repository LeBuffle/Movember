import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

import { emailConfigured } from "@/lib/email/client";
import { CATEGORY_LABELS } from "@/lib/notifications/payload";
import { preferencesFor } from "@/lib/notifications/preferences";
import { pushSendConfigured } from "@/lib/notifications/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Walking the notification chain, one link at a time (runbook §12 septies).
 *
 * **Because "je reçois un e-mail au lieu d'une notification" is a complete
 * description of the symptom and says nothing about the cause.** The e-mail
 * fallback is not a failure mode — it is what the application does, correctly,
 * for anybody who has no live device. So the message that arrives is the same
 * whether the subscription was never stored, was retired after a dead
 * endpoint, or could not be read at all because a query failed.
 *
 * Three different repairs, one indistinguishable symptom. This says which.
 *
 * Administrators only, on demand. Nothing secret is returned: no endpoint, no
 * key, no address — presence, counts, dates and status codes. An endpoint is
 * a capability to send to somebody's phone, and a diagnostic that prints one
 * is a diagnostic that ends up in a screenshot.
 */

export type DiagnosticStep = {
  label: string;
  state: "ok" | "ko" | "warn";
  detail: string;
};

export type NotificationDiagnostic = {
  steps: DiagnosticStep[];
  /** Said in one line, for somebody who reads nothing else. */
  verdict: string;
  /** Whether a test send has anything to send to. */
  hasDevice: boolean;
};

/**
 * Where a device is in its life, said in one sentence each.
 *
 * `disabled_at` is the field that matters and the one nothing on any screen
 * shows: the sender retires an endpoint on a 404 or a 410 (story 6.3), and a
 * participant whose device was retired sees exactly what a participant who
 * never subscribed sees.
 */
type DeviceRow = {
  created_at: string;
  last_success_at: string | null;
  failure_count: number;
  disabled_at: string | null;
  user_agent: string | null;
};

function frenchDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR");
}

/**
 * "iPhone", "Android", "ordinateur" — nothing finer.
 *
 * The full user agent names a model and an operating system version. It is
 * stored because a volunteer helping somebody needs to know which device they
 * are talking about; it is not printed, because the answer to that question is
 * one word.
 */
function deviceKind(userAgent: string | null): string {
  if (!userAgent) return "appareil inconnu";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iPhone ou iPad";
  if (/Android/i.test(userAgent)) return "Android";

  return "ordinateur";
}

export async function diagnoseNotifications(
  profileId: string,
): Promise<NotificationDiagnostic> {
  const steps: DiagnosticStep[] = [];

  const stop = (
    verdict: string,
    hasDevice = false,
  ): NotificationDiagnostic => ({ steps, verdict, hasDevice });

  /* 1 — the keys that sign a send ---------------------------------------- */

  if (!pushSendConfigured()) {
    steps.push({
      label: "Clés d’envoi (VAPID)",
      state: "ko",
      detail:
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY est absente du fichier d’environnement du serveur. Aucune notification ne peut partir, et l’application bascule tout le monde sur l’e-mail — ce qui est exactement le symptôme observé.",
    });

    return stop(
      "Les clés d’envoi manquent sur le serveur. À corriger dans le fichier d’environnement, pas dans le code.",
    );
  }

  steps.push({
    label: "Clés d’envoi (VAPID)",
    state: "ok",
    detail: "Les deux clés sont présentes dans l’environnement du serveur.",
  });

  /* 2 — the service worker, which is what receives a push -----------------
   *
   * **Ajouté après la montée en Next 16.** Le nouveau moteur de construction
   * ne fabrique pas ce fichier, et il ne le dit pas : l'application se
   * déploie entière, toutes les pages en place, et aucun téléphone ne peut
   * plus rien recevoir. Un envoi partirait sans erreur côté serveur. */

  const worker = path.join(process.cwd(), "public", "sw.js");

  if (!existsSync(worker)) {
    steps.push({
      label: "Service worker embarqué",
      state: "ko",
      detail:
        "Le fichier public/sw.js est absent de l’application déployée. C’est lui qui reçoit les notifications sur le téléphone : sans lui, aucun abonnement ne peut être créé et aucune notification affichée. Il est fabriqué à la construction — une construction qui l’oublie ne signale rien.",
    });

    return stop(
      "L’application déployée n’embarque pas son service worker. C’est un défaut de construction, pas un réglage.",
    );
  }

  steps.push({
    label: "Service worker embarqué",
    state: "ok",
    detail: "public/sw.js est présent dans l’application déployée.",
  });

  /* 3 — can the devices table be read at all? -----------------------------
   *
   * Le chemin silencieux. `withDevices` renvoie un ensemble vide quand la
   * lecture échoue, et bascule donc *tout le monde* sur l'e-mail — sans que
   * rien, nulle part, ne distingue ce cas d'un parc sans aucun téléphone. */

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select(
      "created_at, last_success_at, failure_count, disabled_at, user_agent",
    )
    .eq("profile_id", profileId);

  if (error) {
    steps.push({
      label: "Lecture des abonnements",
      state: "ko",
      detail: `La table des abonnements n’est pas lisible (code ${error.code}). Dans ce cas l’application bascule tout le monde sur l’e-mail, sans le dire : c’est le seul défaut de cette liste qui se produit pour tous les participants à la fois.`,
    });

    return stop("La table des abonnements ne répond pas.");
  }

  steps.push({
    label: "Lecture des abonnements",
    state: "ok",
    detail: "La table des abonnements répond.",
  });

  /* 4 — this participant's devices ---------------------------------------- */

  const devices = (rows ?? []) as DeviceRow[];
  const live = devices.filter((row) => row.disabled_at === null);
  const retired = devices.filter((row) => row.disabled_at !== null);

  if (devices.length === 0) {
    steps.push({
      label: "Appareils de ce participant",
      state: "ko",
      detail:
        "Aucun abonnement enregistré, ni actif ni retiré. L’autorisation a bien pu être donnée sur le téléphone sans que l’enregistrement aboutisse côté serveur : l’écran affiche alors le message d’erreur rouge sous le bouton, et il est facile de ne pas le voir. Sur iPhone, vérifier aussi que l’application a été ouverte depuis l’écran d’accueil et non depuis Safari.",
    });

    return stop(
      "Ce compte n’a aucun appareil enregistré : c’est pour cela que tout lui part par e-mail.",
    );
  }

  if (live.length === 0) {
    const last = retired
      .map((row) => row.disabled_at!)
      .sort()
      .at(-1)!;

    steps.push({
      label: "Appareils de ce participant",
      state: "ko",
      detail: `${retired.length} appareil(s) enregistré(s), tous retirés — le dernier le ${frenchDate(last)}. Un appareil est retiré quand le service de notification répond que l’adresse n’existe plus : application désinstallée, navigateur effacé, ou abonnement remplacé. Il suffit de réactiver les notifications depuis le téléphone : le nouvel abonnement remplace l’ancien.`,
    });

    return stop(
      "Les appareils de ce compte ont tous été retirés. Réactiver les notifications depuis le téléphone suffit.",
    );
  }

  steps.push({
    label: "Appareils de ce participant",
    state: "ok",
    detail: live
      .map(
        (row) =>
          `${deviceKind(row.user_agent)}, enregistré le ${frenchDate(row.created_at)}, ` +
          (row.last_success_at
            ? `dernier envoi réussi le ${frenchDate(row.last_success_at)}`
            : "aucun envoi réussi pour l’instant") +
          (row.failure_count > 0
            ? `, ${row.failure_count} échec(s) consécutif(s)`
            : ""),
      )
      .join(" · "),
  });

  /* 5 — the participant's own preferences --------------------------------- */

  const preferences = (await preferencesFor([profileId])).get(profileId)!;

  const off = Object.entries(preferences.categories)
    .filter(([, on]) => !on)
    .map(([category]) => CATEGORY_LABELS[category as never] ?? category);

  if (!preferences.channelPush) {
    steps.push({
      label: "Réglages du participant",
      state: "ko",
      detail:
        "Le canal « notification sur le téléphone » est coupé dans ses réglages. Tout part alors par e-mail, et c’est le comportement voulu — ce n’est pas une panne.",
    });

    return stop(
      "Ce participant a coupé les notifications sur téléphone dans ses réglages.",
    );
  }

  steps.push({
    label: "Réglages du participant",
    state: off.length > 0 ? "warn" : "ok",
    detail:
      off.length > 0
        ? `Le canal téléphone est actif, mais ces catégories sont coupées : ${off.join(", ")}. Un message de ces catégories-là n’arrivera pas, et c’est voulu.`
        : "Le canal téléphone est actif et aucune catégorie n’est coupée.",
  });

  /* 6 — why an e-mail arrives at all -------------------------------------- */

  steps.push({
    label: "Repli par e-mail",
    state: emailConfigured() ? "ok" : "warn",
    detail: emailConfigured()
      ? "Configuré. C’est lui qui a envoyé l’e-mail reçu à la place de la notification — le repli fonctionne, c’est la notification qui n’est pas partie."
      : "Non configuré. Un participant sans appareil ne recevrait donc rien du tout.",
  });

  return stop(
    "Toute la chaîne est en place et cet appareil devrait recevoir. Lancez l’envoi de test ci-dessous : c’est la seule étape qui interroge vraiment le service de notification.",
    true,
  );
}
