import type { Platform } from "@/lib/pwa/platform";

/**
 * How to add the application to a home screen, per platform.
 *
 * Kept as data rather than as three blocks of markup, for two reasons. The
 * wording is the part that will be corrected after the first participant
 * fails to follow it, and it should be correctable in one file. And the
 * instructions have to be readable **on the device being described**, which
 * means somebody will read them from a phone while trying to find a button —
 * so they are short, numbered, and name what is on screen rather than
 * describe it.
 *
 * **The consequence is stated per platform, not once at the top.** On iPhone
 * there are no notifications at all without this; on Android it is a
 * convenience. Telling an Android user their notifications depend on it would
 * be false, and false instructions are ignored wholesale.
 */

export type InstallGuide = {
  platform: Platform;
  title: string;
  /** Why it matters *on this device*. */
  stake: string;
  steps: string[];
  /** Shown under the steps when there is a caveat worth pre-empting. */
  note?: string;
  /** Whether notifications are impossible without installing. */
  mandatoryForPush: boolean;
};

export const INSTALL_GUIDES: Record<Platform, InstallGuide> = {
  ios: {
    platform: "ios",
    title: "Sur iPhone ou iPad",
    stake:
      "Sans cette étape, votre iPhone ne peut recevoir aucune notification du jeu. Ce n’est pas un réglage de notre application : c’est une limite d’iOS, et rien ne la contourne.",
    steps: [
      "Ouvrez cette page dans Safari. Les autres navigateurs de l’iPhone ne savent pas installer.",
      "Touchez le bouton Partager, en bas de l’écran : un carré avec une flèche vers le haut.",
      "Faites défiler la liste et touchez « Sur l’écran d’accueil ».",
      "Touchez « Ajouter », en haut à droite.",
      "Fermez Safari et ouvrez DEFI Movember depuis votre écran d’accueil.",
    ],
    note: "L’icône ressemble à celle d’une application ordinaire. C’est là qu’il faudra ouvrir le jeu à partir de maintenant — depuis Safari, les notifications ne fonctionneront pas.",
    mandatoryForPush: true,
  },

  android: {
    platform: "android",
    title: "Sur Android",
    stake:
      "L’application s’ouvre alors en plein écran depuis votre écran d’accueil, comme n’importe quelle autre.",
    steps: [
      "Touchez le bouton « Installer l’application » ci-dessous s’il apparaît. Sinon, continuez.",
      "Ouvrez le menu de Chrome : les trois points, en haut à droite.",
      "Touchez « Installer l’application » ou « Ajouter à l’écran d’accueil ».",
      "Confirmez.",
    ],
    note: "Selon la version de Chrome, l’intitulé change un peu. Les deux mènent au même endroit.",
    mandatoryForPush: false,
  },

  desktop: {
    platform: "desktop",
    title: "Sur ordinateur",
    stake:
      "Utile pour suivre le jeu depuis un poste de travail. Les notifications fonctionnent aussi sans installer.",
    steps: [
      "Touchez le bouton « Installer l’application » ci-dessous s’il apparaît.",
      "Sinon, cherchez la petite icône d’installation à droite de la barre d’adresse.",
      "Confirmez.",
    ],
    note: "Le jeu se joue surtout depuis un téléphone : c’est là qu’il faut installer en priorité.",
    mandatoryForPush: false,
  },
};

export function installGuide(platform: Platform): InstallGuide {
  return INSTALL_GUIDES[platform];
}
