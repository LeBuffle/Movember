import Link from "next/link";

import { LegalPage } from "@/components/marketing/legal-page";
import {
  ASSOCIATION,
  HOSTING,
  registeredAddress,
} from "@/lib/legal/association";
import { RETENTION_RULES, NEVER_PURGED } from "@/lib/privacy/retention";

export const metadata = {
  title: "Politique de confidentialité — DEFI Movember",
};

/**
 * The privacy policy (story 11.6).
 *
 * **The retention section is generated from `src/lib/privacy/retention.ts`,
 * not written here.** That is the single most important thing about this file.
 * A duration stated on a page and applied by a scheduled task, written in two
 * places, is a duration that will eventually disagree with itself — and the
 * page will be the one that is wrong, in front of the person it was written
 * for. Here the page and the purge read the same list.
 *
 * The rest is editorial and must be reviewed by the Product Owner before
 * registration opens. What is already firm and must not be softened: sporting
 * activity data says something about a person's health and movements, so
 * minimisation, an explicit separate consent, export and erasure are
 * obligations rather than features (`CLAUDE.md` §6).
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedOn="2026-08-08">
      <h2>Qui traite vos données</h2>
      <p>
        L’association <strong>{ASSOCIATION.name}</strong> (
        {ASSOCIATION.legalForm}, RNA {ASSOCIATION.rnaNumber}), dont le siège
        social est situé {registeredAddress()}, est{" "}
        <strong>responsable du traitement</strong>. Vous pouvez la joindre à{" "}
        <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>. Le
        marché visé est la France et l’Union européenne.
      </p>

      <h2>Ce que nous collectons</h2>
      <ul>
        <li>
          Votre adresse e-mail et le pseudonyme que vous choisissez, pour votre
          compte et les classements.
        </li>
        <li>
          Vos activités sportives, récupérées depuis le compte que vous reliez :
          type d’activité, distance, durée, dénivelé, date.
        </li>
        <li>
          Les informations nécessaires à votre inscription payante et, selon le
          niveau, à l’expédition de votre contrepartie.
        </li>
      </ul>

      <h2>Ce que nous ne collectons pas</h2>
      <p>
        Nous ne conservons <strong>pas</strong> le tracé détaillé de vos
        parcours, ni votre fréquence cardiaque, ni votre puissance, ni votre
        cadence. Nous ne conservons <strong>aucune</strong> donnée de carte
        bancaire : elles ne nous sont jamais transmises. Nous ne revendons ni ne
        cédons aucune donnée.
      </p>

      <h2>Sur quelle base</h2>
      <ul>
        <li>
          <strong>Votre consentement</strong> pour la récupération de vos
          activités sportives. Il est recueilli séparément de l’acceptation des
          conditions de vente, avant toute connexion à votre compte sportif, et
          vous pouvez le retirer à tout moment.
        </li>
        <li>
          <strong>L’exécution du contrat</strong> pour votre inscription, votre
          participation et l’expédition de votre contrepartie.
        </li>
        <li>
          <strong>Une obligation légale</strong> pour la conservation des pièces
          comptables.
        </li>
      </ul>

      <h2>Pourquoi</h2>
      <p>
        Vos activités servent uniquement à valider vos défis et à établir les
        classements. Votre adresse e-mail sert à vous informer du jeu et, si
        vous n’avez pas installé l’application, à vous envoyer les rappels
        quotidiens.
      </p>

      <h2>Ce que les autres participants voient</h2>
      <p>
        Votre pseudonyme et vos résultats de jeu. Jamais votre adresse e-mail,
        jamais votre nom, jamais le détail de vos activités, jamais votre
        adresse postale.
      </p>

      <h2>Combien de temps</h2>
      <p>
        Les durées ci-dessous sont comptées à partir de la fin de l’édition, et
        elles sont appliquées par une tâche automatique quotidienne — ce ne sont
        pas des intentions.
      </p>
      <ul>
        {/* Read from the same list the purge applies. See the note above. */}
        {RETENTION_RULES.map((rule) => (
          <li key={rule.table}>{rule.reason}</li>
        ))}
      </ul>

      <p>Ce qui n’est jamais effacé automatiquement :</p>
      <ul>
        {NEVER_PURGED.map((entry) => (
          <li key={entry.table}>{entry.reason}</li>
        ))}
      </ul>

      <p>
        Votre compte et son contenu sont conservés jusqu’à ce que vous le
        supprimiez, et au plus tard jusqu’aux échéances ci-dessus.
      </p>

      <h2>Si vous supprimez votre compte</h2>
      <p>
        Sont effacés : votre profil et votre pseudonyme, vos activités
        sportives, vos défis, vos cartes, votre appartenance à une équipe, votre
        adresse de livraison et vos abonnements aux notifications. Votre
        autorisation est retirée auprès de votre fournisseur d’activité.
      </p>
      <p>
        <strong>
          Les lignes comptables de vos paiements subsistent — le montant et la
          date.
        </strong>{" "}
        La loi impose à l’association de les conserver pour justifier son don à
        la fondation. Le lien vers votre personne est rompu : ces lignes ne vous
        désignent plus. La suppression d’un compte n’est pas un remboursement.
      </p>

      <h2>Vos droits</h2>
      <ul>
        <li>
          <strong>Accéder à vos données et en obtenir une copie</strong>, depuis{" "}
          <Link href="/mon-compte/donnees">Mon compte → Mes données</Link>,
          immédiatement et sans écrire à personne.
        </li>
        <li>Les faire rectifier, en nous écrivant.</li>
        <li>
          <strong>Supprimer votre compte</strong>, depuis le même écran.
        </li>
        <li>
          Retirer à tout moment l’accès à votre compte sportif, sans supprimer
          votre compte de jeu.
        </li>
        <li>
          Introduire une réclamation auprès de la CNIL si vous estimez vos
          droits méconnus.
        </li>
      </ul>
      <p>
        L’évaluation interne de cohérence des activités — les contrôles qui
        signalent une sortie manifestement incohérente — n’est pas incluse dans
        le fichier téléchargeable : la détailler reviendrait à indiquer comment
        la contourner. Elle vous est communiquée sur demande auprès de
        l’association.
      </p>
      <p>
        Pour exercer l’un de ces droits, écrivez à{" "}
        <a href={`mailto:${ASSOCIATION.email}`}>{ASSOCIATION.email}</a>. Nous
        répondons dans un délai d’un mois.
      </p>

      <h2>Sous-traitants</h2>
      <p>
        Base de données et authentification, paiement, envoi d’e-mails,
        hébergement, et le fournisseur d’activité sportive que vous reliez
        vous-même. Chacun agit sur nos instructions, dans l’Union européenne ou
        sous un cadre de transfert reconnu.
      </p>

      <h2>Hébergement</h2>
      <p>
        Les données sont hébergées dans l’Union européenne. L’application tourne
        sur un serveur {HOSTING.application.provider} situé en{" "}
        {HOSTING.application.region} ; la base de données est chez{" "}
        {HOSTING.database.provider}, région {HOSTING.database.region}.
      </p>
    </LegalPage>
  );
}
