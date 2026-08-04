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
    <LegalPage title="Conditions générales de vente" updatedOn="2026-08-04">
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

      <h2>3. Niveaux d’inscription et contreparties</h2>
      <p>
        Trois niveaux sont proposés, décrits sur la page d’accueil avec leur
        prix, le montant reversé et leurs contreparties. Les contreparties
        matérielles — médaille, cartes — sont expédiées à l’issue du défi, à
        l’adresse fournie par le participant.
      </p>

      <h2>4. Paiement</h2>
      <p>
        Le paiement s’effectue en ligne par carte bancaire, via un prestataire
        agréé. Aucune donnée de carte n’est traitée ni conservée par
        l’association.
      </p>

      <h2>5. Droit de rétractation</h2>
      <p>
        Le participant dispose d’un délai de quatorze jours pour se rétracter.
        Ce droit ne s’applique plus dès lors que l’accès au jeu a été ouvert à
        sa demande expresse et que le défi a commencé, conformément à l’article
        L221-28 du code de la consommation.
      </p>

      <h2>6. Déroulement du défi</h2>
      <p>
        Les défis sont validés automatiquement à partir des activités
        enregistrées sur le compte sportif relié par le participant. Aucune
        saisie manuelle n’est possible. L’association se réserve le droit
        d’écarter une activité manifestement incohérente.
      </p>

      <h2>7. Annulation</h2>
      <p>
        Si le défi ne pouvait se tenir, les sommes déjà encaissées seraient
        remboursées, déduction faite des contreparties déjà expédiées.
      </p>

      <h2>8. Réclamations</h2>
      <p>
        Toute réclamation peut être adressée à l’association par les coordonnées
        figurant dans les mentions légales.
      </p>
    </LegalPage>
  );
}
