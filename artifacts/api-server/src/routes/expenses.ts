import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db, expenseTypesTable, expensesTable, partnersTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany } from "../lib/rbac";
import { handleDbError } from "../lib/db-errors";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

// Default expense types seeded for new companies
const DEFAULT_TYPES = [
  { name: "Salaires", code: "salaires", color: "#3b82f6", description: "Rémunération du personnel" },
  { name: "Électricité", code: "electricite", color: "#f59e0b", description: "Factures d'électricité" },
  { name: "Internet & Télécoms", code: "internet", color: "#6366f1", description: "Abonnements internet, téléphone, fibre" },
  { name: "Loyer", code: "loyer", color: "#8b5cf6", description: "Loyer bureaux et locaux" },
  { name: "Carburant", code: "carburant", color: "#f97316", description: "Carburant véhicules" },
  { name: "Eau", code: "eau", color: "#06b6d4", description: "Factures d'eau" },
  { name: "Fournitures", code: "fournitures", color: "#10b981", description: "Fournitures de bureau" },
  { name: "Transport", code: "transport", color: "#84cc16", description: "Frais de transport" },
  { name: "Maintenance", code: "maintenance", color: "#f43f5e", description: "Maintenance et réparations" },
  { name: "Autres charges", code: "autres", color: "#94a3b8", description: "Autres dépenses diverses" },
];

// ── EXPENSE TYPES ─────────────────────────────────────────────────────────────

router.get("/expense-types", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res, "array")) res.status(403).json({ error: "No company membership" }); return; }

  let types = await db
    .select()
    .from(expenseTypesTable)
    .where(eq(expenseTypesTable.companyId, info.companyId))
    .orderBy(expenseTypesTable.name);

  if (types.length === 0) {
    const inserted = await db
      .insert(expenseTypesTable)
      .values(DEFAULT_TYPES.map(t => ({ ...t, companyId: info.companyId, isDefault: true })))
      .returning();
    types = inserted;
  }

  res.json(types.map(t => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() })));
});

router.post("/expense-types", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { name, code, description, color } = req.body;
  if (!name || !code) { res.status(400).json({ error: "name et code sont requis" }); return; }

  const [type] = await db
    .insert(expenseTypesTable)
    .values({ companyId: info.companyId, name, code, description, color: color ?? "#6366f1" })
    .returning();

  await createAuditLog({ userId: req.user.id, companyId: info.companyId, action: "create", entity: "expense_type", entityId: type!.id, after: type });
  res.status(201).json({ ...type!, createdAt: type!.createdAt.toISOString(), updatedAt: type!.updatedAt.toISOString() });
});

router.patch("/expense-types/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, code, description, color, isActive } = req.body;

  const [type] = await db
    .update(expenseTypesTable)
    .set({ name, code, description, color, isActive })
    .where(and(eq(expenseTypesTable.id, id), eq(expenseTypesTable.companyId, info.companyId)))
    .returning();

  if (!type) { res.status(404).json({ error: "Type non trouvé" }); return; }
  await createAuditLog({ userId: req.user.id, companyId: info.companyId, action: "update", entity: "expense_type", entityId: id, after: type });
  res.json({ ...type, createdAt: type.createdAt.toISOString(), updatedAt: type.updatedAt.toISOString() });
});

router.delete("/expense-types/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  try {
    await db.delete(expenseTypesTable).where(and(eq(expenseTypesTable.id, id), eq(expenseTypesTable.companyId, info.companyId)));
    await createAuditLog({ userId: req.user.id, companyId: info.companyId, action: "delete", entity: "expense_type", entityId: id });
    res.status(204).send();
  } catch (err) {
    if (!handleDbError(err, res, "expense_type")) throw err;
  }
});

// ── EXPENSES ──────────────────────────────────────────────────────────────────

// Alias for partner join (avoid name conflict with expensesTable)
const supplierPartner = partnersTable;

router.get("/expenses", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const cid = info.companyId;
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, parseInt((req.query.limit as string) ?? "50", 10));
  const offset = (page - 1) * limit;
  const typeId = req.query.typeId ? parseInt(req.query.typeId as string, 10) : undefined;
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
  const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

  const conditions = [eq(expensesTable.companyId, cid)];
  if (typeId) conditions.push(eq(expensesTable.expenseTypeId, typeId));
  if (dateFrom) conditions.push(gte(expensesTable.expenseDate, dateFrom));
  if (dateTo) conditions.push(lte(expensesTable.expenseDate, dateTo));

  const [expenses, [{ total }]] = await Promise.all([
    db
      .select({
        id: expensesTable.id,
        companyId: expensesTable.companyId,
        expenseTypeId: expensesTable.expenseTypeId,
        reference: expensesTable.reference,
        label: expensesTable.label,
        amount: expensesTable.amount,
        currency: expensesTable.currency,
        expenseDate: expensesTable.expenseDate,
        paymentMethod: expensesTable.paymentMethod,
        status: expensesTable.status,
        supplierId: expensesTable.supplierId,
        supplier: expensesTable.supplier,
        supplierName: supplierPartner.name,
        supplierCompany: supplierPartner.companyName,
        invoiceRef: expensesTable.invoiceRef,
        projectId: expensesTable.projectId,
        notes: expensesTable.notes,
        createdAt: expensesTable.createdAt,
        updatedAt: expensesTable.updatedAt,
        typeName: expenseTypesTable.name,
        typeColor: expenseTypesTable.color,
        typeCode: expenseTypesTable.code,
      })
      .from(expensesTable)
      .leftJoin(expenseTypesTable, eq(expensesTable.expenseTypeId, expenseTypesTable.id))
      .leftJoin(supplierPartner, eq(expensesTable.supplierId, supplierPartner.id))
      .where(and(...conditions))
      .orderBy(desc(expensesTable.expenseDate))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(expensesTable).where(and(...conditions)),
  ]);

  res.json({
    data: expenses.map(e => ({
      ...e,
      expenseDate: e.expenseDate.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })),
    total,
    page,
    limit,
  });
});

