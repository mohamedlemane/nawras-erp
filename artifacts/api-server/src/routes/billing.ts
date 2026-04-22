import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db, quotesTable, quoteItemsTable, proformasTable, proformaItemsTable, invoicesTable, invoiceItemsTable, paymentsTable, partnersTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany } from "../lib/rbac";
import { createAuditLog } from "../lib/audit";
import { handleDbError } from "../lib/db-errors";

const QUOTE_LOCKED_STATUSES = new Set(["sent", "accepted", "refused", "rejected", "converted", "expired"]);
const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "brouillon", sent: "envoyé", accepted: "accepté", refused: "refusé",
  rejected: "refusé", converted: "converti", expired: "expiré",
};

const router: IRouter = Router();

// ── QUOTES ────────────────────────────────────────────────────────────────────

router.get("/quotes", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const conditions = [eq(quotesTable.companyId, info.companyId)];
  if (status) conditions.push(eq(quotesTable.status, status));

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db
    .select({
      id: quotesTable.id, companyId: quotesTable.companyId, quoteNumber: quotesTable.quoteNumber,
      partnerId: quotesTable.partnerId, partnerName: partnersTable.name, subject: quotesTable.subject,
      issueDate: quotesTable.issueDate, validUntil: quotesTable.validUntil, currency: quotesTable.currency,
      subtotal: quotesTable.subtotal, taxAmount: quotesTable.taxAmount, total: quotesTable.total,
      status: quotesTable.status, notes: quotesTable.notes, createdAt: quotesTable.createdAt, updatedAt: quotesTable.updatedAt,
    })
    .from(quotesTable)
    .leftJoin(partnersTable, eq(quotesTable.partnerId, partnersTable.id))
    .where(whereClause).limit(limit).offset(offset).orderBy(quotesTable.createdAt);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(quotesTable).where(whereClause);
  res.json({ data: data.map(serDoc), total: count, page, limit });
});

