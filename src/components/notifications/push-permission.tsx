"use client";

import { useEffect, useState } from "react";

import { useDisplayMode } from "@/components/pwa/use-display-mode";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PushState } from "@/lib/notifications/actions";
import { urlBase64ToUint8Array } from "@/lib/notifications/vapid";

/**
 * Asking to be allowed to notify.
 *
 * **Never on page load, and that is the whole design of this component.** A
 * permission prompt that appears on its own is refused by reflex, and the
 * refusal is final — the browser will not offer it again, on any later visit,
 * whatever we do. It is the one gesture in the application that cannot be
 * retried. So the reason comes first, in a sentence, and the prompt only
 * follows a deliberate press.
 *
 * The states are all real, and each says something different:
 *
 * - **not supported** — an old browser, or iOS Safari outside the home
 *   screen. Not a failure, and not the participant's fault.
 * - **not installed, on iOS** — nothing works until the app is added to the
 *   home screen, and saying so is more useful than a button that fails.
 * - **refused** — accepted as an answer. No second attempt, no nagging: the
 *   browser would refuse anyway, and the e-mail fallback covers this person
 *   (story 6.4).
 * - **allowed** — done, with a way out.
 */

type Support =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "default"
  | "granted"
  | "denied";

/**
 * Combien de temps on laisse au service worker pour s'activer.
 *
 * Dix secondes est long pour quelqu'un qui regarde son téléphone, et court
 * pour une première installation sur une mauvaise connexion. Le compromis
 * penche vers le message : attendre sans rien dire est le seul résultat qu'il
 * ne faut pas produire.
 */
const WORKER_TIMEOUT_MS = 10_000;

function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

/**
 * Le nom que le navigateur donne à sa panne.
 *
 * `NotAllowedError`, `AbortError`, `NotSupportedError` — ce n'est pas beau à
 * lire, et c'est exactement ce qui permet de dire au participant quoi faire
 * plutôt que de lui demander de réessayer en espérant.
 */
function name(error: unknown): string {
  if (error instanceof Error && error.name) return error.name;

  return "erreur inconnue";
}

