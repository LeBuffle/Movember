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

    try {
      // Asked inside the click handler, never anywhere else: browsers tie the
      // prompt to a user gesture, and some ignore a request made outside one.
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setSupport(permission as "denied" | "default");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push may only ever result in something
        // the participant sees. We would not want a silent one anyway.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

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
          result.message ?? "L’abonnement n’a pas pu être enregistré.",
        );
      }
    } catch {
      setMessage(
        "Votre navigateur n’a pas pu créer l’abonnement. Réessayez dans un instant.",
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
        <p role="alert" className="text-danger text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
