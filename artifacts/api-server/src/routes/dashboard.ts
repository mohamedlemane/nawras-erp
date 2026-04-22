import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, invoicesTable, paymentsTable, partnersTable, employeesTable, leaveRequestsTable, departmentsTable, quotesTable, projectsTable, consultationsTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany } from "../lib/rbac";

const router: IRouter = Router();

// GET /api/dashboard/summary
router.get("/dashboard/summary", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const cid = info.companyId;

  const [
    [customerCount],
    [supplierCount],
    [pendingQuotesCount],
    [acceptedQuotesCount],
    [rejectedQuotesCount],
    [unpaidInvoicesCount],
    [totalRevenue],
    [empCount],
    [pendingLeavesCount],
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(partnersTable).where(and(eq(partnersTable.companyId, cid), eq(partnersTable.type, "customer"))),
    db.select({ count: sql<number>`count(*)::int` }).from(partnersTable).where(and(eq(partnersTable.companyId, cid), eq(partnersTable.type, "supplier"))),
    db.select({ count: sql<number>`count(*)::int` }).from(quotesTable).where(and(eq(quotesTable.companyId, cid), eq(quotesTable.status, "draft"))),
    db.select({ count: sql<number>`count(*)::int` }).from(quotesTable).where(and(eq(quotesTable.companyId, cid), eq(quotesTable.status, "accepted"))),
    db.select({ count: sql<number>`count(*)::int` }).from(quotesTable).where(and(eq(quotesTable.companyId, cid), eq(quotesTable.status, "rejected"))),
    db.select({ count: sql<number>`count(*)::int` }).from(invoicesTable).where(and(eq(invoicesTable.companyId, cid), sql`status in ('validated', 'partially_paid')`)),
    db.select({ total: sql<number>`coalesce(sum(amount), 0)::float` }).from(paymentsTable).where(eq(paymentsTable.companyId, cid)),
    db.select({ count: sql<number>`count(*)::int` }).from(employeesTable).where(and(eq(employeesTable.companyId, cid), eq(employeesTable.employmentStatus, "active"))),
    db.select({ count: sql<number>`count(*)::int` }).from(leaveRequestsTable).where(and(eq(leaveRequestsTable.companyId, cid), eq(leaveRequestsTable.status, "pending"))),
  ]);

  res.json({
    totalCustomers: customerCount?.count ?? 0,
    totalSuppliers: supplierCount?.count ?? 0,
    pendingQuotes: pendingQuotesCount?.count ?? 0,
    acceptedQuotes: acceptedQuotesCount?.count ?? 0,
    rejectedQuotes: rejectedQuotesCount?.count ?? 0,
    unpaidInvoices: unpaidInvoicesCount?.count ?? 0,
    totalRevenue: totalRevenue?.total ?? 0,
    totalEmployees: empCount?.count ?? 0,
    pendingLeaves: pendingLeavesCount?.count ?? 0,
  });
});

// GET /api/dashboard/revenue-chart
router.get("/dashboard/revenue-chart", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const cid = info.companyId;
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  const revenueData = await db
    .select({
      month: sql<string>`to_char(payment_date, 'YYYY-MM')`,
      revenue: sql<number>`sum(amount)::float`,
      invoiceCount: sql<number>`count(distinct invoice_id)::int`,
    })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.companyId, cid), gte(paymentsTable.paymentDate, startOfYear)))
    .groupBy(sql`to_char(payment_date, 'YYYY-MM')`)
    .orderBy(sql`to_char(payment_date, 'YYYY-MM')`);

  res.json(revenueData);
});

// GET /api/dashboard/department-distribution
router.get("/dashboard/department-distribution", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const cid = info.companyId;

  const distribution = await db
    .select({
      name: departmentsTable.name,
      count: sql<number>`count(${employeesTable.id})::int`,
    })
    .from(departmentsTable)
    .leftJoin(employeesTable, and(eq(employeesTable.departmentId, departmentsTable.id), eq(employeesTable.employmentStatus, "active")))
    .where(eq(departmentsTable.companyId, cid))
    .groupBy(departmentsTable.id, departmentsTable.name)
    .orderBy(sql`count(${employeesTable.id}) desc`);

  res.json(distribution);
});

// GET /api/dashboard/projects-stats
router.get("/dashboard/projects-stats", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const cid = info.companyId;

  const [byStatus, billingStatus, totals] = await Promise.all([
    db
      .select({ status: projectsTable.status, count: sql<number>`count(*)::int` })
      .from(projectsTable)
      .where(eq(projectsTable.companyId, cid))
      .groupBy(projectsTable.status),
    db
      .select({ status: projectsTable.billingStatus, count: sql<number>`count(*)::int` })
      .from(projectsTable)
      .where(eq(projectsTable.companyId, cid))
      .groupBy(projectsTable.billingStatus),
    db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(eq(projectsTable.companyId, cid)),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of byStatus) statusMap[row.status] = row.count;
  const billingMap: Record<string, number> = {};
  for (const row of billingStatus) billingMap[row.status] = row.count;

  const activeProjects = (statusMap["mobilisation"] ?? 0) + (statusMap["en_cours"] ?? 0);
  const completedProjects = statusMap["achevement"] ?? 0;

  res.json({
    total: totals[0]?.count ?? 0,
    active: activeProjects,
    completed: completedProjects,
    preparation: statusMap["preparation"] ?? 0,
    mobilisation: statusMap["mobilisation"] ?? 0,
    en_cours: statusMap["en_cours"] ?? 0,
    achevement: statusMap["achevement"] ?? 0,
    facture: statusMap["facture"] ?? 0,
    nonFacture: billingMap["non_facture"] ?? 0,
    factureB: billingMap["facture"] ?? 0,
    solde: billingMap["solde"] ?? 0,
    byStatus: byStatus.map(r => ({ status: r.status, count: r.count })),
  });
});

// GET /api/dashboard/consultations-stats
router.get("/dashboard/consultations-stats", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const cid = info.companyId;

  const [byStatus, byType, totals] = await Promise.all([
    db
      .select({ status: consultationsTable.status, count: sql<number>`count(*)::int` })
      .from(consultationsTable)
      .where(eq(consultationsTable.companyId, cid))
      .groupBy(consultationsTable.status),
    db
      .select({ type: consultationsTable.type, count: sql<number>`count(*)::int` })
      .from(consultationsTable)
      .where(eq(consultationsTable.companyId, cid))
      .groupBy(consultationsTable.type),
    db.select({ count: sql<number>`count(*)::int` }).from(consultationsTable).where(eq(consultationsTable.companyId, cid)),
  ]);

  const total = totals[0]?.count ?? 0;
  const attribue = byStatus.find(r => r.status === "attribue")?.count ?? 0;
  const perdu = byStatus.find(r => r.status === "perdu")?.count ?? 0;
  const inProgress = byStatus
    .filter(r => ["recu", "en_etude", "proposition_envoyee", "en_negociation"].includes(r.status))
    .reduce((s, r) => s + r.count, 0);

  const winRate = total > 0 ? Math.round((attribue / total) * 100) : 0;

  res.json({
    total,
    attribue,
    perdu,
    inProgress,
    winRate,
    byStatus: byStatus.map(r => ({ status: r.status, count: r.count })),
    byType: byType.map(r => ({ type: r.type, count: r.count })),
  });
});

export default router;
