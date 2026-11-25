import { LegalPage } from "@/components/marketing/legal-page";
import { GAME_STARTS_ON } from "@/lib/edition/calendar";
import { ASSOCIATION, registeredAddress } from "@/lib/legal/association";
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
 *
 * **Article 10 is a rule, not a case-by-case promise** (decision P6, settled
 * on 11 August). Three volunteers arbitrating four hundred refund requests in
 * November end up saying yes to whoever insists hardest, which is fair to
 * nobody. A date, one named exception, and the association absorbing the
 * payment fees is a policy that holds without a negotiation.
 *
 * **Article 6 must be in place before the first credit is sold** (decision
 * P8). A credit bought and never spent, whose fate was not announced, is a
 * complaint arriving in December — and the association would have no written
 * ground to stand on. The shop screen says the same thing before the payment,
 * because a rule that only exists in the terms is a rule nobody read.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Conditions générales de vente" updatedOn="2026-08-14">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent l’inscription au DEFI Movember,
        organisé par l’association <strong>{ASSOCIATION.name}</strong> (
        {ASSOCIATION.legalForm}, RNA {ASSOCIATION.rnaNumber}), dont le siège
        social est situé {registeredAddress()}, au profit de la fondation
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

      <h2>6. Crédits de défis entre joueurs</h2>
      <p>
        Le participant peut acheter, en cours de jeu, des{" "}
        <strong>crédits de défi</strong>, vendus par lots dont le prix et la
        quantité sont affichés avant l’achat. Un crédit permet d’envoyer un défi
        sportif à un autre participant, qui dispose de vingt-quatre heures pour
        le relever.
      </p>
      <p>
        Relever un défi ou en envoyer un{" "}
        <strong>ne rapporte ni point, ni carte, ni place au classement</strong>,
        pour aucun des deux participants. Ne pas relever un défi reçu n’entraîne
        aucune pénalité. Recevoir des défis et y riposter est gratuit : le jeu
        reste intégralement jouable sans acheter le moindre crédit.
      </p>
      <p>
        Un envoi refusé — destinataire ayant désactivé la réception, ayant déjà
        reçu le nombre maximal de défis de la journée, ou n’étant plus
        participant actif — <strong>ne consomme aucun crédit</strong>.
      </p>
      <p>
        Les crédits sont attachés au compte du participant. Ils ne sont ni
        cessibles à un autre participant, ni convertibles en argent, ni
        remboursables une fois dépensés.
      </p>
      <p>
        <strong>
          Les crédits achetés et non dépensés au 30 novembre 2026 à minuit ne
          sont pas remboursés : leur montant est reversé à la fondation Movember
          au même titre que le reste de la collecte.
        </strong>{" "}
        Le participant en est informé avant l’achat, sur la page de vente. Cette
        règle découle de la nature même de la somme versée, rappelée à l’article
        2 : il s’agit d’un achat avec contrepartie destiné à la collecte, et non
        d’une provision conservée pour le compte du participant.
      </p>
      <p>
        Un crédit est un contenu numérique fourni immédiatement. Conformément à
        l’article L221-28 du code de la consommation, le droit de rétractation
        ne s’y applique pas dès lors que le participant a demandé sa remise
        immédiate.
      </p>

      <h2>7. Paiement</h2>
      <p>
        Le paiement s’effectue en ligne par carte bancaire, via un prestataire
        agréé. Aucune donnée de carte n’est traitée ni conservée par
        l’association.
      </p>

      <h2>8. Droit de rétractation</h2>
      <p>
        Le participant dispose d’un délai de quatorze jours pour se rétracter.
        Ce droit ne s’applique plus dès lors que l’accès au jeu a été ouvert à
        sa demande expresse et que le défi a commencé, conformément à l’article
        L221-28 du code de la consommation.
      </p>

      <h2>9. Déroulement du défi</h2>
      <p>
        Les défis sont validés automatiquement à partir des activités
        enregistrées sur le compte sportif relié par le participant. Aucune
        saisie manuelle n’est possible. L’association se réserve le droit
        d’écarter une activité manifestement incohérente.
      </p>

      <h2>10. Politique de remboursement</h2>
      <p>
        <strong>Avant le {GAME_STARTS_ON}</strong>, toute demande de
        remboursement adressée à l’association est honorée intégralement, sans
        justification à fournir.
      </p>
      <p>
        <strong>À partir du {GAME_STARTS_ON}</strong>, le jeu a commencé et
        l’accès a été fourni : les inscriptions ne sont plus remboursables. Une
        exception est prévue en cas d’<strong>empêchement médical</strong>, sur
        présentation d’un justificatif, avec déduction des contreparties déjà
        expédiées. Un remboursement retire l’accès au jeu.
      </p>
      <p>
        Les <strong>packs de cartes ouverts</strong> et les{" "}
        <strong>crédits de défi dépensés</strong> ne sont jamais remboursables :
        leur contenu a été remis. Les crédits non dépensés au terme du défi
        suivent la règle de l’article 6 — ils sont reversés à la fondation.
      </p>
      <p>
        Les frais de paiement prélevés par le prestataire restent{" "}
        <strong>à la charge de l’association</strong> : un remboursement est
        intégral du point de vue du participant.
      </p>

      <h2>11. Annulation du défi</h2>
      <p>
        Si le défi ne pouvait se tenir, les sommes déjà encaissées seraient
        remboursées, déduction faite des contreparties déjà expédiées.
      </p>

      <h2>12. Données personnelles</h2>
      <p>
        Le traitement des données est décrit dans la politique de
        confidentialité. Le consentement à la récupération des activités
        sportives est recueilli séparément des présentes conditions, avant toute
        connexion à un compte sportif, et peut être retiré à tout moment.
      </p>

      <h2>13. Réclamations</h2>
      <p>
        Toute réclamation peut être adressée à l’association à{" "}
        <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>, ou par
        courrier au siège social : {registeredAddress()}.
      </p>
    </LegalPage>
  );
}
