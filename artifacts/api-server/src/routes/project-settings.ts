import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, projectServiceTypesTable, consultationTypesTable } from "@workspace/db";
import { requirePermission } from "../lib/rbac";
import { handleDbError } from "../lib/db-errors";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function cid(req: Request): number | null {
  return (req as any).companyId ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES DE PRESTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/project-service-types", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  const companyId = cid(req);
  if (!companyId) { res.json([]); return; }
  const rows = await db
    .select()
    .from(projectServiceTypesTable)
    .where(eq(projectServiceTypesTable.companyId, companyId))
    .orderBy(asc(projectServiceTypesTable.sortOrder), asc(projectServiceTypesTable.label));
  res.json(rows);
});

router.post("/project-service-types", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const companyId = cid(req);
  if (!companyId) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const { code, label, description, sortOrder } = req.body;
  if (!code || !label) { res.status(400).json({ error: "Code et libellé requis" }); return; }
  const [row] = await db.insert(projectServiceTypesTable).values({
    companyId,
    code: code.trim().toLowerCase().replace(/\s+/g, "_"),
    label: label.trim(),
    description: description ?? null,
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json(row);
});

router.patch("/project-service-types/:id", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const companyId = cid(req);
  if (!companyId) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const id = Number(req.params.id);
  const { code, label, description, isActive, sortOrder } = req.body;
  const [row] = await db.update(projectServiceTypesTable).set({
    ...(code !== undefined && { code: code.trim().toLowerCase().replace(/\s+/g, "_") }),
    ...(label !== undefined && { label: label.trim() }),
    ...(description !== undefined && { description }),
    ...(isActive !== undefined && { isActive }),
    ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
  }).where(and(eq(projectServiceTypesTable.id, id), eq(projectServiceTypesTable.companyId, companyId))).returning();
  if (!row) { res.status(404).json({ error: "Type introuvable" }); return; }
  res.json(row);
});

router.delete("/project-service-types/:id", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const companyId = cid(req);
  if (!companyId) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const id = Number(req.params.id);
  try {
    await db.delete(projectServiceTypesTable)
      .where(and(eq(projectServiceTypesTable.id, id), eq(projectServiceTypesTable.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    if (!handleDbError(err, res, "project_service_type")) throw err;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES DE CONSULTATION
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/project-consultation-types", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  const companyId = cid(req);
  if (!companyId) { res.json([]); return; }
  const rows = await db
    .select()
    .from(consultationTypesTable)
    .where(eq(consultationTypesTable.companyId, companyId))
    .orderBy(asc(consultationTypesTable.sortOrder), asc(consultationTypesTable.label));
  res.json(rows);
});

router.post("/project-consultation-types", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const companyId = cid(req);
  if (!companyId) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const { code, label, description, sortOrder } = req.body;
  if (!code || !label) { res.status(400).json({ error: "Code et libellé requis" }); return; }
  const [row] = await db.insert(consultationTypesTable).values({
    companyId,
    code: code.trim().toLowerCase().replace(/\s+/g, "_"),
    label: label.trim(),
    description: description ?? null,
    sortOrder: sortOrder ?? 0,
  }).returning();
  res.status(201).json(row);
});

router.patch("/project-consultation-types/:id", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const companyId = cid(req);
  if (!companyId) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const id = Number(req.params.id);
  const { code, label, description, isActive, sortOrder } = req.body;
  const [row] = await db.update(consultationTypesTable).set({
    ...(code !== undefined && { code: code.trim().toLowerCase().replace(/\s+/g, "_") }),
    ...(label !== undefined && { label: label.trim() }),
    ...(description !== undefined && { description }),
    ...(isActive !== undefined && { isActive }),
    ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
  }).where(and(eq(consultationTypesTable.id, id), eq(consultationTypesTable.companyId, companyId))).returning();
  if (!row) { res.status(404).json({ error: "Type introuvable" }); return; }
  res.json(row);
});

router.delete("/project-consultation-types/:id", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const companyId = cid(req);
  if (!companyId) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const id = Number(req.params.id);
  try {
    await db.delete(consultationTypesTable)
      .where(and(eq(consultationTypesTable.id, id), eq(consultationTypesTable.companyId, companyId)));
    res.json({ success: true });
  } catch (err) {
    if (!handleDbError(err, res, "project_consultation_type")) throw err;
  }
});

export default router;
