import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, rolesTable, permissionsTable, rolePermissionsTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany } from "../lib/rbac";
import { handleDbError } from "../lib/db-errors";

const router: IRouter = Router();

router.get("/permissions", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const perms = await db.select().from(permissionsTable).orderBy(permissionsTable.module, permissionsTable.name);
  res.json(perms.map((p) => ({ id: p.id, name: p.name, description: p.description, module: p.module })));
});

router.get("/roles", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.name);
  res.json(
    roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
    }))
  );
});

router.post("/roles", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { name, description } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Le nom du rôle est requis" }); return; }

  const existing = await db.select().from(rolesTable).where(eq(rolesTable.name, name.trim())).limit(1);
  if (existing[0]) { res.status(409).json({ error: "Un rôle avec ce nom existe déjà" }); return; }

  const [role] = await db.insert(rolesTable).values({
    name: name.trim(),
    description: description?.trim() || null,
    isSystem: false,
    companyId: info.companyId,
  }).returning();

  res.status(201).json({ id: role!.id, name: role!.name, description: role!.description, isSystem: role!.isSystem });
});

router.patch("/roles/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!role) { res.status(404).json({ error: "Rôle introuvable" }); return; }
  if (role.isSystem) { res.status(403).json({ error: "Les rôles système ne peuvent pas être modifiés" }); return; }

  const { name, description } = req.body;
  const updates: Partial<typeof role> = {};
  if (name?.trim()) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;

  const [updated] = await db.update(rolesTable).set(updates).where(eq(rolesTable.id, id)).returning();
  res.json({ id: updated!.id, name: updated!.name, description: updated!.description, isSystem: updated!.isSystem });
});

router.delete("/roles/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!role) { res.status(404).json({ error: "Rôle introuvable" }); return; }
  if (role.isSystem) { res.status(403).json({ error: "Les rôles système ne peuvent pas être supprimés" }); return; }

  try {
    await db.delete(rolesTable).where(eq(rolesTable.id, id));
    res.sendStatus(204);
  } catch (err) {
    if (!handleDbError(err, res, "role")) throw err;
  }
});

router.get("/roles/:id/permissions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!role) { res.status(404).json({ error: "Rôle introuvable" }); return; }

  const perms = await db
    .select({ name: permissionsTable.name })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(eq(rolePermissionsTable.roleId, id));

  res.json({ id: role.id, name: role.name, description: role.description, isSystem: role.isSystem, permissions: perms.map((p) => p.name) });
});

router.put("/roles/:id/permissions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!role) { res.status(404).json({ error: "Rôle introuvable" }); return; }

  const { permissions } = req.body as { permissions: string[] };
  if (!Array.isArray(permissions)) { res.status(400).json({ error: "permissions must be an array" }); return; }

  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));

  if (permissions.length > 0) {
    const permRecords = await db.select().from(permissionsTable).where(inArray(permissionsTable.name, permissions));
    if (permRecords.length > 0) {
      await db.insert(rolePermissionsTable).values(permRecords.map((p) => ({ roleId: id, permissionId: p.id })));
    }
  }

  const perms = await db
    .select({ name: permissionsTable.name })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(eq(rolePermissionsTable.roleId, id));

  res.json({ id: role.id, name: role.name, description: role.description, isSystem: role.isSystem, permissions: perms.map((p) => p.name) });
});

export default router;
