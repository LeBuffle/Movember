import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { INSTALL_GUIDES, installGuide } from "@/lib/pwa/install-steps";
import { detectPlatform, PLATFORMS } from "@/lib/pwa/platform";

/* =========================================================================
 * Le parcours d'installation (story 6.2)
 *
 * Le plus grand risque non technique du projet. Sur iPhone, aucune
 * notification web n'existe hors application installée : un participant qui
 * n'installe pas n'entend jamais parler de son défi du jour, et c'est le défi
 * du jour qui le fait revenir.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const guideComponent = code(read("src/components/pwa/install-guide.tsx"));
const reminder = code(read("src/components/pwa/install-reminder.tsx"));
const page = code(read("src/app/(participant)/installer/page.tsx"));
const payment = code(
  read("src/app/(participant)/participer/[niveau]/paiement/page.tsx"),
);
const game = code(read("src/app/(participant)/jeu/page.tsx"));

describe("la détection de l'appareil", () => {
  it("reconnaît un iPhone", () => {
    expect(
      detectPlatform({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      }),
    ).toBe("ios");
  });

  it("reconnaît un iPad qui se déclare iPad", () => {
    expect(
      detectPlatform({ userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac)" }),
    ).toBe("ios");
  });

  it("reconnaît un iPad qui se fait passer pour un Mac", () => {
    // iPadOS 13+ annonce « Macintosh ». S'y tromper envoie son propriétaire
    // chercher une icône dans la barre d'adresse qui n'existe pas — sur la
    // seule plateforme où l'installation est obligatoire.
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
  });

  it("ne prend pas un vrai Mac pour un iPad", () => {
    expect(
      detectPlatform({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 0,
      }),
    ).toBe("desktop");
  });

  it("reconnaît Android", () => {
    expect(
      detectPlatform({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)" }),
    ).toBe("android");
  });

  it("retombe sur l'ordinateur plutôt que d'échouer", () => {
    expect(detectPlatform({})).toBe("desktop");
    expect(detectPlatform({ userAgent: "" })).toBe("desktop");
  });
});

describe("les instructions", () => {
  it("existent pour les trois familles d'appareils", () => {
    // AC 1.
    for (const platform of PLATFORMS) {
      expect(installGuide(platform).steps.length).toBeGreaterThan(0);
    }
  });

  it("disent sur iPhone que rien n'arrivera sans installation", () => {
    // AC 2. C'est une limite d'iOS, et rien ne la contourne.
    const ios = INSTALL_GUIDES.ios;

    expect(ios.mandatoryForPush).toBe(true);
    expect(ios.stake).toMatch(/notification/i);
    expect(ios.steps.join(" ")).toMatch(/écran d’accueil/);
    expect(ios.steps.join(" ")).toMatch(/Safari/);
  });

  it("ne le prétendent pas ailleurs", () => {
    // Une instruction fausse est ignorée en bloc, y compris les vraies qui
    // l'accompagnent.
    expect(INSTALL_GUIDES.android.mandatoryForPush).toBe(false);
    expect(INSTALL_GUIDES.desktop.mandatoryForPush).toBe(false);
  });
});

describe("une détection ratée n'est pas un cul-de-sac", () => {
  it("les trois appareils restent atteignables", () => {
    // AC 6. Le user-agent se réécrit librement : la détection choisit
    // l'onglet ouvert, elle ne ferme jamais les autres.
    expect(guideComponent).toMatch(/role="tablist"/);
    expect(guideComponent).toMatch(/PLATFORMS\.map/);
    expect(guideComponent).toMatch(
      /onClick=\{\(\) => setPlatform\(candidate\)\}/,
    );
  });
});

describe("une application déjà installée ne se voit rien proposer", () => {
  it("le guide le dit et s'arrête là", () => {
    // AC 5. Des instructions pour ce qui est déjà fait se lisent comme une
    // application qui ignore son propre état.
    expect(guideComponent).toMatch(/displayMode === "installed"/);
    expect(guideComponent).toMatch(/L’application est installée/);
  });

  it("le rappel ne s'affiche pas non plus", () => {
    expect(reminder).toMatch(/if \(mode !== "browser"\) return null/);
  });

  it("et rien ne clignote pendant la détection", () => {
    // Une bannière qui apparaît une image puis disparaît est pire que pas de
    // bannière.
    expect(guideComponent).toMatch(
      /displayMode === null \|\| platform === null/,
    );
  });
});

describe("l'installation est une étape du parcours", () => {
  it("elle apparaît à la confirmation de l'inscription", () => {
    // AC 3 : une étape, pas une suggestion faite en passant.
    expect(payment).toMatch(/InstallGuide/);
    expect(payment).toMatch(/Dernière étape/);
    expect(payment).toMatch(/\{isActive && \(/);
  });

  it("elle peut être sautée par un lien ordinaire", () => {
    // AC 4. Quelqu'un qui s'inscrit depuis un ordinateur prêté ne peut pas
    // suivre ces étapes maintenant ; le bloquer coûterait une inscription
    // pour sauver une notification.
    expect(payment).toMatch(/Plus tard/);
    expect(page).toMatch(/Plus tard/);
  });

  it("et le rappel revient sur l'écran ouvert chaque matin", () => {
    expect(game).toMatch(/InstallReminder/);
    expect(reminder).toMatch(/\/installer/);
  });
});

describe("l'invite native est utilisée sans être exigée", () => {
  it("elle est retenue plutôt que laissée passer", () => {
    // La bannière de Chrome s'affiche où elle décide, rarement là où le
    // participant lit les étapes.
    expect(guideComponent).toMatch(/beforeinstallprompt/);
    expect(guideComponent).toMatch(/event\.preventDefault\(\)/);
  });

  it("les étapes écrites tiennent debout sans elle", () => {
    // L'événement arrive quand il veut, et parfois jamais.
    expect(guideComponent).toMatch(/\{prompt && platform !== "ios" &&/);
    expect(guideComponent).toMatch(/guide\.steps\.map/);
  });

  it("elle n'est jamais proposée sur iPhone, qui ne la connaît pas", () => {
    expect(guideComponent).toMatch(/platform !== "ios"/);
  });
});
