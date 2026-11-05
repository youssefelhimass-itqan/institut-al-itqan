# État réel des validations

- Trois composants du frontend remplacés dans le projet GitHub original.
- Aucune installation de dépendances npm, aucun `next build` exécuté.
- Aucun test API avec JWT parent bloqué/autorisé/admin.
- Aucun changement sur GitHub, Vercel ou Supabase.
- Les migrations précédentes ne sont pas validées et ne doivent pas être exécutées.
- Les fichiers de `public/` sont accessibles sans authentification ; vérifier
  qu'ils ne contiennent pas de cours ou d'enregistrements privés.
- Le bucket `documents` est référencé par le frontend mais n'était pas présent
  dans l'inventaire Supabase communiqué.
- Le bucket `groupe-docs` public et `groupes.zoom_link` en base restent exposés
  tant que la bascule de sécurité n'est pas faite.
