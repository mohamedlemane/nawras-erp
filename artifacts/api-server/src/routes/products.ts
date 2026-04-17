import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany } from "../lib/rbac";

const router: IRouter = Router();

router.get("/products", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const conditions = [eq(productsTable.companyId, info.companyId)];
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select().from(productsTable).where(whereClause).limit(limit).offset(offset).orderBy(productsTable.name);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(whereClause);
  res.json({ data: data.map(ser), total: count, page, limit });
});

router.post("/products", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { name, type, description, unitPrice, taxRate, sku } = req.body;
  if (!name || !type) { res.status(400).json({ error: "name and type are required" }); return; }

  const [product] = await db.insert(productsTable).values({ companyId: info.companyId, name, type, description, unitPrice: String(unitPrice ?? 0), taxRate: String(taxRate ?? 0), sku, createdBy: req.user.id }).returning();
  res.status(201).json(ser(product!));
});

router.get("/products/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.companyId, info.companyId))).limit(1);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(ser(product));
});

router.patch("/products/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, type, description, unitPrice, taxRate, sku, status } = req.body;
  const [product] = await db.update(productsTable).set({ name, type, description, unitPrice: unitPrice !== undefined ? String(unitPrice) : undefined, taxRate: taxRate !== undefined ? String(taxRate) : undefined, sku, status, updatedBy: req.user.id }).where(and(eq(productsTable.id, id), eq(productsTable.companyId, info.companyId))).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(ser(product));
});

router.delete("/products/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.companyId, info.companyId)));
  res.sendStatus(204);
});

function ser(p: typeof productsTable.$inferSelect) {
  return { ...p, unitPrice: Number(p.unitPrice), taxRate: Number(p.taxRate), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
}

export default router;
