# مَعْهَد الإتقان — Institut Al Itqan
## Plateforme parents — Guide d'installation

---

## 🗂 Structure du projet

```
institut-al-itqan/
├── .env.local              ← vos clés Supabase (NE PAS partager)
├── middleware.ts           ← protection des routes
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── supabase_setup.sql      ← script SQL à exécuter une seule fois
├── lib/
│   └── supabase.ts         ← client Supabase
└── app/
    ├── globals.css
    ├── layout.tsx
    ├── page.tsx            ← page de connexion
    ├── parent/
    │   └── page.tsx        ← espace parents
    └── admin/
        └── page.tsx        ← espace administrateur
```

---

## 🚀 Installation

### Étape 1 — Installer les dépendances

```bash
cd institut-al-itqan
npm install
```

### Étape 2 — Configurer Supabase

1. Créer un compte sur https://supabase.com
2. Créer un nouveau projet
3. Aller dans **Settings → API**
4. Copier `Project URL` et `anon public key`
5. Ouvrir `.env.local` et remplacer les valeurs :

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Étape 3 — Créer les tables

1. Dans Supabase, aller dans **SQL Editor**
2. Copier tout le contenu de `supabase_setup.sql`
3. Cliquer **Run**

### Étape 4 — Créer votre compte admin

1. Dans Supabase → **Authentication → Users → Add user**
2. Entrer votre email et mot de passe
3. Dans **SQL Editor**, exécuter :

```sql
update profiles set role = 'admin' where email = 'votre@email.com';
```

### Étape 5 — Lancer le projet

```bash
npm run dev
```

Ouvrir http://localhost:3000

---

## 🌐 Déploiement sur Netlify

1. Pousser le projet sur GitHub
2. Aller sur https://netlify.com → **Add new site → Import from Git**
3. Dans **Environment variables**, ajouter :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Build command : `npm run build`
5. Publish directory : `.next`

---

## 📄 Ajouter des documents PDF

Uploadez vos PDF sur Google Drive :
- Clic droit sur le fichier → "Obtenir le lien"
- Changer le partage sur "Tout le monde peut voir"
- Copier le lien et le coller dans l'espace admin

---

## 🔑 Comptes

| Rôle   | Accès |
|--------|-------|
| Parent | `/parent` — voir annonces, horaires, calendrier, documents, inscription |
| Admin  | `/admin` — gérer annonces, horaires, documents |