export function PushPermission({
  publicKey,
  subscribed,
  register,
  forget,
}: {
  publicKey: string | null;
  /** Whether this participant already has at least one live device. */
  subscribed: boolean;
  register: (previous: PushState, formData: FormData) => Promise<PushState>;
  forget: (previous: PushState, formData: FormData) => Promise<PushState>;
}) {
  const displayMode = useDisplayMode();
  const [support, setSupport] = useState<Support>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(subscribed);

  useEffect(() => {
    if (displayMode === null) return;

    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      // On an iPhone that has not installed the app, the push API is simply
      // absent — so this branch and the next describe the same device at two
      // moments, and only the second is actionable.
      //
      // `react-hooks/set-state-in-effect` (nouveau avec Next 16) préférerait
      // que cet état soit calculé pendant le rendu. Il ne peut pas l'être :
      // `navigator` et `Notification` n'existent pas sur le serveur, et le
      // rendu initial est fait là-bas. Un effet est le seul moment où la
      // question a une réponse.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupport(displayMode === "browser" ? "needs-install" : "unsupported");
      return;
    }

    setSupport(Notification.permission as "default" | "granted" | "denied");
  }, [displayMode]);

  const enable = async () => {
    if (!publicKey) return;

    setBusy(true);
    setMessage(null);

    // Asked inside the click handler, never anywhere else: browsers tie the
    // prompt to a user gesture, and some ignore a request made outside one.
    let permission: NotificationPermission;

    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      setMessage(
        `Votre navigateur a refusé la demande d’autorisation (${name(error)}).`,
      );
      setBusy(false);
      return;
    }

    if (permission !== "granted") {
      setSupport(permission as "denied" | "default");
      setBusy(false);
      return;
    }

    /* **Chaque étape rend son propre échec, et c'est le sujet.**
     *
     * Les trois qui suivent échouent de trois façons qui se réparent
     * différemment, et une seule phrase pour les trois envoyait le
     * participant — ou le bénévole qui l'aide — chercher au mauvais endroit.
     * Le 14 août, une autorisation acceptée n'a rien enregistré du tout, et
     * l'écran n'avait rien à en dire. */

    let registration: ServiceWorkerRegistration;

    try {
      /* **Avec une échéance, parce que cette promesse peut ne jamais se
         tenir.** `ready` n'échoue pas quand le service worker ne s'active
         pas : elle attend, indéfiniment. Le bouton restait alors sur « … »
         pour toujours, ce qui se raconte exactement comme « j'ai validé et
         il ne s'est rien passé ». */
      registration = await deadline(
        navigator.serviceWorker.ready,
        WORKER_TIMEOUT_MS,
      );
    } catch {
      setMessage(
        "Le service d’arrière-plan de l’application ne s’est pas activé sur cet appareil. " +
          "Fermez complètement l’application (glissez-la vers le haut), rouvrez-la depuis " +
          "l’écran d’accueil, puis réessayez.",
      );
      setBusy(false);
      return;
    }

    let subscription: PushSubscription;

    try {
      subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push may only ever result in something
        // the participant sees. We would not want a silent one anyway.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (error) {
      setMessage(
        `Votre téléphone n’a pas pu créer l’abonnement (${name(error)}). ` +
          "Sur iPhone, cela arrive quand l’application a été ouverte depuis Safari " +
          "plutôt que depuis l’écran d’accueil, ou juste après une réinstallation : " +
          "fermez-la complètement et rouvrez-la depuis l’écran d’accueil.",
      );
      setBusy(false);
      return;
    }

    try {
      const json = subscription.toJSON();

      const form = new FormData();
      form.set("endpoint", subscription.endpoint);
      form.set("p256dh", json.keys?.p256dh ?? "");
      form.set("auth", json.keys?.auth ?? "");
      form.set("userAgent", navigator.userAgent);

      const result = await register({}, form);

      if (result.ok) {
        setSupport("granted");
        setDone(true);
      } else {
        setMessage(
          result.message ??
            "L’abonnement a bien été créé sur le téléphone, mais le serveur ne l’a pas enregistré. Réessayez dans un instant.",
        );
      }
    } catch (error) {
      setMessage(
        `L’abonnement a été créé sur le téléphone mais n’a pas pu être envoyé au serveur (${name(error)}). Réessayez.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const form = new FormData();
        form.set("endpoint", subscription.endpoint);

        await forget({}, form);
        await subscription.unsubscribe();
      }

      setDone(false);
    } catch {
      setMessage("La désinscription n’a pas abouti. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  if (!publicKey) {
    return (
      <Alert tone="info" title="Les notifications ne sont pas encore activées">
        Elles le seront avant l’ouverture des inscriptions. Vous n’avez rien à
        faire.
      </Alert>
    );
  }

  if (support === "checking") return null;

  if (support === "needs-install") {
    return (
      <Alert tone="warning" title="Installez d’abord l’application">
        Sur iPhone, les notifications ne fonctionnent qu’une fois l’application
        ajoutée à l’écran d’accueil. Faites-le, rouvrez l’application depuis
        l’écran d’accueil, puis revenez ici.
      </Alert>
    );
  }

  if (support === "unsupported") {
    return (
      <Alert tone="info" title="Ce navigateur ne gère pas les notifications">
        Ce n’est pas de votre fait, et vous ne manquerez rien d’essentiel :
        votre défi du jour et les annonces vous arriveront par e-mail.
      </Alert>
    );
  }

  if (support === "denied") {
    return (
      <Alert tone="info" title="Les notifications sont bloquées">
        Vous les avez refusées, et votre navigateur ne nous laissera plus vous
        les redemander. Vous pouvez les réautoriser dans ses réglages de site.
        D’ici là, l’essentiel vous arrivera par e-mail.
      </Alert>
    );
  }

  if (done) {
    return (
      <div className="space-y-3">
        <Alert tone="success" title="Notifications activées sur cet appareil">
          Vous serez prévenu de votre défi du jour et de vos défis validés.
        </Alert>

        <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
          {busy ? "…" : "Ne plus recevoir sur cet appareil"}
        </Button>

        {message && (
          <p role="alert" className="text-danger text-sm">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-ink-muted text-sm">
        Votre navigateur va vous demander l’autorisation. Une seule fois : s’il
        est refusé, il ne le proposera plus.
      </p>

      <Button onClick={enable} disabled={busy}>
        {busy ? "…" : "Activer les notifications"}
      </Button>

      {message && (
        <>
          <p role="alert" className="text-danger text-sm">
            {message}
          </p>

          <DeviceState />
        </>
      )}
    </div>
  );
}

/**
 * Ce que seul le téléphone sait, affiché seulement quand ça a raté.
 *
 * Le diagnostic du back-office s'arrête à la frontière du serveur : il sait
 * dire « aucun abonnement enregistré », jamais pourquoi. Les trois faits
 * ci-dessous vivent dans le navigateur et nulle part ailleurs, et ce sont eux
 * qui distinguent une application ouverte depuis Safari d'un service worker
 * qui ne s'active pas.
 *
 * Sous le message d'erreur, et jamais autrement : personne n'a besoin de lire
 * ça quand tout marche.
 */
function DeviceState() {
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      const standalone =
        typeof window !== "undefined" &&
        window.matchMedia("(display-mode: standalone)").matches;

      const found: string[] = [
        `Ouverture : ${standalone ? "depuis l’écran d’accueil" : "dans le navigateur — c’est la cause la plus fréquente sur iPhone"}`,
        `Autorisation : ${Notification.permission}`,
      ];

      try {
        const registration = await navigator.serviceWorker.getRegistration("/");

        found.push(
          `Service d’arrière-plan : ${
            registration?.active
              ? "actif"
              : registration
                ? "enregistré mais pas encore actif"
                : "absent"
          }`,
        );

        const existing = await registration?.pushManager.getSubscription();
        found.push(`Abonnement sur l’appareil : ${existing ? "oui" : "non"}`);
      } catch (error) {
        found.push(`Service d’arrière-plan : illisible (${name(error)})`);
      }

      if (!cancelled) setLines(found);
    };

    void read();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!lines) return null;

  return (
    <details className="text-ink-muted text-sm">
      <summary className="cursor-pointer">État de cet appareil</summary>
      <ul className="mt-2 space-y-1">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
