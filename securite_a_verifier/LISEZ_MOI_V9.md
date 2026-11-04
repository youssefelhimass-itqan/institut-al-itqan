# Version v9 — correctifs réalisés localement

Cette archive est une **proposition de migration**, pas une version validée en production.
Aucune modification n'a été faite à GitHub, Supabase ou Vercel.

## Modifications par rapport à v8
- Révocation de SELECT sur `public.groupes` aussi pour `PUBLIC`, avec test
  effectif `has_table_privilege` bloquant.
- Ajout de `PRECONTROLE_LECTURE_SEULE.sql` pour vérifier les droits, politiques,
  buckets et comptes avant toute migration.
- Phase C : garde-fous exécutables et passage du bucket `groupe-docs` en privé.
  La suppression irréversible des colonnes a été retirée de ce script.

## Points à valider avant toute mise en production
1. La v8 référence un bucket `documents` dans les deux tableaux de bord,
   alors que l'inventaire communiqué ne montrait que `groupe-docs`.
   Il faut identifier l'emplacement réel des documents généraux.
2. Vérifier les droits d'administration et toutes les requêtes front
   avec les véritables politiques RLS et les utilisateurs tests.
3. Vérifier que les documents/vidéos externes ne contournent pas les contrôles.
4. Vérifier la création de compte, les 51 comptes historiques et Stripe.
5. Tester l'API directe sur `groupes`, `groupe_acces`, `groupe_documents`,
   et les URL Storage publiques et signées, avec JWT parent bloqué,
   parent autorisé et administrateur.
6. Prévoir sauvegarde externe et plan de retour arrière testé. Le rollback
   de la v8 restaure des accès permissifs : **ne pas l'exécuter tel quel**.
7. Vérifier le code complet du dépôt et compiler le projet avant déploiement.

**Ordre sûr :** précontrôle en lecture seule → revue du code complet et des
résultats → environnement de test → tests d'accès → validation → production.
