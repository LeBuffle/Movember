import { LegalPage } from "@/components/marketing/legal-page";
import { INDEPENDENCE_NOTICE } from "@/lib/legal/notices";

export const metadata = {
  title: "Mentions légales — DEFI Movember",
};

/**
 * Working draft.
 *
 * The blanks below are deliberate and must be filled by the Product Owner —
 * they are facts about the association that cannot be guessed: legal name,
 * registered address, RNA number, publication director, hosting provider's
 * details. Inventing plausible-looking ones would be worse than leaving them
 * visible: nobody would ever notice they were wrong.
 */
const TO_BE_PROVIDED = "à compléter";

export default function LegalNoticePage() {
  return (
    <LegalPage title="Mentions légales" updatedOn="2026-08-04">
      <h2>Éditeur du site</h2>
      <ul>
        <li>Dénomination : {TO_BE_PROVIDED}</li>
        <li>Forme juridique : association loi 1901</li>
        <li>Siège social : {TO_BE_PROVIDED}</li>
        <li>Numéro RNA : {TO_BE_PROVIDED}</li>
        <li>Directeur de la publication : {TO_BE_PROVIDED}</li>
        <li>Contact : {TO_BE_PROVIDED}</li>
      </ul>

      <h2>Hébergement</h2>
      <ul>
        <li>Site : serveur dédié, {TO_BE_PROVIDED}</li>
        <li>Base de données : Supabase, région Paris (Union européenne)</li>
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
        Les visuels des cartes et l’identité graphique du site sont propres à ce
        projet.
      </p>
    </LegalPage>
  );
}
