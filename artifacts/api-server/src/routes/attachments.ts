import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, projectAttachmentsTable } from "@workspace/db";
import { requirePermission } from "../lib/rbac";

const router: IRouter = Router();

function getCid(req: Request): number | null {
  return (req as any).companyId ?? null;
}

// ── Liste les pièces jointes d'une entité ─────────────────────────────────────
router.get(
  "/attachments/:entityType/:entityId",
  requirePermission("view_billing"),
  async (req: Request, res: Response): Promise<void> => {
    const cid = getCid(req);
    if (!cid) { res.json([]); return; }
    const { entityType, entityId } = req.params;
    const rows = await db
      .select()
      .from(projectAttachmentsTable)
      .where(
        and(
          eq(projectAttachmentsTable.companyId, cid),
          eq(projectAttachmentsTable.entityType, entityType),
          eq(projectAttachmentsTable.entityId, Number(entityId))
        )
      )
      .orderBy(projectAttachmentsTable.createdAt);
    res.json(rows);
  }
);

// ── Enregistre une pièce jointe après upload GCS ──────────────────────────────
router.post(
  "/attachments/:entityType/:entityId",
  requirePermission("create_invoice"),
  async (req: Request, res: Response): Promise<void> => {
    const cid = getCid(req);
    if (!cid) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
    const { entityType, entityId } = req.params;
    const { name, originalName, contentType, size, objectPath, externalUrl, category } = req.body;

    if (!name || !originalName || !contentType) {
      res.status(400).json({ error: "name, originalName, contentType requis" });
      return;
    }

    const [row] = await db.insert(projectAttachmentsTable).values({
      companyId: cid,
      entityType,
      entityId: Number(entityId),
      name,
      originalName,
      contentType,
      size: size ?? 0,
      objectPath: objectPath ?? null,
      externalUrl: externalUrl ?? null,
      category: category ?? "document",
      uploadedBy: req.user!.id,
    }).returning();

    res.status(201).json(row);
  }
);

// ── Supprime une pièce jointe ─────────────────────────────────────────────────
router.delete(
  "/attachments/:id",
  requirePermission("create_invoice"),
  async (req: Request, res: Response): Promise<void> => {
    const cid = getCid(req);
    if (!cid) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
    const id = Number(req.params.id);
    const [att] = await db.select().from(projectAttachmentsTable)
      .where(and(eq(projectAttachmentsTable.id, id), eq(projectAttachmentsTable.companyId, cid)));
    if (!att) { res.status(404).json({ error: "Pièce jointe introuvable" }); return; }
    await db.delete(projectAttachmentsTable).where(eq(projectAttachmentsTable.id, id));
    res.json({ success: true });
  }
);

export default router;
