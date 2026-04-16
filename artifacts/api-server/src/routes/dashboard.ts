import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, invoicesTable, paymentsTable, partnersTable, employeesTable, leaveRequestsTable, departmentsTable, quotesTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo } from "../lib/rbac";

const router: IRouter = Router();

// GET /api/dashboard/summary
router.get("/dashboard/summary", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company membership" }); return; }

  const cid = info.companyId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    [customerCount],
    [supplierCount],
    [pendingQuotesCount],
    [unpaidInvoicesCount],
    [totalRevenue],
    [empCount],
    [pendingLeavesCount],
    [monthlyRevenue],
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(partnersTable).where(and(eq(partnersTable.companyId, cid), eq(partnersTable.type, "customer"))),
    db.select({ count: sql<number>`count(*)::int` }).from(partnersTable).where(and(eq(partnersTable.companyId, cid), eq(partnersTable.type, "supplier"))),
    db.select({ count: sql<number>`count(*)::int` }).from(quotesTable).where(and(eq(quotesTable.companyId, cid), eq(quotesTable.status, "draft"))),
    db.select({ count: sql<number>`count(*)::int` }).from(invoicesTable).where(and(eq(invoicesTable.companyId, cid), sql`status in ('validated', 'partially_paid')`)),
    db.select({ total: sql<number>`coalesce(sum(amount), 0)::float` }).from(paymentsTable).where(eq(paymentsTable.companyId, cid)),
    db.select({ count: sql<number>`count(*)::int` }).from(employeesTable).where(and(eq(employeesTable.companyId, cid), eq(employeesTable.employmentStatus, "active"))),
    db.select({ count: sql<number>`count(*)::int` }).from(leaveRequestsTable).where(and(eq(leaveRequestsTable.companyId, cid), eq(leaveRequestsTable.status, "pending"))),
    db.select({ total: sql<number>`coalesce(sum(amount), 0)::float` }).from(paymentsTable).where(and(eq(paymentsTable.companyId, cid), gte(paymentsTable.paymentDate, startOfMonth))),
  ]);

  res.json({
    totalCustomers: customerCount?.count ?? 0,
    totalSuppliers: supplierCount?.count ?? 0,
    pendingQuotes: pendingQuotesCount?.count ?? 0,
    unpaidInvoices: unpaidInvoicesCount?.count ?? 0,
    totalRevenue: totalRevenue?.total ?? 0,
    totalEmployees: empCount?.count ?? 0,
    pendingLeaves: pendingLeavesCount?.count ?? 0,
    monthlyRevenue: monthlyRevenue?.total ?? 0,
  });
});

// GET /api/dashboard/revenue-chart
router.get("/dashboard/revenue-chart", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company membership" }); return; }

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
  if (!info) { res.status(403).json({ error: "No company membership" }); return; }

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

export default router;
