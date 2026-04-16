import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo } from "../lib/rbac";

const router: IRouter = Router();

router.get("/audit-logs", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const entity = typeof req.query.entity === "string" ? req.query.entity : undefined;
  const action = typeof req.query.action === "string" ? req.query.action : undefined;

  const conditions = [eq(auditLogsTable.companyId, info.companyId)];
  if (entity) conditions.push(eq(auditLogsTable.entity, entity));
  if (action) conditions.push(eq(auditLogsTable.action, action));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select().from(auditLogsTable).where(whereClause).limit(limit).offset(offset).orderBy(sql`created_at desc`);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLogsTable).where(whereClause);

  res.json({
    data: data.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    total: count,
    page,
    limit,
  });
});

export default router;
