-- Lecture seule : exécuter AVANT toute migration et conserver les résultats.
SELECT
 has_table_privilege('anon','public.groupes','SELECT') AS anon_lit_groupes,
 has_table_privilege('authenticated','public.groupes','SELECT') AS connecte_lit_groupes;
SELECT id, public FROM storage.buckets ORDER BY id;
SELECT schemaname,tablename,policyname,cmd,roles,qual,with_check
FROM pg_policies
WHERE (schemaname='public' AND tablename IN
 ('groupes','groupe_acces','groupe_documents','documents','profiles'))
 OR (schemaname='storage' AND tablename='objects')
ORDER BY schemaname,tablename,policyname;
SELECT role, acces_cours, COUNT(*) AS comptes
FROM public.profiles GROUP BY role,acces_cours ORDER BY role,acces_cours;
SELECT COUNT(*) AS groupes FROM public.groupes;
SELECT COUNT(*) AS copies FROM public.groupe_acces;
