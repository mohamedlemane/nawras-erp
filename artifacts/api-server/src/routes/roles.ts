import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, rolesTable, permissionsTable, rolePermissionsTable } from "@workspace/db";
import { requireAuth } from "../lib/rbac";

const router: IRouter = Router();

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

router.get("/roles/:id/permissions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const perms = await db
    .select({ name: permissionsTable.name })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(eq(rolePermissionsTable.roleId, id));

  res.json({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: perms.map((p) => p.name),
  });
});

router.put("/roles/:id/permissions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const { permissions } = req.body as { permissions: string[] };
  if (!Array.isArray(permissions)) {
    res.status(400).json({ error: "permissions must be an array" });
    return;
  }

  // Delete existing
  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, id));

  if (permissions.length > 0) {
    const permRecords = await db
      .select()
      .from(permissionsTable)
      .where(inArray(permissionsTable.name, permissions));

    if (permRecords.length > 0) {
      await db.insert(rolePermissionsTable).values(
        permRecords.map((p) => ({ roleId: id, permissionId: p.id }))
      );
    }
  }

  const perms = await db
    .select({ name: permissionsTable.name })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(eq(rolePermissionsTable.roleId, id));

  res.json({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: perms.map((p) => p.name),
  });
});

export default router;
