/**
 * The back-office map.
 *
 * One list, three consumers: the navigation, the placeholder pages, and the
 * tests. The back-office is delivered in slices across the epics — the
 * challenge catalogue with epic 4, cards with epic 5, notifications with
 * epic 6, fundraising with epic 9 — and this is what keeps the shell honest
 * in the meantime. A section that has no screen yet says so, rather than
 * being a link that goes nowhere.
 *
 * When an epic builds its real screen, it adds `admin/<slug>/page.tsx`. A
 * static route wins over the `[section]` placeholder, so nothing has to be
 * removed from here — only `status` changes.
 */

export type AdminSection = {
  slug: string;
  label: string;
  /** Said in the words a volunteer would use, not in the words of the code. */
  description: string;
  /** Which epic brings the real screen. Shown on the placeholder page. */
  epic: string;
  status: "available" | "comingSoon";
};

export const ADMIN_SECTIONS: AdminSection[] = [
  {
    slug: "defis",
    label: "Défis",
    description:
      "Le catalogue des défis : en créer, les modifier, décider lesquels tombent quel jour.",
    epic: "epic 4",
    status: "comingSoon",
  },
  {
    slug: "cartes",
    label: "Cartes",
    description:
      "Les cartes moustachues : visuels, raretés, probabilités de tirage.",
    epic: "epic 5",
    status: "comingSoon",
  },
  {
    slug: "participants",
    label: "Participants",
    description:
      "Qui est inscrit, à quel niveau, et où en est chacun dans le défi.",
    epic: "epic 8",
    status: "comingSoon",
  },
  {
    slug: "equipes",
    label: "Équipes",
    description: "Les équipes, leurs membres et le classement collectif.",
    epic: "epic 7",
    status: "comingSoon",
  },
  {
    slug: "actualites",
    label: "Fil d’actualité",
    description:
      "Les messages publiés à tous les participants pendant le mois.",
    epic: "epic 7",
    status: "comingSoon",
  },
  {
    slug: "notifications",
    label: "Notifications",
    description:
      "Les rappels quotidiens et les envois exceptionnels, push et e-mail.",
    epic: "epic 6",
    status: "comingSoon",
  },
  {
    slug: "collecte",
    label: "Collecte",
    description:
      "Les encaissements, les remboursements, le total collecté et les frais.",
    epic: "epic 9",
    status: "comingSoon",
  },
  {
    slug: "arbitrage",
    label: "Arbitrage",
    description:
      "Les activités douteuses signalées automatiquement, à valider ou à écarter.",
    epic: "epic 10",
    status: "comingSoon",
  },
];

export function findAdminSection(slug: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find((section) => section.slug === slug);
}