router.post("/quotes", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { partnerId, subject, issueDate, validUntil, currency, notes, items } = req.body;
  if (!items?.length) { res.status(400).json({ error: "items are required" }); return; }

  const year = new Date().getFullYear();
  const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` }).from(quotesTable).where(eq(quotesTable.companyId, info.companyId));
  const quoteNumber = `DEV-${year}-${String(cnt + 1).padStart(4, "0")}`;

  const { subtotal, taxAmount, total } = calcTotals(items);

  const [quote] = await db.insert(quotesTable).values({ companyId: info.companyId, quoteNumber, partnerId: partnerId ?? null, subject, issueDate: new Date(issueDate), validUntil: validUntil ? new Date(validUntil) : null, currency: currency ?? null, subtotal: String(subtotal), taxAmount: String(taxAmount), total: String(total), notes, createdBy: req.user.id }).returning();

  await db.insert(quoteItemsTable).values(items.map((it: any) => {
    const sub = Number(it.quantity) * Number(it.unitPrice);
    const tax = sub * (Number(it.taxRate ?? 0) / 100);
    return { quoteId: quote!.id, productId: it.productId ?? null, description: it.description, quantity: String(it.quantity), unitPrice: String(it.unitPrice), taxRate: String(it.taxRate ?? 0), subtotal: String(sub), taxAmount: String(tax), total: String(sub + tax) };
  }));

  res.status(201).json({ ...serDoc(quote!), partnerName: null });
});

router.get("/quotes/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [quote] = await db.select({ id: quotesTable.id, companyId: quotesTable.companyId, quoteNumber: quotesTable.quoteNumber, partnerId: quotesTable.partnerId, partnerName: partnersTable.name, subject: quotesTable.subject, issueDate: quotesTable.issueDate, validUntil: quotesTable.validUntil, currency: quotesTable.currency, subtotal: quotesTable.subtotal, taxAmount: quotesTable.taxAmount, total: quotesTable.total, status: quotesTable.status, notes: quotesTable.notes, createdAt: quotesTable.createdAt, updatedAt: quotesTable.updatedAt }).from(quotesTable).leftJoin(partnersTable, eq(quotesTable.partnerId, partnersTable.id)).where(and(eq(quotesTable.id, id), eq(quotesTable.companyId, info.companyId))).limit(1);
  if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }

  const items = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, id));
  res.json({ ...serDoc(quote), items: items.map(serItem) });
});

router.patch("/quotes/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { partnerId, subject, issueDate, validUntil, currency, notes, status, items } = req.body;

  const [existing] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.companyId, info.companyId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Devis introuvable" }); return; }

  const isStatusOnlyChange = status !== undefined
    && partnerId === undefined && subject === undefined && issueDate === undefined
    && validUntil === undefined && currency === undefined && notes === undefined && (!items || items.length === 0);

  if (!isStatusOnlyChange && QUOTE_LOCKED_STATUSES.has(existing.status)) {
    res.status(409).json({
      error: `Ce devis ne peut plus être modifié car il est ${QUOTE_STATUS_LABELS[existing.status] ?? existing.status}. Seuls les devis en brouillon sont modifiables.`,
      code: "QUOTE_LOCKED",
    });
    return;
  }

  let updates: any = { updatedBy: req.user.id };
  if (partnerId !== undefined) updates.partnerId = partnerId;
  if (subject !== undefined) updates.subject = subject;
  if (issueDate !== undefined) updates.issueDate = new Date(issueDate);
  if (validUntil !== undefined) updates.validUntil = validUntil ? new Date(validUntil) : null;
  if (currency !== undefined) updates.currency = currency;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;

  if (items?.length) {
    const { subtotal, taxAmount, total } = calcTotals(items);
    updates = { ...updates, subtotal: String(subtotal), taxAmount: String(taxAmount), total: String(total) };
    await db.delete(quoteItemsTable).where(eq(quoteItemsTable.quoteId, id));
    await db.insert(quoteItemsTable).values(items.map((it: any) => {
      const sub = Number(it.quantity) * Number(it.unitPrice);
      const tax = sub * (Number(it.taxRate ?? 0) / 100);
      return { quoteId: id, productId: it.productId ?? null, description: it.description, quantity: String(it.quantity), unitPrice: String(it.unitPrice), taxRate: String(it.taxRate ?? 0), subtotal: String(sub), taxAmount: String(tax), total: String(sub + tax) };
    }));
  }

  const [quote] = await db.update(quotesTable).set(updates).where(and(eq(quotesTable.id, id), eq(quotesTable.companyId, info.companyId))).returning();
  if (!quote) { res.status(404).json({ error: "Devis introuvable" }); return; }
  res.json({ ...serDoc(quote), partnerName: null });
});

router.delete("/quotes/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db.select({ status: quotesTable.status }).from(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.companyId, info.companyId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Devis introuvable" }); return; }

  if (QUOTE_LOCKED_STATUSES.has(existing.status)) {
    res.status(409).json({
      error: `Impossible de supprimer ce devis car il est ${QUOTE_STATUS_LABELS[existing.status] ?? existing.status}. Seuls les devis en brouillon peuvent être supprimés.`,
      code: "QUOTE_LOCKED",
    });
    return;
  }

  try {
    await db.delete(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.companyId, info.companyId)));
    res.sendStatus(204);
  } catch (err) {
    if (!handleDbError(err, res, "quote")) throw err;
  }
});

// ── PROFORMAS ─────────────────────────────────────────────────────────────────

router.get("/proformas", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const conditions = [eq(proformasTable.companyId, info.companyId)];
  if (status) conditions.push(eq(proformasTable.status, status));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select({ id: proformasTable.id, companyId: proformasTable.companyId, proformaNumber: proformasTable.proformaNumber, partnerId: proformasTable.partnerId, partnerName: partnersTable.name, subject: proformasTable.subject, issueDate: proformasTable.issueDate, validUntil: proformasTable.validUntil, currency: proformasTable.currency, subtotal: proformasTable.subtotal, taxAmount: proformasTable.taxAmount, total: proformasTable.total, status: proformasTable.status, notes: proformasTable.notes, createdAt: proformasTable.createdAt, updatedAt: proformasTable.updatedAt }).from(proformasTable).leftJoin(partnersTable, eq(proformasTable.partnerId, partnersTable.id)).where(whereClause).limit(limit).offset(offset).orderBy(proformasTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(proformasTable).where(whereClause);
  res.json({ data: data.map(serProforma), total: count, page, limit });
});

router.post("/proformas", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { partnerId, subject, issueDate, validUntil, currency, notes, items } = req.body;
  if (!items?.length) { res.status(400).json({ error: "items are required" }); return; }

  const year = new Date().getFullYear();
  const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` }).from(proformasTable).where(eq(proformasTable.companyId, info.companyId));
  const proformaNumber = `PRO-${year}-${String(cnt + 1).padStart(4, "0")}`;
  const { subtotal, taxAmount, total } = calcTotals(items);

  const [proforma] = await db.insert(proformasTable).values({ companyId: info.companyId, proformaNumber, partnerId: partnerId ?? null, subject, issueDate: new Date(issueDate), validUntil: validUntil ? new Date(validUntil) : null, currency: currency ?? null, subtotal: String(subtotal), taxAmount: String(taxAmount), total: String(total), notes, createdBy: req.user.id }).returning();
  await db.insert(proformaItemsTable).values(items.map((it: any) => {
    const sub = Number(it.quantity) * Number(it.unitPrice);
    const tax = sub * (Number(it.taxRate ?? 0) / 100);
    return { proformaId: proforma!.id, productId: it.productId ?? null, description: it.description, quantity: String(it.quantity), unitPrice: String(it.unitPrice), taxRate: String(it.taxRate ?? 0), subtotal: String(sub), taxAmount: String(tax), total: String(sub + tax) };
  }));

  res.status(201).json({ ...serProforma(proforma!), partnerName: null });
});

