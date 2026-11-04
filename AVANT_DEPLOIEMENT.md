# Intégration de travail — ne pas déployer en production

Le projet GitHub complet a été utilisé comme base. Les fichiers `components/ParentDashboard.tsx`,
`components/AdminDashboard.tsx` et `app/parent/page.tsx` ont été remplacés par les
versions v9. Les scripts SQL sont dans `securite_a_verifier/` et n'ont pas été exécutés.

**Validation incomplète :** la compilation n'a pas pu être lancée, car les
dépendances npm ne sont pas disponibles hors ligne. Aucun test Supabase avec
JWT de parent bloqué, autorisé ou administrateur n'a été effectué.

**Points bloquants :**
- Confirmer l'existence et les droits du bucket `documents` : le code original
  et le code intégré y font référence, mais l'inventaire communiqué ne
  recensait que `groupe-docs`.
- Vérifier les droits SQL effectifs et les politiques Storage sur la base réelle.
- Confirmer que les comptes historiques conservent `acces_cours=true`.
- Tester l'interface et les appels directs à l'API avec les trois rôles.
- Vérifier le comportement des liens externes et documents statiques.
- Ne pas utiliser automatiquement le rollback v8/v9 qui pourrait rouvrir
  des accès trop larges.

Aucune action n'a été faite sur GitHub, Supabase ou Vercel.
