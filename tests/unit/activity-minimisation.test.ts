import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parisDate } from "@/lib/activities/activity";
import { stravaSource } from "@/lib/activities/sources/strava";

const root = path.resolve(import.meta.dirname, "../..");

/** Comments quote the very terms these tests forbid — they explain why. */
function code(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/* =========================================================================
 * Une donnée absente ne fuite pas
 *
 * C'est l'argument entier de la décision D9. Le tracé et la fréquence
 * cardiaque sont ce que Strava expose de plus sensible — la localisation du
 * domicile et des données de santé — et aucun défi du PRD n'en a besoin.
 *
 * Une règle écrite dans un document se contourne sans le vouloir le jour où
 * quelqu'un ajoute un champ « pour plus tard ». Ce fichier, non : il fait
 * échouer la construction. C'est un critère de sortie de l'epic 3.
 * ====================================================================== */

/**
 * Ce qui ne doit exister nulle part.
 *
 * Écrit en minuscules et sans séparateur pour attraper les deux graphies :
 * `heart_rate` comme `heartrate`, `startLatlng` comme `start_latlng`.
 */
const FORBIDDEN = [
  "polyline",
  "startlatlng",
  "endlatlng",
  "startlatitude",
  "startlongitude",
  "latitude",
  "longitude",
  "heartrate",
  "watts",
  "cadence",
  "temp",
  "altitude",
  "elevhigh",
  "elevlow",
  "gpx",
  "streams",
];

/** `start_lat_lng` et `startLatLng` deviennent tous deux `startlatlng`. */
function flatten(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

/** Une charge Strava réaliste, avec tout ce qu'elle contient vraiment. */
const STRAVA_PAYLOAD = {
  id: 987654321,
  name: "Sortie du matin",
  distance: 10432.7,
  moving_time: 3120,
  elapsed_time: 3480,
  total_elevation_gain: 143.2,
  type: "Run",
  sport_type: "TrailRun",
  start_date: "2026-11-15T06:12:00Z",
  start_date_local: "2026-11-15T07:12:00Z",
  timezone: "(GMT+01:00) Europe/Paris",
  manual: false,
  // Tout ce qui suit doit disparaître à la frontière.
  start_latlng: [48.8566, 2.3522],
  end_latlng: [48.857, 2.353],
  map: {
    id: "a987654321",
    polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
    summary_polyline: "_p~iF~ps|U_ulLnnqC",
  },
  average_heartrate: 152.4,
  max_heartrate: 178,
  average_watts: 241,
  average_cadence: 84.2,
  elev_high: 312.4,
  elev_low: 118.9,
  average_temp: 12,
};

/** Toutes les clés et toutes les chaînes, à n'importe quelle profondeur. */
function everything(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) everything(item, found);
    return found;
  }

  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      found.push(key);
      everything(inner, found);
    }
    return found;
  }

  if (typeof value === "string") found.push(value);

  return found;
}

describe("le format interne, après normalisation", () => {
  const activity = stravaSource.normalise(STRAVA_PAYLOAD, "profil-1");

  it("ne porte aucun champ interdit, à aucune profondeur", () => {
    expect(activity).not.toBe(null);

    const seen = everything(activity).map(flatten);

    for (const forbidden of FORBIDDEN) {
      for (const value of seen) {
        expect(value).not.toContain(forbidden);
      }
    }
  });

  it("ne garde que ce dont le jeu a besoin", () => {
    // Une liste close plutôt qu'une liste d'interdits : un champ ajouté par
    // Strava demain ne peut pas se glisser dedans par omission.
    expect(Object.keys(activity!).sort()).toEqual([
      "distanceMeters",
      "durationSeconds",
      "elevationMeters",
      "id",
      "isManual",
      "localDate",
      "name",
      "profileId",
      "provider",
      "sportFamily",
      "startedAt",
    ]);
  });

  it("ne laisse pas passer le tracé par le nom de la sortie", () => {
    // Le nom est du texte libre : c'est le seul champ conservé où un tracé
    // pourrait voyager si on le recopiait sans réfléchir.
    expect(activity!.name).toBe("Sortie du matin");
  });
});

describe("le schéma, dans toutes les migrations", () => {
  const folder = path.join(root, "supabase/migrations");

  const sql = readdirSync(folder)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(path.join(folder, file), "utf8"))
    // Les commentaires nomment précisément ce qu'ils interdisent.
    .map((content) =>
      content.replace(/--.*$/gm, "").replace(/comment on[\s\S]*?;/gi, ""),
    )
    .join("\n");

  it("ne crée aucune colonne interdite, dans aucun fichier", () => {
    // Sur TOUTES les migrations, pas seulement celles de l'epic 3 : une
    // colonne ajoutée au lot 5 ou au lot 9 tomberait sous la même règle.
    const flat = flatten(sql);

    for (const forbidden of FORBIDDEN) {
      expect(flat).not.toContain(forbidden);
    }
  });
});

