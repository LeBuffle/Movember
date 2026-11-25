import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  simulatedActivities,
  simulatedSource,
} from "@/lib/activities/simulated";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const migration = readFileSync(
  path.join(root, "supabase/migrations/20260805160000_activities.sql"),
  "utf8",
)
  .replace(/--.*$/gm, "")
  // `comment on ... is '…'` names the very fields the first test forbids, in
  // order to say they are absent. Stripped like any other comment: what is
  // being checked is the schema, not the prose about it.
  .replace(/comment on[\s\S]*?;/gi, "");

/* =========================================================================
 * La couche qui rend le reste possible sans Strava
 *
 * Les deux risques de l'epic 3 — le quota d'athlètes, la conformité de
 * l'usage — sont externes. Cette couche est la seule réponse de découpage :
 * elle a permis de construire tout l'epic 4 sans un seul compte Strava.
 * ====================================================================== */

describe("le format interne des activités", () => {
  it("n’a ni tracé, ni fréquence cardiaque, ni puissance, ni cadence", () => {
    // Architecture D9. Une donnée absente ne fuite pas — et aucun défi du
    // PRD n'a besoin de celles-là.
    for (const forbidden of [
      "polyline",
      "start_lat",
      "end_lat",
      "heartrate",
      "heart_rate",
      "watts",
      "cadence",
      "altitude",
      "gps",
    ]) {
      expect(migration.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("garde le jour calendaire au lieu de le recalculer", () => {
    // Une sortie de 23h40 appartient à ce jour-là, quel que soit le fuseau du
    // serveur. Le déduire plus tard, sur une machine en UTC, est exactement
    // ce qui fait valider le défi du lundi par une sortie du dimanche soir.
    expect(migration).toMatch(/local_date date not null/);
  });

  it("refuse deux fois la même activité, et c’est la base qui refuse", () => {
    // Un webhook rejoué, un rattrapage qui repasse, un import initial qui
    // recouvre les deux : les trois arriveront.
    expect(migration).toMatch(
      /unique index activities_one_per_provider_activity[\s\S]*?\(provider, provider_activity_id\)/,
    );
  });

  it("stocke des mètres et des secondes, jamais des unités de fournisseur", () => {
    expect(migration).toMatch(/distance_meters integer/);
    expect(migration).toMatch(/duration_seconds integer/);
    expect(migration).toMatch(/elevation_meters integer/);
  });

  it("protège la table et n’ouvre aucune écriture", () => {
    expect(migration).toMatch(
      /alter table public\.activities enable row level security/,
    );
    expect(migration).not.toMatch(/for (insert|update|delete)/i);
  });

  it("laisse chacun lire les siennes, et personne celles d’un autre", () => {
    expect(migration).toMatch(
      /participants read their own activities[\s\S]*?auth\.uid\(\)\) = profile_id/,
    );
  });
});

describe("l’interface de source", () => {
  it("expose les quatre opérations de la décision D3", () => {
    const source = code("src/lib/activities/source.ts");

    for (const operation of [
      "authorizationUrl",
      "exchangeCode",
      "refresh",
      "normalise",
    ]) {
      expect(source).toContain(operation);
    }
  });

  it("laisse une source répondre « je ne sais pas faire » sans lever", () => {
    // Une interface dont une implémentation lève sur trois méthodes sur
    // quatre n'est pas une interface. Le refus est une réponse typée.
    expect(
      simulatedSource.authorizationUrl("etat", "https://exemple.fr"),
    ).toEqual({ ok: false, reason: "unsupported" });
  });

  it("refuse aussi l’échange et le rafraîchissement", async () => {
    expect(
      await simulatedSource.exchangeCode("code", "https://exemple.fr"),
    ).toEqual({ ok: false, reason: "unsupported" });
    expect(await simulatedSource.refresh("jeton")).toEqual({
      ok: false,
      reason: "unsupported",
    });
  });
});

describe("la source simulée", () => {
  it("normalise une activité en lui donnant le participant", () => {
    const [sample] = simulatedActivities("2026-11-15");
    const activity = simulatedSource.normalise(sample, "profil-7");

    expect(activity?.profileId).toBe("profil-7");
    expect(activity?.provider).toBe("simulated");
  });

  it("écarte ce qu’elle ne comprend pas, sans emporter le lot", () => {
    // Une activité illisible dans un lot de deux cents ne doit pas faire
    // tomber les cent quatre-vingt-dix-neuf autres.
    expect(simulatedSource.normalise(null, "profil-7")).toBe(null);
    expect(simulatedSource.normalise({ id: 42 }, "profil-7")).toBe(null);
    expect(simulatedSource.normalise("une sortie", "profil-7")).toBe(null);
  });

  it("couvre les cas qui décident d’un évaluateur", () => {
    const ids = simulatedActivities("2026-11-15").map((a) => a.id);

    // Sur le seuil, un mètre en dessous, la veille, le lendemain, un sport
    // sans distance : ce sont ces cinq-là qui font qu'un évaluateur est
    // juste plutôt qu'à peu près juste.
    expect(ids).toContain("sim-run-5k");
    expect(ids).toContain("sim-run-just-short");
    expect(ids).toContain("sim-run-yesterday");
    expect(ids).toContain("sim-run-tomorrow");
    expect(ids).toContain("sim-strength");
  });

  it("ne dépend ni de l’horloge ni du hasard", () => {
    const fixtures = code("src/lib/activities/simulated.ts");

    expect(fixtures).not.toMatch(/Math\.random|Date\.now\(\)|new Date\(\)/);
  });
});

describe("l’entrée des activités dans le jeu", () => {
  const store = code("src/lib/activities/store.ts");

  it("est la seule porte, et elle passe par la clé de service", () => {
    // `activities` n'a de politique d'écriture pour personne : quelqu'un qui
    // pourrait insérer s'offrirait une sortie de 40 km et le mois entier.
    expect(store).toMatch(/createAdminClient/);
  });

  it("traite un doublon comme un succès", () => {
    expect(store).toMatch(/error\.code === "23505"/);
  });

  it("évalue les défis dans la foulée", () => {
    // Une activité stockée mais jamais évaluée est un défi silencieusement
    // non validé — invisible jusqu'à ce que quelqu'un écrive.
    expect(store).toMatch(/applyActivity/);
  });

  it("n’évalue que ce qui vient d’être ajouté", () => {
    // Sinon un rattrapage horaire relirait tous les défis ouverts pour
    // chaque activité déjà vue.
    expect(store).toMatch(/if \(outcome === "duplicate"\) continue/);
  });

  it("ne perd pas un lot pour une activité malformée", () => {
    expect(store).toMatch(/report\.failed \+= 1/);
    expect(store).not.toMatch(/throw /);
  });
});

describe("l’injection des activités simulées", () => {
  const actions = code("src/lib/activities/actions.ts");

  it("est impossible en production", () => {
    expect(code("src/lib/activities/simulation.ts")).toMatch(
      /APP_ENVIRONMENT !== "production"/,
    );
    expect(actions).toMatch(/if \(!SIMULATION_ALLOWED\)/);
  });

  it("n’apparaît même pas à l’écran en production", () => {
    // Absente plutôt que grisée : un bouton grisé invite à chercher comment
    // le dégriser.
    expect(code("src/app/(admin)/admin/defis/attribution/page.tsx")).toMatch(
      /\{SIMULATION_ALLOWED && \(/,
    );
  });

  it("vérifie le rôle avant tout", () => {
    // Mesuré sur le corps de la fonction, pas sur les imports du haut.
    const body = actions.slice(
      actions.indexOf("export async function injectSimulatedActivities"),
    );

    expect(body.indexOf("requireAdmin()")).toBeLessThan(
      body.indexOf("recordActivities("),
    );
  });

  it("passe par la source, pas directement par les données d’essai", () => {
    // C'est le chemin que Strava prendra : le jour où il casse, il casse
    // ici d'abord.
    expect(actions).toMatch(/simulatedSource\.normalise/);
  });

  it("journalise l’injection", () => {
    expect(actions).toContain("activities.simulated");
  });
});
