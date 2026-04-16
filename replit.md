# Nawras ERP — Workspace

## Overview

Full-stack SaaS ERP for Mauritanian businesses. French UI. Multi-tenant (company-per-user), RBAC, audit logging, Replit Auth.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + ShadCN UI + Recharts
- **Auth**: Replit Auth (OIDC + session cookies)

## Architecture

### Multi-tenancy
- Users are linked to companies via `user_company` table
- Each user has a role within a company (`role_permissions` RBAC)
- First login → redirected to `/onboarding` to create a company
- `POST /api/auth/onboard` auto-creates company + assigns `super_admin` role

### Authentication
- Replit Auth (OpenID Connect + PKCE) via `GET /api/login` → `GET /api/callback`
- Session stored in PostgreSQL `sessions` table (connect-pg-simple compatible)
- `authMiddleware` in `artifacts/api-server/src/middlewares/authMiddleware.ts`
- Frontend: `useAuth()` from `@workspace/replit-auth-web`
- Company check: `useCurrentUser()` hook in `artifacts/erp/src/hooks/use-company.ts`

## Key Files

| File | Purpose |
|------|---------|
| `lib/api-spec/openapi.yaml` | OpenAPI spec (single source of truth) |
| `lib/db/src/schema/*.ts` | All Drizzle schema files |
| `lib/api-zod/src/index.ts` | Exports generated types + runtime Zod schemas |
| `lib/api-zod/src/schemas.ts` | Manual Zod schemas (HealthCheck, Auth, etc.) |
| `artifacts/api-server/src/app.ts` | Express setup |
| `artifacts/api-server/src/routes/index.ts` | All route registrations |
| `artifacts/api-server/src/lib/rbac.ts` | RBAC helpers |
| `artifacts/api-server/src/lib/audit.ts` | Audit log helper |
| `artifacts/erp/src/App.tsx` | Frontend routes |
| `artifacts/erp/src/components/layout/Layout.tsx` | Auth + company guard |

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm run build` — build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Database Schema

Tables: `sessions`, `users`, `companies`, `roles`, `permissions`, `role_permissions`, `user_company`, `partners`, `products_services`, `quotes`, `quote_items`, `proformas`, `proforma_items`, `invoices`, `invoice_items`, `payments`, `departments`, `positions`, `employees`, `contracts`, `leave_types`, `leave_requests`, `attendances`, `employee_documents`, `audit_logs`

## API Routes

### Auth
- `GET /api/auth/user` — OIDC session user
- `GET /api/auth/me` — user with company info
- `POST /api/auth/onboard` — create company for first-login user
- `GET /api/login` → `GET /api/callback` — OIDC flow
- `GET /api/logout` — OIDC end session

### Billing
- `/api/partners` — CRUD partners (customers/suppliers)
- `/api/products` — CRUD products/services
- `/api/quotes` — CRUD + items
- `/api/proformas` — CRUD + items
- `/api/invoices` — CRUD + items + `POST /:id/validate`
- `/api/payments` — CRUD, auto-updates invoice status

### HR
- `/api/departments`, `/api/positions`, `/api/employees`
- `/api/contracts`, `/api/leave-types`, `/api/leave-requests`
- `/api/attendances`, `/api/employee-documents`

### Dashboard
- `GET /api/dashboard/summary` — KPI summary
- `GET /api/dashboard/revenue-chart` — monthly revenue
- `GET /api/dashboard/department-distribution` — employees by dept

### Admin
- `/api/companies`, `/api/users`, `/api/roles`
- `/api/audit-logs` — immutable activity log

## Modules
- **Facturation**: Devis → Proforma → Facture → Paiement workflow
- **RH**: Employés, Départements, Postes, Contrats, Congés, Présences, Documents
- **Admin**: Utilisateurs, Rôles & Permissions, Entreprises, Journal d'activité
