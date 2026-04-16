import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import { requireAuth } from "../lib/rbac";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

router.get("/companies", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.name);
  res.json(companies.map(serializeCompany));
});

router.post("/companies", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, legalName, taxNumber, registrationNumber, email, phone, address, city, country } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [company] = await db
    .insert(companiesTable)
    .values({ name, legalName, taxNumber, registrationNumber, email, phone, address, city, country })
    .returning();
  await createAuditLog({
    userId: req.isAuthenticated() ? req.user.id : undefined,
    action: "create",
    entity: "company",
    entityId: String(company!.id),
    newValues: company,
  });
  res.status(201).json(serializeCompany(company!));
});

router.get("/companies/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id)).limit(1);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  res.json(serializeCompany(company));
});

router.patch("/companies/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, legalName, taxNumber, registrationNumber, email, phone, address, city, country } = req.body;
  const [company] = await db
    .update(companiesTable)
    .set({ name, legalName, taxNumber, registrationNumber, email, phone, address, city, country })
    .where(eq(companiesTable.id, id))
    .returning();
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  res.json(serializeCompany(company));
});

function serializeCompany(c: typeof companiesTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export default router;
