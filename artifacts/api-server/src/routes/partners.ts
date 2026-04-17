import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db, partnersTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany } from "../lib/rbac";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

router.get("/partners", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const type = typeof req.query.type === "string" ? req.query.type : undefined;

  const conditions = [eq(partnersTable.companyId, info.companyId)];
  if (type) conditions.push(eq(partnersTable.type, type));
  if (search) conditions.push(or(ilike(partnersTable.name, `%${search}%`), ilike(partnersTable.email!, `%${search}%`))!);

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
  const data = await db.select().from(partnersTable).where(whereClause).limit(limit).offset(offset).orderBy(partnersTable.name);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(partnersTable).where(whereClause);

  res.json({ data: data.map(ser), total: count, page, limit });
});

router.post("/partners", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { type, name, companyName, contactPerson, email, phone, whatsapp, address, city, country, taxNumber, notes } = req.body;
  if (!name || !type) { res.status(400).json({ error: "name and type are required" }); return; }

  const [partner] = await db.insert(partnersTable).values({ companyId: info.companyId, type, name, companyName, contactPerson, email, phone, whatsapp, address, city, country, taxNumber, notes, createdBy: req.user.id }).returning();
  await createAuditLog({ companyId: info.companyId, userId: req.user.id, userEmail: req.user.email ?? undefined, action: "create", entity: "partner", entityId: String(partner!.id) });
  res.status(201).json(ser(partner!));
});

router.get("/partners/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [partner] = await db.select().from(partnersTable).where(and(eq(partnersTable.id, id), eq(partnersTable.companyId, info.companyId))).limit(1);
  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }
  res.json(ser(partner));
});

router.patch("/partners/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { type, name, companyName, contactPerson, email, phone, whatsapp, address, city, country, taxNumber, notes, status } = req.body;
  const [partner] = await db.update(partnersTable).set({ type, name, companyName, contactPerson, email, phone, whatsapp, address, city, country, taxNumber, notes, status, updatedBy: req.user.id }).where(and(eq(partnersTable.id, id), eq(partnersTable.companyId, info.companyId))).returning();
  if (!partner) { res.status(404).json({ error: "Partner not found" }); return; }
  res.json(ser(partner));
});

router.delete("/partners/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(partnersTable).where(and(eq(partnersTable.id, id), eq(partnersTable.companyId, info.companyId)));
  res.sendStatus(204);
});

function ser(p: typeof partnersTable.$inferSelect) {
  return { ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
}

export default router;
