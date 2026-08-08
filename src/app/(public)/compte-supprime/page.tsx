import Link from "next/link";

import { LegalPage } from "@/components/marketing/legal-page";

export const metadata = {
  title: "Compte supprimé — DEFI Movember",
  robots: { index: false, follow: false },
};

/**
 * Where an erasure lands (story 11.2).
 *
 * A public page, and it has to be: by the time it is displayed there is no
 * session left to protect it with. Not indexed, because it is an outcome, not
 * a destination.
 *
 * It says what happened rather than thanking them for their visit. Somebody
 * who has just erased a month of sport wants confirmation that it is really
 * done — and to know that the accounting line they will see on their bank
 * statement is not a mistake.
 */
export default function AccountDeletedPage() {
  return (
    <LegalPage title="Votre compte est supprimé" updatedOn="2026-08-08">
      <p>
        C’est fait. Votre profil, vos activités sportives, vos défis, vos cartes
        et votre adresse ont été supprimés, et votre autorisation Strava a été
        retirée chez Strava.
      </p>

      <h2>Ce qui subsiste</h2>
      <p>
        Les lignes comptables de vos paiements — le montant et la date. La loi
        impose à l’association de les conserver pour justifier son don à la
        fondation. <strong>Le lien vers votre personne est rompu</strong> : ces
        lignes ne vous désignent plus.
      </p>
      <p>
        Si un paiement apparaît encore sur votre relevé bancaire, ce n’est pas
        une erreur : l’effacement d’un compte n’est pas un remboursement.
      </p>

      <h2>Et si vous revenez</h2>
      <p>
        Rien ne vous en empêche : vous pouvez créer un nouveau compte avec la
        même adresse e-mail. Il repartira de zéro — nous n’avons plus rien pour
        faire le lien avec l’ancien, et c’est exactement ce que vous avez
        demandé.
      </p>

      <p>
        <Link href="/">Retour à l’accueil</Link>
      </p>
    </LegalPage>
  );
}