describe("le jour calendaire", () => {
  it("est calculé à Paris, pas dans le fuseau du serveur", () => {
    // Une sortie qui démarre à 23h40 heure de Paris appartient à ce jour-là.
    // Prise en UTC, elle basculerait au lendemain — et validerait le défi du
    // lundi avec une sortie du dimanche soir.
    expect(parisDate("2026-11-15T22:40:00Z")).toBe("2026-11-15");
    expect(parisDate("2026-11-15T23:40:00Z")).toBe("2026-11-16");
  });

  it("suit le changement d’heure", () => {
    // Fin octobre, la France passe de +2 à +1. Une date figée se tromperait
    // d'un jour une nuit par an — la nuit où personne ne regarde.
    expect(parisDate("2026-07-15T22:30:00Z")).toBe("2026-07-16");
    expect(parisDate("2026-12-15T22:30:00Z")).toBe("2026-12-15");
  });

  it("refuse une date illisible plutôt que d’en inventer une", () => {
    expect(parisDate("pas une date")).toBe("");
  });

  it("est celui que la normalisation retient", () => {
    // La charge d'essai démarre à 06h12 UTC, soit 07h12 à Paris.
    expect(stravaSource.normalise(STRAVA_PAYLOAD, "p")!.localDate).toBe(
      "2026-11-15",
    );
  });

  it("vient de l’instant absolu, pas de l’heure locale de l’athlète", () => {
    // `start_date_local` dérive du calendrier du jeu dès que quelqu'un voyage.
    expect(code("src/lib/activities/sources/strava.ts")).toMatch(
      /const started = source\.start_date;/,
    );
  });
});

describe("les unités et le vocabulaire", () => {
  it("sont converties une seule fois, à la frontière", () => {
    const activity = stravaSource.normalise(STRAVA_PAYLOAD, "p")!;

    // Mètres et secondes, entiers. 10432,7 m devient 10433.
    expect(activity.distanceMeters).toBe(10433);
    expect(activity.durationSeconds).toBe(3120);
    expect(activity.elevationMeters).toBe(143);
  });

  it("comptent le temps en mouvement, pas le temps écoulé", () => {
    // Un défi de trente minutes d'effort ne doit pas se régler par une pause
    // café de six minutes incluse dans le total.
    expect(stravaSource.normalise(STRAVA_PAYLOAD, "p")!.durationSeconds).toBe(
      3120,
    );
  });

  it("réduisent le sport aux familles du catalogue", () => {
    // Un auteur de défi n'a pas à choisir entre `Run`, `TrailRun` et
    // `VirtualRun`.
    expect(stravaSource.normalise(STRAVA_PAYLOAD, "p")!.sportFamily).toBe(
      "run",
    );
  });

  it("gardent un type inconnu plutôt que de perdre l’activité", () => {
    // Perdre silencieusement une sortie est pire que la compter dans un défi
    // tous sports : le participant a fait l'effort.
    const exotic = stravaSource.normalise(
      { ...STRAVA_PAYLOAD, sport_type: "Kitesurf", type: "Kitesurf" },
      "p",
    );

    expect(exotic).not.toBe(null);
    expect(exotic!.sportFamily).toBe("any");
  });

  it("retiennent qu’une sortie a été saisie à la main", () => {
    // Rien ne filtre dessus aujourd'hui (story 9.8), mais un indicateur non
    // capturé à la frontière ne se rattrape pas sans redemander à Strava
    // toutes les activités de tout le monde.
    const manual = stravaSource.normalise(
      { ...STRAVA_PAYLOAD, manual: true },
      "p",
    );

    expect(manual!.isManual).toBe(true);
    expect(stravaSource.normalise(STRAVA_PAYLOAD, "p")!.isManual).toBe(false);
  });

  it("écartent une charge inexploitable sans emporter le lot", () => {
    expect(stravaSource.normalise({ name: "sans identifiant" }, "p")).toBe(
      null,
    );
    expect(stravaSource.normalise({ id: 1, start_date: "hier" }, "p")).toBe(
      null,
    );
  });
});

describe("une activité corrigée ou supprimée chez le fournisseur", () => {
  const store = code("src/lib/activities/store.ts");

  it("est répercutée", () => {
    expect(store).toMatch(/export async function updateActivity/);
    expect(store).toMatch(/export async function removeActivity/);
  });

  it("est réévaluée après correction", () => {
    // Une distance corrigée vers le haut peut valider un défi qu'elle ne
    // validait pas.
    const update = store.slice(
      store.indexOf("export async function updateActivity"),
    );

    expect(update).toMatch(/applyActivity\(activity\)/);
  });

  it("est enregistrée si on ne l’avait pas encore", () => {
    // Une correction peut arriver pour une sortie antérieure à la liaison.
    expect(store).toMatch(/recordActivities\(\[activity\]\)/);
  });

  it("ne déclasse jamais un défi déjà réussi", () => {
    // Reprendre des points automatiquement, sur un classement, à cause d'un
    // chiffre que quelqu'un a modifié, c'est exactement ce qui fait paraître
    // un jeu arbitraire. C'est la story 4.10 qui le fait, avec un motif.
    const remove = store.slice(
      store.indexOf("export async function removeActivity"),
    );

    expect(remove).not.toMatch(/challenge_assignments/);
    expect(remove).toMatch(/console\.info/);
  });
});