router.get("/proformas/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [proforma] = await db.select({ id: proformasTable.id, companyId: proformasTable.companyId, proformaNumber: proformasTable.proformaNumber, partnerId: proformasTable.partnerId, partnerName: partnersTable.name, subject: proformasTable.subject, issueDate: proformasTable.issueDate, validUntil: proformasTable.validUntil, currency: proformasTable.currency, subtotal: proformasTable.subtotal, taxAmount: proformasTable.taxAmount, total: proformasTable.total, status: proformasTable.status, notes: proformasTable.notes, createdAt: proformasTable.createdAt, updatedAt: proformasTable.updatedAt }).from(proformasTable).leftJoin(partnersTable, eq(proformasTable.partnerId, partnersTable.id)).where(and(eq(proformasTable.id, id), eq(proformasTable.companyId, info.companyId))).limit(1);
  if (!proforma) { res.status(404).json({ error: "Proforma not found" }); return; }

  const items = await db.select().from(proformaItemsTable).where(eq(proformaItemsTable.proformaId, id));
  res.json({ ...serProforma(proforma), items: items.map(serItem) });
});

router.patch("/proformas/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { partnerId, subject, issueDate, validUntil, currency, notes, status, items } = req.body;
  let updates: any = { updatedBy: req.user.id };
  if (partnerId !== undefined) updates.partnerId = partnerId;
  if (subject !== undefined) updates.subject = subject;
  if (issueDate !== undefined) updates.issueDate = new Date(issueDate);
  if (validUntil !== undefined) updates.validUntil = validUntil ? new Date(validUntil) : null;
  if (currency !== undefined) updates.currency = currency;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;

  if (items?.length) {
    const { subtotal, taxAmount, total } = calcTotals(items);
    updates = { ...updates, subtotal: String(subtotal), taxAmount: String(taxAmount), total: String(total) };
    await db.delete(proformaItemsTable).where(eq(proformaItemsTable.proformaId, id));
    await db.insert(proformaItemsTable).values(items.map((it: any) => {
      const sub = Number(it.quantity) * Number(it.unitPrice);
      const tax = sub * (Number(it.taxRate ?? 0) / 100);
      return { proformaId: id, productId: it.productId ?? null, description: it.description, quantity: String(it.quantity), unitPrice: String(it.unitPrice), taxRate: String(it.taxRate ?? 0), subtotal: String(sub), taxAmount: String(tax), total: String(sub + tax) };
    }));
  }

  const [proforma] = await db.update(proformasTable).set(updates).where(and(eq(proformasTable.id, id), eq(proformasTable.companyId, info.companyId))).returning();
  if (!proforma) { res.status(404).json({ error: "Proforma not found" }); return; }
  res.json({ ...serProforma(proforma), partnerName: null });
});

