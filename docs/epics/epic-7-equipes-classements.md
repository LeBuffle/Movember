# Epic 7 — Équipes, classements et fil d'actualité

| | |
| --- | --- |
| **Priorité** | Must — chemin critique |
| **Jalon visé** | fin septembre 2026 |
| **Dépendances** | Epic 3 (story 3.1) · Epic 4 · Epic 5 |
| **Stories** | 9 |

---

## Objectif

Créer la dimension collective et compétitive du jeu — équipes, sept classements, compteurs
collectifs — et donner à l'organisation un canal de publication au fil du mois.

## Valeur livrée

Les équipes sont **le principal levier de croissance identifié pour cette 5ᵉ édition** :
elles permettent d'embarquer une association ou une entreprise d'un bloc. Les classements
sont le moteur de comparaison qui fait revenir les participants.

## Décisions applicables

- **D14 (architecture)** — classement général en points ; six classements secondaires ;
  classement d'équipe **normalisé par le nombre de membres**.
- **D8 (architecture) / D2 (PRD)** — le classement des cartes ne compte que les cartes
  gagnées par le jeu. Le classement général ne lit **jamais** les cartes.
- Tous les classements sont produits par une **vue matérialisée unique** rafraîchie
  périodiquement — aucun calcul à l'affichage.

## Les huit classements

| Classement | Base de calcul | Rang |
| --- | --- | --- |
| **Général** | Points des défis réussis | Principal |
| Défis réalisés | Nombre de défis réussis | Secondaire |
| Cartes gagnées | Cartes obtenues **par le jeu uniquement** | Secondaire |
| Kilomètres — course | Distance cumulée en course | Secondaire |
| Kilomètres — vélo | Distance cumulée à vélo | Secondaire |
| Nombre d'activités | Activités enregistrées | Secondaire |
| Temps d'activité | Durée cumulée, tous sports | Secondaire |
| **Équipes** | Points de l'équipe, normalisés | Principal collectif |

> À 600 participants, un classement unique n'intéresse que les dix premiers. Sept
> catégories donnent à chacun un endroit où figurer honorablement — le cycliste, l'assidu,
> le collectionneur, le régulier. Le coût technique est marginal : tout se calcule en une
> seule passe sur les mêmes données.

## Stories

| # | Titre | Prio |
| --- | --- | --- |
| 7.1 | Schéma des équipes et adhésion par code ou lien | M |
| 7.2 | Création et gestion d'une équipe | M |
| 7.3 | Vue matérialisée des classements et rafraîchissement périodique | M |
| 7.4 | Affichage du classement général et des classements secondaires | M |
| 7.5 | Classement par équipe normalisé | M |
| 7.6 | Tableau de bord personnel du participant | M |
| 7.7 | Compteurs collectifs dans l'application et sur la page publique | M |
| 7.8 | Fil d'actualité et publication depuis le back-office | M |
| 7.9 | Page dédiée d'équipe | S |

## Critères de sortie

- [ ] Un participant crée une équipe et invite d'autres participants par code ou lien.
- [ ] Les huit classements s'affichent et sont cohérents avec les données.
- [ ] **Le classement des cartes ignore les cartes achetées** — vérifié par un test
      automatisé dédié.
- [ ] **Le classement général ne lit jamais les cartes** — vérifié par un test automatisé
      dédié.
- [ ] Une petite équipe n'est pas mécaniquement désavantagée face à une grande.
- [ ] Les compteurs collectifs sont visibles sans être connecté.
- [ ] L'administrateur publie un message avec texte et image depuis son téléphone.

## Risques propres à l'epic

| Risque | Réponse |
| --- | --- |
| Classement lent à l'affichage | Vue matérialisée rafraîchie toutes les quinze minutes ; aucun calcul à la demande |
| Normalisation d'équipe perçue comme injuste | Règle affichée explicitement dans l'interface ; formule ajustable sans redéploiement |
| Un achat de pack influence un classement | Test automatisé dédié, exécuté à chaque intégration |
