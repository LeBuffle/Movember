import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChallengePreview } from "@/components/admin/challenge-preview";

/* =========================================================================
 * L'aperçu, réellement rendu
 *
 * Le reste des tests vérifie la phrase produite par `describeChallenge`.
 * Ici on rend le composant pour de vrai, parce qu'une phrase juste qui
 * n'arrive pas à l'écran ne protège de rien — et c'est cet écran qui attrape
 * le seuil saisi en mètres au lieu de kilomètres.
 * ====================================================================== */

const base = {
  title: "5 km avant le café",
  description: "Une petite mise en jambes.",
  points: "20",
  difficulty: "moyen",
  conditions: [],
};

describe("l’aperçu du défi", () => {
  it("affiche ce que le participant lira", () => {
    const html = renderToStaticMarkup(
      <ChallengePreview
        {...base}
        evaluator="distance"
        values={{ min_distance_meters: "5", sport_types: ["run"] }}
      />,
    );

    expect(html).toContain("5 km avant le café");
    expect(html).toContain("Parcourir 5 km");
    expect(html).toContain("course à pied");
    expect(html).toContain("20 points");
    expect(html).toContain("Moyen");
  });

  it("montre la saisie en mètres pour ce qu’elle est", () => {
    // Le cas que rien d'autre ne peut attraper : 5 tapé en pensant
    // kilomètres, dans une unité qui compte les mètres. L'aperçu écrit
    // « 5 m » et l'auteur voit que ce n'est pas ce qu'il voulait.
    const html = renderToStaticMarkup(
      <ChallengePreview
        {...base}
        evaluator="elevation"
        values={{ min_elevation_meters: "5", sport_types: ["bike"] }}
      />,
    );

    expect(html).toContain("Cumuler 5 m");
  });

  it("ne montre rien tant que les réglages ne sont pas valides", () => {
    // Un aperçu qui devine serait cru sur parole.
    const html = renderToStaticMarkup(
      <ChallengePreview
        {...base}
        evaluator="distance"
        values={{ sport_types: [] }}
      />,
    );

    expect(html).toContain("l’aperçu s’affichera");
    expect(html).not.toContain("Parcourir");
  });

  it("tient debout sans titre", () => {
    // On ouvre le formulaire vide : l'aperçu doit exister avant la première
    // frappe, sinon il apparaît d'un coup et on ne pense pas à le lire.
    const html = renderToStaticMarkup(
      <ChallengePreview
        {...base}
        title=""
        description=""
        evaluator="distance"
        values={{}}
      />,
    );

    expect(html).toContain("Titre du défi");
  });
});