router.delete("/proformas/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(proformasTable).where(and(eq(proformasTable.id, id), eq(proformasTable.companyId, info.companyId)));
  res.sendStatus(204);
});

// ── INVOICES ──────────────────────────────────────────────────────────────────

router.get("/invoices", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  const conditions = [eq(invoicesTable.companyId, info.companyId)];
  if (status) conditions.push(eq(invoicesTable.status, status));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select({ id: invoicesTable.id, companyId: invoicesTable.companyId, invoiceNumber: invoicesTable.invoiceNumber, partnerId: invoicesTable.partnerId, partnerName: partnersTable.name, subject: invoicesTable.subject, issueDate: invoicesTable.issueDate, dueDate: invoicesTable.dueDate, currency: invoicesTable.currency, subtotal: invoicesTable.subtotal, taxAmount: invoicesTable.taxAmount, total: invoicesTable.total, amountPaid: invoicesTable.amountPaid, amountDue: invoicesTable.amountDue, status: invoicesTable.status, notes: invoicesTable.notes, createdAt: invoicesTable.createdAt, updatedAt: invoicesTable.updatedAt }).from(invoicesTable).leftJoin(partnersTable, eq(invoicesTable.partnerId, partnersTable.id)).where(whereClause).limit(limit).offset(offset).orderBy(invoicesTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(invoicesTable).where(whereClause);
  res.json({ data: data.map(serInvoice), total: count, page, limit });
});

