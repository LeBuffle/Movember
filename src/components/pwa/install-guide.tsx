"use client";

import { useEffect, useState } from "react";

import { useDisplayMode } from "@/components/pwa/use-display-mode";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { installGuide } from "@/lib/pwa/install-steps";
import {
  detectPlatform,
  PLATFORM_LABELS,
  PLATFORMS,
  type Platform,
} from "@/lib/pwa/platform";

/**
 * The installation step.
 *
 * **The detected platform picks the open tab; it never hides the others.**
 * User-agent detection is wrong often enough to matter — iPadOS claims to be
 * a Mac, browsers rewrite the string freely — and a participant who lands on
 * the wrong instructions with no way out is a participant who does not
 * install. That is the failure this epic exists to prevent, so the three tabs
 * are always there (story 6.2 AC 6).
 *
 * **An already-installed app is offered nothing** (AC 5). Instructions for
 * something already done read as an application that does not know its own
 * state, and they teach people to ignore the next message too.
 *
 * On Android and on a computer the browser may offer a one-tap install; the
 * event that carries it arrives on its own schedule and sometimes never. It
 * is used when it turns up and the written steps stand alone when it does
 * not — never the other way round.
 */

/** The part of `beforeinstallprompt` we use. Not in the DOM typings. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallGuide({ compact = false }: { compact?: boolean }) {
  const displayMode = useDisplayMode();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(
      detectPlatform({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
      }),
    );
  }, []);

  useEffect(() => {
    const capture = (event: Event) => {
      // Held rather than let through: Chrome's own banner appears where it
      // decides, which is rarely where the participant is reading the steps.
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", () => setPrompt(null));

    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  // Nothing at all until both answers are in. Flashing "installez
  // l'application" at somebody who already did is exactly the message this
  // component must never show.
  if (displayMode === null || platform === null) return null;

  if (displayMode === "installed") {
    return (
      <Alert tone="success" title="L’application est installée">
        Vous la lisez depuis votre écran d’accueil. Il n’y a rien d’autre à
        faire.
      </Alert>
    );
  }

  const guide = installGuide(platform);

  return (
    <div className="space-y-4">
      {/* Tabs, not a dropdown: the three options have to be visible for the
          participant to realise the detection can be overridden. */}
      <div
        role="tablist"
        aria-label="Choisissez votre appareil"
        className="border-line flex flex-wrap gap-1 border-b"
      >
        {PLATFORMS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={candidate === platform}
            onClick={() => setPlatform(candidate)}
            className={cn(
              "min-h-11 rounded-t-lg px-3 text-sm font-medium",
              candidate === platform
                ? "border-brand-blue text-brand-blue border-b-2"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {PLATFORM_LABELS[candidate]}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="space-y-4">
        {!compact && (
          <h2 className="text-ink text-xl font-bold">{guide.title}</h2>
        )}

        {guide.mandatoryForPush ? (
          <Alert tone="warning" title="Étape indispensable sur iPhone">
            {guide.stake}
          </Alert>
        ) : (
          <p className="text-ink-muted">{guide.stake}</p>
        )}

        {prompt && platform !== "ios" && (
          <Button
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
            }}
          >
            Installer l’application
          </Button>
        )}

        <ol className="text-ink list-decimal space-y-2 pl-5">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        {guide.note && <p className="text-ink-muted text-sm">{guide.note}</p>}
      </div>
    </div>
  );
}
