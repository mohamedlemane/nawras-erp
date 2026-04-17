# Nawras ERP

Système de gestion intégré (ERP) pour les entreprises mauritaniennes — interface en français, devise en MRU.

## Aperçu

Nawras ERP est une application SaaS multi-tenant couvrant la facturation, les ressources humaines et l'administration des entreprises, avec un contrôle d'accès basé sur les rôles (RBAC) et une journalisation des audits.

## Fonctionnalités

### Facturation
- Partenaires (clients & fournisseurs)
- Produits & services
- Devis → Proformas → Factures → Paiements
- Flux de statut des documents (brouillon, validé, payé, annulé)
- Impression et export des documents

### Ressources Humaines
- Départements & postes
- Employés & contrats
- Congés (types, demandes, approbations)
- Présences
- Documents employés

### Administration
- Architecture multi-tenant (une instance, plusieurs entreprises)
- Gestion des entreprises avec assignation d'un gérant à la création
- Gestion des utilisateurs & rôles
- Permissions granulaires par rôle
- Journal d'audit complet
- Paramètres de l'entreprise

### Authentification
- Super Admin plateforme (email + mot de passe)
- Admin d'entreprise / Gérant (email + mot de passe)
- Sessions persistantes (PostgreSQL)

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Base de données | PostgreSQL (Drizzle ORM) |
| Auth | Sessions Passport.js + bcryptjs |
| Monorepo | pnpm workspaces |

## Structure du projet

```
nawras-erp/
├── artifacts/
│   ├── api-server/          # Backend Express (port 8080)
│   │   └── src/
│   │       ├── routes/      # billing, hr, products, partners, users, companies...
│   │       ├── lib/         # rbac, audit, session
│   │       └── index.ts
│   └── erp/                 # Frontend React + Vite
│       └── src/
│           ├── pages/       # Dashboard, Billing, HR, Admin...
│           ├── components/  # UI components
│           └── hooks/       # use-auth, use-company...
└── lib/
    └── db/                  # Drizzle schema, migrations, seeds
        └── src/
            ├── schema.ts
            └── seed-superadmin.ts
```

## Installation

### Prérequis
- Node.js 20+
- pnpm 9+
- PostgreSQL

### Démarrage

```bash
# Installer les dépendances
pnpm install

# Configurer les variables d'environnement
cp .env.example .env
# Renseigner DATABASE_URL et SESSION_SECRET

# Appliquer les migrations
pnpm --filter @workspace/db run migrate

# Créer le super admin
pnpm --filter @workspace/db run seed:superadmin

# Lancer en développement
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/erp run dev
```

### Identifiants par défaut

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@nawras.mr | Admin@2025! |

> Changez le mot de passe après la première connexion.

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `SESSION_SECRET` | Clé secrète pour les sessions |
| `PORT` | Port du serveur API (défaut : 8080) |

## API

Le backend expose une API REST sous `/api/` :

- `POST /api/auth/local/login` — Connexion
- `POST /api/auth/local/logout` — Déconnexion
- `GET /api/auth/me` — Utilisateur courant
- `GET/POST /api/products` — Produits & services
- `GET/POST /api/partners` — Partenaires
- `GET/POST /api/quotes` — Devis
- `GET/POST /api/proformas` — Proformas
- `GET/POST /api/invoices` — Factures
- `GET/POST /api/payments` — Paiements
- `GET/POST /api/employees` — Employés
- `GET/POST /api/departments` — Départements
- `GET/POST /api/companies` — Entreprises (Super Admin)
- `GET /api/dashboard/summary` — Tableau de bord

## Licence

Propriétaire — Tous droits réservés © 2025 Nawras ERP
