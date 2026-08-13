import { LegalPage } from "@/components/marketing/legal-page";
import {
  ASSOCIATION,
  HOSTING,
  OFFICERS,
  PROJECT_CONTACT,
  PUBLICATION_DIRECTOR,
  registeredAddress,
} from "@/lib/legal/association";
import { INDEPENDENCE_NOTICE } from "@/lib/legal/notices";

export const metadata = {
  title: "Mentions légales — DEFI Movember",
};

/**
 * Who publishes this site — an obligation, not a formality.
 *
 * Article 6 III of the LCEN requires a site to name its publisher, its
 * registered office and the person responsible for publication. On a site
 * that collects money the point is plainer still: a visitor who cannot tell
 * who is taking their payment has nobody to complain to.
 *
 * Every fact comes from `lib/legal/association.ts` rather than being typed
 * here — the same details appear on the privacy policy and in the accounting
 * export, and an address retyped in three places is an address that will be
 * corrected in two.
 *
 * **One blank remains, and it is deliberate**: the host's postal address and
 * telephone, which the LCEN also asks for. They are on Hostinger's own legal
 * page; inventing a plausible-looking one would be worse than showing the gap,
 * because nobody would ever notice it was wrong.
 */
const TO_BE_PROVIDED = "à compléter";

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales" updatedOn="2026-08-11">
      <h2>Éditeur du site</h2>
      <ul>
        <li>Dénomination : {ASSOCIATION.name}</li>
        <li>Forme juridique : {ASSOCIATION.legalForm}</li>
        <li>Siège social : {registeredAddress()}</li>
        <li>Numéro RNA : {ASSOCIATION.rnaNumber}</li>
        <li>Président : {OFFICERS.president}</li>
        <li>Directeur de la publication : {PUBLICATION_DIRECTOR}</li>
        <li>Trésorier : {OFFICERS.treasurer}</li>
        <li>
          Contact de l’association :{" "}
          <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>
        </li>
      </ul>

      <h2>Contact pour le DEFI Movember</h2>
      <p>
        Pour toute question sur le jeu, une inscription ou un défi :{" "}
        {PROJECT_CONTACT.name},{" "}
        <a href={`mailto:${PROJECT_CONTACT.email}`}>{PROJECT_CONTACT.email}</a>.
      </p>
      <p>
        Les demandes qui engagent l’association — remboursement, exercice de vos
        droits sur vos données, réclamation — sont à adresser à{" "}
        <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>.
      </p>

      <h2>Hébergement</h2>
      <ul>
        <li>
          Application : {HOSTING.application.provider}, serveur situé en{" "}
          {HOSTING.application.region}. Adresse postale et téléphone de
          l’hébergeur : {TO_BE_PROVIDED}.
        </li>
        <li>
          Base de données : {HOSTING.database.provider}, région{" "}
          {HOSTING.database.region}.
        </li>
      </ul>

      <h2>Indépendance</h2>
      <p>{INDEPENDENCE_NOTICE}</p>
      <p>
        L’association organise ce défi au profit de la fondation Movember, avec
        son accord, et lui reverse les sommes collectées. Elle n’en est ni une
        antenne ni une représentation, et n’utilise ni sa marque ni son
        imagerie.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le logo, les visuels des cartes et l’identité graphique du site sont
        propres à ce projet et appartiennent à l’association {ASSOCIATION.name}.
      </p>
    </LegalPage>
  );
}
