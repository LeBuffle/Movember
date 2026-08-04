import { LegalPage } from "@/components/marketing/legal-page";

export const metadata = {
  title: "Politique de confidentialité — DEFI Movember",
};

/**
 * Working draft. Must be reviewed before registration opens.
 *
 * The part that is not editorial: sports activity data — pace, duration,
 * sometimes location — says something about a person's health and movements.
 * `CLAUDE.md` §6 treats it as sensitive, which makes minimisation, an
 * explicit consent, a retention period, export and account deletion
 * obligations rather than features. Epic 8 implements them; this page states
 * them.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedOn="2026-08-04">
      <h2>Qui traite vos données</h2>
      <p>
        L’association organisatrice, dont les coordonnées figurent dans les
        mentions légales, est responsable du traitement.
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
        Nous ne conservons pas le tracé détaillé de vos parcours. Nous ne
        conservons aucune donnée de carte bancaire. Nous ne revendons ni ne
        cédons aucune donnée.
      </p>

      <h2>Pourquoi</h2>
      <p>
        Vos activités servent uniquement à valider vos défis et à établir les
        classements. Votre adresse e-mail sert à vous informer du jeu et, si
        vous n’avez pas installé l’application, à vous envoyer les rappels
        quotidiens.
      </p>

      <h2>Ce que les autres participants voient</h2>
      <p>
        Votre pseudonyme, votre avatar et vos résultats de jeu. Jamais votre
        adresse e-mail, jamais votre nom, jamais le détail de vos activités.
      </p>

      <h2>Combien de temps</h2>
      <p>
        Vos données de compte sont conservées jusqu’à sa suppression. Vos
        activités sportives sont conservées le temps de l’édition et de sa
        clôture comptable.
      </p>

      <h2>Vos droits</h2>
      <ul>
        <li>Accéder à vos données et en obtenir une copie.</li>
        <li>Les faire rectifier.</li>
        <li>
          Supprimer votre compte, ce qui efface vos données personnelles et vos
          activités.
        </li>
        <li>Retirer à tout moment l’accès à votre compte sportif.</li>
        <li>
          Introduire une réclamation auprès de la CNIL si vous estimez vos
          droits méconnus.
        </li>
      </ul>

      <h2>Hébergement</h2>
      <p>
        Les données sont hébergées dans l’Union européenne. Le service de base
        de données est situé en région Paris.
      </p>
    </LegalPage>
  );
}
