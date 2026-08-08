import { LegalPage } from "@/components/marketing/legal-page";
import { TAX_NOTICE, TAX_NOTICE_TITLE } from "@/lib/legal/notices";

export const metadata = {
  title: "Conditions générales de vente — DEFI Movember",
};

/**
 * Working draft. Must be reviewed before registration opens — it is the
 * document that binds the association to every participant.
 *
 * What is already firm and must not be softened by a later rewrite: the
 * nature of the sums (registration fees and purchases with a consideration,
 * never donations), the absence of any tax receipt, and the right of
 * withdrawal, which does not apply to a service the participant asks to
 * start immediately.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Conditions générales de vente" updatedOn="2026-08-08">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent l’inscription au DEFI Movember,
        organisé par une association loi 1901 au profit de la fondation
        Movember. Elles s’appliquent à toute inscription réalisée sur ce site.
      </p>

      <h2>2. Nature des sommes versées — {TAX_NOTICE_TITLE.toLowerCase()}</h2>
      <p>{TAX_NOTICE}</p>
      <p>
        L’association encaisse les frais d’inscription, puis effectue le don à
        la fondation Movember en son nom propre. Le participant n’est à aucun
        moment donateur au sens fiscal.
      </p>

      <h2>3. Indépendance</h2>
      <p>
        L’association organisatrice est <strong>indépendante</strong> de la
        fondation Movember. Elle agit avec son accord mais n’en est ni une
        antenne ni une représentante, et n’utilise ni son logo ni ses visuels.
      </p>

      <h2>4. Niveaux d’inscription et contreparties</h2>
      <p>
        Trois niveaux sont proposés, décrits sur la page d’accueil avec leur
        prix, le montant reversé et leurs contreparties. Les contreparties
        matérielles — médaille, cartes — sont expédiées à l’issue du défi, à
        l’adresse fournie par le participant.
      </p>

      <h2>5. Packs de cartes</h2>
      <p>
        Le participant peut acheter, en cours de jeu, des packs de cartes
        numériques. Leur composition — nombre de cartes et garantie éventuelle —
        est annoncée avant l’achat et respectée à chaque ouverture. Les cartes
        obtenues par un pack{" "}
        <strong>ne comptent pas dans le classement collection</strong> : acheter
        n’améliore aucun classement. Le montant versé est intégralement reversé
        à la fondation.
      </p>
      <p>
        Un pack est un contenu numérique fourni immédiatement. Conformément à
        l’article L221-28 du code de la consommation, le droit de rétractation
        ne s’y applique pas dès lors que le participant a demandé sa remise
        immédiate.
      </p>

      <h2>6. Paiement</h2>
      <p>
        Le paiement s’effectue en ligne par carte bancaire, via un prestataire
        agréé. Aucune donnée de carte n’est traitée ni conservée par
        l’association.
      </p>

      <h2>7. Droit de rétractation</h2>
      <p>
        Le participant dispose d’un délai de quatorze jours pour se rétracter.
        Ce droit ne s’applique plus dès lors que l’accès au jeu a été ouvert à
        sa demande expresse et que le défi a commencé, conformément à l’article
        L221-28 du code de la consommation.
      </p>

      <h2>8. Déroulement du défi</h2>
      <p>
        Les défis sont validés automatiquement à partir des activités
        enregistrées sur le compte sportif relié par le participant. Aucune
        saisie manuelle n’est possible. L’association se réserve le droit
        d’écarter une activité manifestement incohérente.
      </p>

      <h2>9. Politique de remboursement</h2>
      <p>
        Une demande de remboursement adressée à l’association{" "}
        <strong>avant l’ouverture du jeu</strong> est honorée intégralement.
      </p>
      <p>
        Après l’ouverture du jeu, le remboursement est apprécié au cas par cas :
        les contreparties déjà expédiées et les frais de paiement déjà prélevés
        en sont déduits. Un remboursement retire l’accès au jeu.
      </p>
      <p>
        Les packs de cartes déjà ouverts ne sont pas remboursables : leur
        contenu a été remis.
      </p>
      <p>
        <em>
          Point à arrêter par l’association avant l’ouverture des inscriptions
          (point P6).
        </em>
      </p>

      <h2>10. Annulation du défi</h2>
      <p>
        Si le défi ne pouvait se tenir, les sommes déjà encaissées seraient
        remboursées, déduction faite des contreparties déjà expédiées.
      </p>

      <h2>11. Données personnelles</h2>
      <p>
        Le traitement des données est décrit dans la politique de
        confidentialité. Le consentement à la récupération des activités
        sportives est recueilli séparément des présentes conditions, avant toute
        connexion à un compte sportif, et peut être retiré à tout moment.
      </p>

      <h2>12. Réclamations</h2>
      <p>
        Toute réclamation peut être adressée à l’association par les coordonnées
        figurant dans les mentions légales.
      </p>
    </LegalPage>
  );
}
