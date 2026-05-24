-- ============================================================
-- SCRIPT SQL — À coller dans : Supabase > SQL Editor > Run
-- ============================================================

-- 1. Table des profils (rôle : parent ou admin)
create table if not exists profiles (
  id        uuid references auth.users(id) on delete cascade primary key,
  email     text,
  role      text default 'parent' check (role in ('parent', 'admin')),
  created_at timestamp default now()
);

-- Trigger : crée automatiquement un profil "parent" à chaque inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'parent');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Annonces
create table if not exists annonces (
  id         uuid default gen_random_uuid() primary key,
  titre      text not null,
  contenu    text,
  priorite   text default 'normale' check (priorite in ('normale', 'moyenne', 'haute')),
  created_at timestamp default now()
);

-- 3. Horaires
create table if not exists horaires (
  id         uuid default gen_random_uuid() primary key,
  cours      text not null,
  horaire    text,
  jour       text,
  niveau     text,
  created_at timestamp default now()
);

-- 4. Documents
create table if not exists documents (
  id         uuid default gen_random_uuid() primary key,
  nom        text not null,
  url        text,
  taille     text,
  created_at timestamp default now()
);

-- ============================================================
-- 5. Sécurité (Row Level Security)
-- ============================================================
alter table profiles  enable row level security;
alter table annonces  enable row level security;
alter table horaires  enable row level security;
alter table documents enable row level security;

-- Profiles : chacun voit uniquement son propre profil
create policy "Profil personnel" on profiles
  for select using (auth.uid() = id);

-- Annonces : lecture pour tous les connectés
create policy "Lire annonces" on annonces
  for select to authenticated using (true);

-- Annonces : écriture/suppression réservée à l'admin
create policy "Admin gère annonces" on annonces
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Horaires : lecture pour tous les connectés
create policy "Lire horaires" on horaires
  for select to authenticated using (true);

-- Horaires : écriture réservée à l'admin
create policy "Admin gère horaires" on horaires
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Documents : lecture pour tous les connectés
create policy "Lire documents" on documents
  for select to authenticated using (true);

-- Documents : écriture réservée à l'admin
create policy "Admin gère documents" on documents
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 6. Données de démonstration (optionnel)
-- ============================================================
insert into annonces (titre, contenu, priorite) values
  ('Bienvenue à l''Institut Al Itqan', 'Nous sommes ravis de vous accueillir pour cette nouvelle année scolaire. Que Allah vous bénisse dans votre apprentissage.', 'normale'),
  ('Examens de fin de trimestre', 'Les examens auront lieu du 15 au 19 janvier. Les parents sont priés d''assurer la présence de leurs enfants.', 'haute'),
  ('Réunion parents-professeurs', 'Une réunion est organisée le samedi 20 janvier à 10h. Votre présence est fortement souhaitée.', 'moyenne');

insert into horaires (cours, horaire, jour, niveau) values
  ('Coran – Mémorisation',          '09h00 – 11h00', 'Samedi',   'Niveau débutant'),
  ('Langue arabe',                  '11h00 – 12h30', 'Samedi',   'Niveau intermédiaire'),
  ('Tafsir & Sciences islamiques',  '14h00 – 16h00', 'Samedi',   'Niveau avancé'),
  ('Coran – Révision',              '09h00 – 11h00', 'Dimanche', 'Tous niveaux'),
  ('Fiqh & Seerah',                 '11h00 – 13h00', 'Dimanche', 'Niveau intermédiaire');

insert into documents (nom, url, taille) values
  ('Règlement intérieur 2024-2025.pdf', 'https://votre-lien-ici', '1.2 Mo'),
  ('Calendrier scolaire annuel.pdf',    'https://votre-lien-ici', '0.8 Mo');

-- ============================================================
-- 7. Passer votre compte en "admin"
-- ============================================================
-- Après avoir créé votre compte via Supabase > Authentication > Add user,
-- exécutez cette ligne en remplaçant l'email :
--
-- update profiles set role = 'admin' where email = 'votre@email.com';
-- ============================================================