router.post("/expenses", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { label, amount, expenseTypeId, expenseDate, paymentMethod, status, supplierId, supplier, invoiceRef, projectId, notes, currency, reference } = req.body;
  if (!label) { res.status(400).json({ error: "label est requis" }); return; }
  if (!amount || isNaN(parseFloat(amount))) { res.status(400).json({ error: "amount invalide" }); return; }

  const [expense] = await db
    .insert(expensesTable)
    .values({
      companyId: info.companyId,
      label,
      amount: String(amount),
      expenseTypeId: expenseTypeId ?? null,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      paymentMethod: paymentMethod ?? "cash",
      status: status ?? "paid",
      supplierId: supplierId ? parseInt(supplierId, 10) : null,
      supplier: supplier ?? null,
      invoiceRef: invoiceRef ?? null,
      projectId: projectId ?? null,
      notes: notes ?? null,
      currency: currency ?? "MRU",
      reference: reference ?? null,
      createdBy: req.user.id.toString(),
    })
    .returning();

  await createAuditLog({ userId: req.user.id, companyId: info.companyId, action: "create", entity: "expense", entityId: expense!.id, after: expense });
  res.status(201).json({ ...expense!, expenseDate: expense!.expenseDate.toISOString(), createdAt: expense!.createdAt.toISOString(), updatedAt: expense!.updatedAt.toISOString() });
});

router.patch("/expenses/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { label, amount, expenseTypeId, expenseDate, paymentMethod, status, supplierId, supplier, invoiceRef, projectId, notes, currency, reference } = req.body;

  const [expense] = await db
    .update(expensesTable)
    .set({
      label,
      amount: amount ? String(amount) : undefined,
      expenseTypeId: expenseTypeId ?? null,
      expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      paymentMethod,
      status,
      supplierId: supplierId !== undefined ? (supplierId ? parseInt(supplierId, 10) : null) : undefined,
      supplier: supplier ?? null,
      invoiceRef,
      projectId: projectId ?? null,
      notes,
      currency,
      reference,
      updatedBy: req.user.id.toString(),
    })
    .where(and(eq(expensesTable.id, id), eq(expensesTable.companyId, info.companyId)))
    .returning();

  if (!expense) { res.status(404).json({ error: "Dépense non trouvée" }); return; }
  await createAuditLog({ userId: req.user.id, companyId: info.companyId, action: "update", entity: "expense", entityId: id, after: expense });
  res.json({ ...expense, expenseDate: expense.expenseDate.toISOString(), createdAt: expense.createdAt.toISOString(), updatedAt: expense.updatedAt.toISOString() });
});

router.delete("/expenses/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  await db.delete(expensesTable).where(and(eq(expensesTable.id, id), eq(expensesTable.companyId, info.companyId)));
  await createAuditLog({ userId: req.user.id, companyId: info.companyId, action: "delete", entity: "expense", entityId: id });
  res.status(204).send();
});

router.get("/expenses/summary", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const cid = info.companyId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [byType, monthly, yearly] = await Promise.all([
    db
      .select({
        typeId: expensesTable.expenseTypeId,
        typeName: expenseTypesTable.name,
        typeColor: expenseTypesTable.color,
        total: sql<number>`coalesce(sum(${expensesTable.amount}::float), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(expensesTable)
      .leftJoin(expenseTypesTable, eq(expensesTable.expenseTypeId, expenseTypesTable.id))
      .where(eq(expensesTable.companyId, cid))
      .groupBy(expensesTable.expenseTypeId, expenseTypesTable.name, expenseTypesTable.color),
    db.select({ total: sql<number>`coalesce(sum(amount::float), 0)` }).from(expensesTable).where(and(eq(expensesTable.companyId, cid), gte(expensesTable.expenseDate, startOfMonth))),
    db.select({ total: sql<number>`coalesce(sum(amount::float), 0)` }).from(expensesTable).where(and(eq(expensesTable.companyId, cid), gte(expensesTable.expenseDate, new Date(now.getFullYear(), 0, 1)))),
  ]);

  res.json({
    monthlyTotal: monthly[0]?.total ?? 0,
    yearlyTotal: yearly[0]?.total ?? 0,
    byType,
  });
});

export default router;
