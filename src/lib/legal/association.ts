/**
 * Who publishes this site, and who answers for it.
 *
 * **One place, because these facts appear on three legal pages at once.** A
 * registered address retyped on each of them is an address that will be
 * corrected on two the day the association moves. Same arrangement as
 * `notices.ts`, and `tests/unit/legal.test.ts` checks that the pages that must
 * carry them actually do.
 *
 * Everything here is a **legal publication obligation**, not a courtesy:
 * article 6 III of the LCEN requires a site to name its publisher, its
 * registered office and the person responsible for publication, and the GDPR
 * requires the data controller to be identifiable. A visitor who cannot tell
 * who is collecting their money has no way to complain to anybody.
 *
 * Supplied by the Product Owner on 11 August 2026. Nothing here is inferred:
 * an invented-but-plausible legal detail is worse than a visible blank,
 * because nobody ever notices it is wrong.
 */

export const ASSOCIATION = {
  name: "RéACTION",
  legalForm: "association loi 1901",
  /** Registre national des associations. */
  rnaNumber: "W323005046",
  address: {
    street: "lieu-dit la Barrère",
    postalCode: "32350",
    city: "Barran",
    country: "France",
  },
  email: "asso.reaction@gmail.com",
} as const;

/**
 * The association's officers.
 *
 * **The président is the director of publication** — for an association, that
 * role falls to its legal representative unless the board designates somebody
 * else. The trésorier is not a legal requirement on a legal notice; he is
 * named because this site collects money, and a collection whose treasurer is
 * anonymous asks for a trust it does not offer.
 */
export const OFFICERS = {
  president: "Mickael Hartman",
  treasurer: "Henri Desmist",
} as const;

/**
 * Who to write to about the game itself.
 *
 * Distinct from the association's address on purpose: a question about a
 * challenge that did not validate and a request to exercise a GDPR right do
 * not go to the same person, and sending both to one inbox means one of them
 * waits.
 */
export const PROJECT_CONTACT = {
  name: "Sylvain Tournay",
  email: "defimovember@gmail.com",
} as const;

/**
 * Where the site runs.
 *
 * The LCEN asks for the host to be named. The database sits with a different
 * provider from the application, and both are stated because "hébergé en
 * Europe" is a claim a reader cannot check.
 */
export const HOSTING = {
  application: {
    provider: "Hostinger",
    region: "Union européenne",
  },
  database: {
    provider: "Supabase",
    region: "Paris, Union européenne",
  },
} as const;

/** The registered office on one line, for prose and for the export header. */
export function registeredAddress(): string {
  const { street, postalCode, city } = ASSOCIATION.address;
  return `${street}, ${postalCode} ${city}`;
}

/** How the association names itself in a sentence. */
export function associationLabel(): string {
  return `${ASSOCIATION.name}, ${ASSOCIATION.legalForm}`;
}
