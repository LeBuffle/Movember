/**
 * Statements the project is legally required to make.
 *
 * They live here as constants rather than as prose scattered across pages
 * for one reason: `tests/unit/legal.test.ts` asserts their wording and
 * asserts that the pages carrying money actually display them. A sentence
 * retyped on four pages is a sentence that will be softened on one of them.
 *
 * The obligations come from `CLAUDE.md` §5 and §6 and are not editorial
 * preferences.
 */

/**
 * Which version of the terms a participant accepted.
 *
 * Stored with the acceptance, and that is the point: knowing *when* someone
 * accepted says nothing about *what*. The terms published in story 1.9 are a
 * working draft and will be rewritten before registration opens — an
 * acceptance without a version would prove nothing about either text.
 *
 * **Bump this whenever the terms change in substance.** A wording fix does
 * not count; a change to what the association owes does.
 */
export const TERMS_VERSION = "2026-08-08-brouillon";

/**
 * The tax notice.
 *
 * The sums collected are registration fees and purchases with a
 * consideration — a game, a medal, cards. They are NOT donations opening a
 * right to a tax reduction, and the association issues no receipt. Saying
 * this late, or quietly, would mean a participant discovering in April that
 * the "don" they thought they made is not deductible.
 *
 * `CLAUDE.md` §6 requires it to be stated clearly and unambiguously. Story
 * 1.9 AC 3 requires it not to be buried in a footer, and epic 2 repeats it
 * immediately before payment.
 */
export const TAX_NOTICE_TITLE = "Ce n’est pas un don défiscalisable";

export const TAX_NOTICE =
  "Votre inscription est un achat avec contrepartie : elle vous donne accès au jeu, " +
  "et selon le niveau à une médaille ou à des cartes. Ce n’est pas un don au sens " +
  "fiscal. Aucun reçu fiscal ni CERFA ne sera émis, et ces montants n’ouvrent droit " +
  "à aucune réduction d’impôt.";

/**
 * The independence notice.
 *
 * The association acts on behalf of the Movember Foundation with its
 * agreement, but is not the Foundation and uses none of its brand. No part
 * of the interface may suggest otherwise (`CLAUDE.md` §5).
 */
export const INDEPENDENCE_NOTICE =
  "Projet indépendant porté par RéACTION, association loi 1901. Ce site n’est " +
  "pas l’application officielle de la fondation Movember et n’utilise aucun de " +
  "ses logos ou visuels.";

/**
 * Marks a legal page whose text is not final.
 *
 * Provisional legal pages are worse than absent ones if nothing says they are
 * provisional: a visitor takes them at face value. They must be replaced
 * before registration opens — see the deadline in `docs/plan-demarrage-dev.md`.
 */
export const DRAFT_LEGAL_NOTICE =
  "Ce texte est un document de travail, publié pour préparer l’ouverture des " +
  "inscriptions. Il sera remplacé par sa version définitive avant tout paiement. " +
  "Il n’a pas de valeur contractuelle en l’état.";
