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

## Frontend CRUD Status (all pages completed)

All pages have functional Create/Edit/Delete dialogs using `useMutation` from `@tanstack/react-query` + async API functions from `@workspace/api-client-react`.

| Module | Entity | Pattern | Status |
|--------|--------|---------|--------|
| HR | Departments | Dialog (create/edit/delete) | ✅ |
| HR | Positions | Dialog (create/edit/delete) | ✅ |
| HR | Employees | Sheet (create/edit) | ✅ |
| HR | Contracts | Dialog (create) | ✅ |
| HR | Leaves | Dialog (create) + approve/reject buttons | ✅ |
| HR | Attendances | Dialog (create/edit) | ✅ |
| HR | Documents | Dialog (create) | ✅ |
| Billing | Partners | Sheet (create/edit/delete) | ✅ |
| Billing | Products | Dialog (create/edit/delete) | ✅ |
| Billing | Quotes | Sheet with line items table | ✅ |
| Billing | Proformas | Sheet with line items table | ✅ |
| Billing | Invoices | Sheet with line items table | ✅ |
| Billing | Payments | Dialog (record payment from unpaid invoices) | ✅ |
| Admin | Users | Dialog (edit role) | ✅ |
| Admin | Roles | Read-only list (no createRole API) | ✅ |

## CRUD Pattern

```tsx
const createMutation = useMutation({
  mutationFn: (data: CreateXBody) => createX(data),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/entity"] }); setDialogOpen(false); },
});
```

Currency: MRU using `new Intl.NumberFormat('fr-MR', { style: 'currency', currency: 'MRU' })`

## Pagination

All list tables use client-side pagination via the reusable component `artifacts/erp/src/components/ui/table-pagination.tsx`.

Pattern (10 rows per page):
```tsx
const PAGE_SIZE = 10;
const [page, setPage] = useState(1);
const rows = data?.data ?? [];
const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
// Reset page on filter/search change: setPage(1)
// Render: paginated.map(...) instead of rows.map(...)
// After </Table>: <TablePagination page={page} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
```

Pages paginated: billing/partners, billing/products, billing/invoices, billing/payments, billing/quotes, billing/proformas, hr/employees, hr/leaves, hr/departments, hr/positions, hr/contracts, hr/attendances, hr/documents, expenses/expenses.