router.post("/invoices", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { partnerId, subject, issueDate, dueDate, currency, notes, items } = req.body;
  if (!items?.length) { res.status(400).json({ error: "items are required" }); return; }

  const year = new Date().getFullYear();
  const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` }).from(invoicesTable).where(eq(invoicesTable.companyId, info.companyId));
  const invoiceNumber = `FAC-${year}-${String(cnt + 1).padStart(4, "0")}`;
  const { subtotal, taxAmount, total } = calcTotals(items);

  const [invoice] = await db.insert(invoicesTable).values({ companyId: info.companyId, invoiceNumber, partnerId: partnerId ?? null, subject, issueDate: new Date(issueDate), dueDate: dueDate ? new Date(dueDate) : null, currency: currency ?? null, subtotal: String(subtotal), taxAmount: String(taxAmount), total: String(total), amountPaid: "0", amountDue: String(total), notes, createdBy: req.user.id }).returning();
  await db.insert(invoiceItemsTable).values(items.map((it: any) => {
    const sub = Number(it.quantity) * Number(it.unitPrice);
    const tax = sub * (Number(it.taxRate ?? 0) / 100);
    return { invoiceId: invoice!.id, productId: it.productId ?? null, description: it.description, quantity: String(it.quantity), unitPrice: String(it.unitPrice), taxRate: String(it.taxRate ?? 0), subtotal: String(sub), taxAmount: String(tax), total: String(sub + tax) };
  }));

  await createAuditLog({ companyId: info.companyId, userId: req.user.id, userEmail: req.user.email ?? undefined, action: "create", entity: "invoice", entityId: String(invoice!.id) });
  res.status(201).json({ ...serInvoice(invoice!), partnerName: null });
});

router.get("/invoices/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [invoice] = await db.select({ id: invoicesTable.id, companyId: invoicesTable.companyId, invoiceNumber: invoicesTable.invoiceNumber, partnerId: invoicesTable.partnerId, partnerName: partnersTable.name, subject: invoicesTable.subject, issueDate: invoicesTable.issueDate, dueDate: invoicesTable.dueDate, currency: invoicesTable.currency, subtotal: invoicesTable.subtotal, taxAmount: invoicesTable.taxAmount, total: invoicesTable.total, amountPaid: invoicesTable.amountPaid, amountDue: invoicesTable.amountDue, status: invoicesTable.status, notes: invoicesTable.notes, createdAt: invoicesTable.createdAt, updatedAt: invoicesTable.updatedAt }).from(invoicesTable).leftJoin(partnersTable, eq(invoicesTable.partnerId, partnersTable.id)).where(and(eq(invoicesTable.id, id), eq(invoicesTable.companyId, info.companyId))).limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

  const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.invoiceId, id));
  res.json({ ...serInvoice(invoice), items: items.map(serItem), payments: payments.map(serPayment) });
});

router.patch("/invoices/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { partnerId, subject, issueDate, dueDate, currency, notes, items } = req.body;
  let updates: any = { updatedBy: req.user.id };
  if (partnerId !== undefined) updates.partnerId = partnerId;
  if (subject !== undefined) updates.subject = subject;
  if (issueDate !== undefined) updates.issueDate = new Date(issueDate);
  if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;
  if (currency !== undefined) updates.currency = currency;
  if (notes !== undefined) updates.notes = notes;

  if (items?.length) {
    const { subtotal, taxAmount, total } = calcTotals(items);
    updates = { ...updates, subtotal: String(subtotal), taxAmount: String(taxAmount), total: String(total) };
    const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
    if (existing) {
      const newAmountDue = total - Number(existing.amountPaid);
      updates.amountDue = String(Math.max(0, newAmountDue));
    }
    await db.delete(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    await db.insert(invoiceItemsTable).values(items.map((it: any) => {
      const sub = Number(it.quantity) * Number(it.unitPrice);
      const tax = sub * (Number(it.taxRate ?? 0) / 100);
      return { invoiceId: id, productId: it.productId ?? null, description: it.description, quantity: String(it.quantity), unitPrice: String(it.unitPrice), taxRate: String(it.taxRate ?? 0), subtotal: String(sub), taxAmount: String(tax), total: String(sub + tax) };
    }));
  }

  const [invoice] = await db.update(invoicesTable).set(updates).where(and(eq(invoicesTable.id, id), eq(invoicesTable.companyId, info.companyId))).returning();
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  res.json({ ...serInvoice(invoice), partnerName: null });
});

router.delete("/invoices/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(invoicesTable).where(and(eq(invoicesTable.id, id), eq(invoicesTable.companyId, info.companyId)));
  res.sendStatus(204);
});

router.post("/invoices/:id/validate", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [invoice] = await db.update(invoicesTable).set({ status: "validated", updatedBy: req.user.id }).where(and(eq(invoicesTable.id, id), eq(invoicesTable.companyId, info.companyId))).returning();
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  await createAuditLog({ companyId: info.companyId, userId: req.user.id, action: "validate", entity: "invoice", entityId: String(id) });
  res.json({ ...serInvoice(invoice), partnerName: null });
});

// ── PAYMENTS ──────────────────────────────────────────────────────────────────

router.get("/payments", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const invoiceId = req.query.invoiceId ? parseInt(String(req.query.invoiceId), 10) : undefined;

  const conditions = [eq(paymentsTable.companyId, info.companyId)];
  if (invoiceId) conditions.push(eq(paymentsTable.invoiceId, invoiceId));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select().from(paymentsTable).where(whereClause).limit(limit).offset(offset).orderBy(paymentsTable.paymentDate);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(paymentsTable).where(whereClause);
  res.json({ data: data.map(serPayment), total: count, page, limit });
});

router.post("/payments", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { invoiceId, amount, paymentDate, paymentMethod, reference, notes } = req.body;
  if (!invoiceId || !amount || !paymentDate || !paymentMethod) { res.status(400).json({ error: "Missing required fields" }); return; }

  const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.companyId, info.companyId))).limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

  const amountDue = Number(invoice.amountDue);
  if (Number(amount) <= 0) { res.status(400).json({ error: "Le montant doit être supérieur à 0" }); return; }
  if (Number(amount) > amountDue) {
    res.status(400).json({ error: `Le montant saisi (${Number(amount).toFixed(2)} MRU) dépasse le restant dû (${amountDue.toFixed(2)} MRU)` });
    return;
  }

  const [payment] = await db.insert(paymentsTable).values({ companyId: info.companyId, invoiceId, amount: String(amount), paymentDate: new Date(paymentDate), paymentMethod, reference, notes, createdBy: req.user.id }).returning();

  const newAmountPaid = Number(invoice.amountPaid) + Number(amount);
  const newAmountDue = Math.max(0, Number(invoice.total) - newAmountPaid);
  let newStatus = invoice.status;
  if (newAmountDue <= 0) newStatus = "paid";
  else if (newAmountPaid > 0) newStatus = "partially_paid";

  await db.update(invoicesTable).set({ amountPaid: String(newAmountPaid), amountDue: String(newAmountDue), status: newStatus }).where(eq(invoicesTable.id, invoiceId));

  res.status(201).json(serPayment(payment!));
});

// ── HELPERS ───────────────────────────────────────────────────────────────────

function calcTotals(items: any[]) {
  let subtotal = 0, taxAmount = 0, total = 0;
  for (const it of items) {
    const sub = Number(it.quantity) * Number(it.unitPrice);
    const tax = sub * (Number(it.taxRate ?? 0) / 100);
    subtotal += sub;
    taxAmount += tax;
    total += sub + tax;
  }
  return { subtotal, taxAmount, total };
}

function serDoc(d: any) {
  return {
    ...d,
    subtotal: Number(d.subtotal),
    taxAmount: Number(d.taxAmount),
    total: Number(d.total),
    issueDate: d.issueDate instanceof Date ? d.issueDate.toISOString() : d.issueDate,
    validUntil: d.validUntil ? (d.validUntil instanceof Date ? d.validUntil.toISOString() : d.validUntil) : null,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  };
}

function serProforma(d: any) {
  return {
    ...d,
    subtotal: Number(d.subtotal),
    taxAmount: Number(d.taxAmount),
    total: Number(d.total),
    issueDate: d.issueDate instanceof Date ? d.issueDate.toISOString() : d.issueDate,
    validUntil: d.validUntil ? (d.validUntil instanceof Date ? d.validUntil.toISOString() : d.validUntil) : null,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  };
}

function serInvoice(d: any) {
  return {
    ...d,
    subtotal: Number(d.subtotal),
    taxAmount: Number(d.taxAmount),
    total: Number(d.total),
    amountPaid: Number(d.amountPaid),
    amountDue: Number(d.amountDue),
    issueDate: d.issueDate instanceof Date ? d.issueDate.toISOString() : d.issueDate,
    dueDate: d.dueDate ? (d.dueDate instanceof Date ? d.dueDate.toISOString() : d.dueDate) : null,
    createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
  };
}

function serItem(it: any) {
  return {
    ...it,
    quantity: Number(it.quantity),
    unitPrice: Number(it.unitPrice),
    taxRate: Number(it.taxRate),
    subtotal: Number(it.subtotal),
    taxAmount: Number(it.taxAmount),
    total: Number(it.total),
  };
}

function serPayment(p: any) {
  return {
    ...p,
    amount: Number(p.amount),
    paymentDate: p.paymentDate instanceof Date ? p.paymentDate.toISOString() : p.paymentDate,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

export default router;
