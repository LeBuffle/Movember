/**
 * The rules, in three steps.
 *
 * The visitor arrives from a share and gives this page under a minute. What
 * has to land in that time is that the effort is small, that it is measured
 * automatically, and that there is something to collect. Everything else can
 * wait for the sign-up flow.
 *
 * An ordered list rather than three boxes: the steps happen in that order,
 * and a screen reader should say so.
 */
const STEPS = [
  {
    title: "Reliez votre compte Strava",
    body: "Vos activités remontent toutes seules. Rien à saisir à la main, jamais.",
  },
  {
    title: "Relevez le défi du jour",
    body: "Un défi par jour, différent pour chaque participant : course, vélo, natation, renforcement. Plus ou moins long, plus ou moins dur. Rien n’oblige à finir celui de la veille pour attaquer le suivant.",
  },
  {
    title: "Collectionnez les cartes",
    body: "Une carte offerte chaque jour par tirage au sort, et une pour chaque défi réussi. Moustache fine, touffue, cow-boy, moustache d’or — il y en a beaucoup à trouver.",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="regle-du-jeu">
      <h2 id="regle-du-jeu" className="text-ink text-2xl font-bold sm:text-3xl">
        Comment ça marche
      </h2>

      <ol className="mt-6 space-y-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="bg-brand-blue-soft text-brand-blue flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="text-ink font-semibold">{step.title}</h3>
              <p className="text-ink-muted mt-1">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
