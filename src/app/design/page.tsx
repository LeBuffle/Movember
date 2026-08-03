import { notFound } from "next/navigation";

import { ChallengeStatus } from "@/components/game/challenge-status";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { APP_ENVIRONMENT } from "@/lib/app-version";

export const metadata = {
  title: "Composants — DEFI Movember",
  robots: { index: false, follow: false },
};

/**
 * Evaluated per request, not at build time. Without this the page would be
 * statically prerendered with whatever APP_ENVIRONMENT was set during the
 * build, and the production guard below would never run.
 */
export const dynamic = "force-dynamic";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-ink text-xl font-bold">{title}</h2>
        {note && <p className="text-ink-muted mt-1 text-sm">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Component gallery, used to review the design system in one place.
 * Not part of the product: hidden in production.
 */
export default function DesignPage() {
  if (APP_ENVIRONMENT === "production") {
    notFound();
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-3xl space-y-12 px-4 py-10">
        <div>
          <h1 className="text-ink text-3xl font-bold">Charte et composants</h1>
          <p className="text-ink-muted mt-2">
            Page de référence interne. Elle n’est pas accessible en production.
          </p>
        </div>

        <Section
          title="Couleurs"
          note="L’orange vif est un accent : il ne porte jamais de texte courant. Quand l’orange doit porter du texte, c’est la version foncée qui est utilisée."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { name: "Bleu", className: "bg-brand-blue" },
              { name: "Bleu foncé", className: "bg-brand-blue-dark" },
              { name: "Orange accent", className: "bg-brand-orange" },
              { name: "Orange texte", className: "bg-brand-orange-ink" },
            ].map((swatch) => (
              <div key={swatch.name} className="space-y-1">
                <div
                  className={`border-line h-16 rounded-lg border ${swatch.className}`}
                />
                <p className="text-ink-muted text-sm">{swatch.name}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Boutons" note="Hauteur minimale de 44 px sur mobile.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Je participe</Button>
            <Button variant="secondary">Voir le classement</Button>
            <Button variant="ghost">En savoir plus</Button>
            <Button variant="danger">Supprimer</Button>
            <Button disabled>Indisponible</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Petit</Button>
            <Button size="md">Moyen</Button>
            <Button size="lg">Grand</Button>
          </div>
        </Section>

        <Section title="Champs de saisie">
          <div className="space-y-4">
            <Input label="Pseudonyme" placeholder="MoustacheDeFer" />
            <Input
              label="Adresse e-mail"
              type="email"
              hint="Utilisée pour les rappels si vous n’installez pas l’application."
            />
            <Input
              label="Mot de passe"
              type="password"
              error="Le mot de passe doit contenir au moins 8 caractères."
            />
          </div>
        </Section>

        <Section
          title="État d’un défi"
          note="Chaque état porte une couleur, une icône et un mot. Jamais la couleur seule."
        >
          <div className="flex flex-wrap gap-3">
            <ChallengeStatus status="open" />
            <ChallengeStatus status="succeeded" />
            <ChallengeStatus status="failed" />
          </div>
        </Section>

        <Section
          title="Étiquettes"
          note="Réutilisées pour les raretés de cartes."
        >
          <div className="flex flex-wrap gap-2">
            <Badge>Commune</Badge>
            <Badge tone="blue">Rare</Badge>
            <Badge tone="orange">Épique</Badge>
            <Badge tone="success">Légendaire</Badge>
            <Badge tone="danger">Signalé</Badge>
          </div>
        </Section>

        <Section title="Cartes">
          <div className="space-y-3">
            <Card accent>
              <CardTitle>Défi du jour</CardTitle>
              <CardBody>5 km en course à pied avant minuit.</CardBody>
            </Card>
            <Card>
              <CardTitle>Ma progression</CardTitle>
              <CardBody>12 défis réussis · 18 cartes gagnées</CardBody>
            </Card>
          </div>
        </Section>

        <Section title="Messages">
          <div className="space-y-3">
            <Alert tone="info">
              Votre compte Strava est connecté depuis le 3 août.
            </Alert>
            <Alert tone="success" title="Défi validé">
              Vous avez gagné une carte.
            </Alert>
            <Alert tone="warning" title="Installez l’application">
              Sur iPhone, les notifications nécessitent d’ajouter le site à
              l’écran d’accueil.
            </Alert>
            <Alert tone="danger">
              La connexion à Strava a expiré. Reconnectez votre compte.
            </Alert>
          </div>
        </Section>

        <Section title="Chargement">
          <Spinner />
        </Section>
      </main>

      <SiteFooter />
    </>
  );
}
