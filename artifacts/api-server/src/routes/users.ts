import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { db, usersTable, userCompanyTable, rolesTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany, isPlatformSuperAdmin } from "../lib/rbac";

const router: IRouter = Router();

// ── List users in the current company ────────────────────────────────────────
router.get("/users", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;

  const baseWhere = eq(userCompanyTable.companyId, info.companyId);
  const whereClause = search
    ? and(baseWhere, or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.firstName, `%${search}%`),
        ilike(usersTable.lastName, `%${search}%`),
      ))
    : baseWhere;

  const members = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      companyId: userCompanyTable.companyId,
      roleId: userCompanyTable.roleId,
      roleName: rolesTable.name,
      isActive: userCompanyTable.isActive,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(whereClause!)
    .orderBy(usersTable.createdAt)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .where(baseWhere);

  res.json({ data: members.map(serializeUser), total: count, page, limit });
});

// ── Create a user and attach to the company ───────────────────────────────────
router.post("/users", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { email, firstName, lastName, roleId, password } = req.body;
  if (!email || !roleId) {
    res.status(400).json({ error: "email et roleId sont requis" });
    return;
  }
  if (password && password.length < 6) {
    res.status(400).json({ error: "Le mot de passe doit avoir au moins 6 caractères" });
    return;
  }

  // Block assigning super_admin role (platform admin only)
  const [selectedRole] = await db.select().from(rolesTable).where(eq(rolesTable.id, Number(roleId))).limit(1);
  if (!selectedRole) { res.status(400).json({ error: "Rôle introuvable" }); return; }
  if (selectedRole.name === "super_admin" && !isPlatformSuperAdmin(req)) {
    res.status(403).json({ error: "Seul le super administrateur de la plateforme peut assigner le rôle super_admin." });
    return;
  }

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    const values: any = { email, firstName: firstName || null, lastName: lastName || null };
    if (password) values.passwordHash = hashSync(password, 10);
    [user] = await db.insert(usersTable).values(values).returning();
  } else if (password) {
    [user] = await db.update(usersTable).set({ passwordHash: hashSync(password, 10) }).where(eq(usersTable.id, user!.id)).returning();
  }

  const existing = await db
    .select()
    .from(userCompanyTable)
    .where(and(eq(userCompanyTable.userId, user!.id), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  if (!existing[0]) {
    await db.insert(userCompanyTable).values({ userId: user!.id, companyId: info.companyId, roleId: Number(roleId), isActive: true });
  } else {
    await db.update(userCompanyTable).set({ roleId: Number(roleId), isActive: true }).where(eq(userCompanyTable.id, existing[0].id));
  }

  const [result] = await db
    .select({
      id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
      lastName: usersTable.lastName, profileImageUrl: usersTable.profileImageUrl,
      companyId: userCompanyTable.companyId, roleId: userCompanyTable.roleId,
      roleName: rolesTable.name, isActive: userCompanyTable.isActive,
      createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.id, user!.id), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  res.status(201).json(serializeUser(result!));
});

// ── Get one user ──────────────────────────────────────────────────────────────
router.get("/users/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [result] = await db
    .select({
      id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
      lastName: usersTable.lastName, profileImageUrl: usersTable.profileImageUrl,
      companyId: userCompanyTable.companyId, roleId: userCompanyTable.roleId,
      roleName: rolesTable.name, isActive: userCompanyTable.isActive,
      createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.id, raw), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  if (!result) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  res.json(serializeUser(result));
});

// ── Update role / profile ─────────────────────────────────────────────────────
router.patch("/users/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { firstName, lastName, roleId } = req.body;

  // Block assigning super_admin role
  if (roleId !== undefined && roleId !== null) {
    const [selectedRole] = await db.select().from(rolesTable).where(eq(rolesTable.id, Number(roleId))).limit(1);
    if (selectedRole?.name === "super_admin" && !isPlatformSuperAdmin(req)) {
      res.status(403).json({ error: "Seul le super administrateur peut assigner le rôle super_admin." });
      return;
    }
  }

  if (firstName !== undefined || lastName !== undefined) {
    await db.update(usersTable).set({ firstName, lastName }).where(eq(usersTable.id, raw));
  }
  if (roleId !== undefined) {
    await db.update(userCompanyTable).set({ roleId: roleId === null ? null : Number(roleId) })
      .where(and(eq(userCompanyTable.userId, raw), eq(userCompanyTable.companyId, info.companyId)));
  }

  const [result] = await db
    .select({
      id: usersTable.id, email: usersTable.email, firstName: usersTable.firstName,
      lastName: usersTable.lastName, profileImageUrl: usersTable.profileImageUrl,
      companyId: userCompanyTable.companyId, roleId: userCompanyTable.roleId,
      roleName: rolesTable.name, isActive: userCompanyTable.isActive,
      createdAt: usersTable.createdAt, updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.id, raw), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  if (!result) { res.status(404).json({ error: "Utilisateur introuvable" }); return; }
  res.json(serializeUser(result));
});

// ── Toggle active status (activate / deactivate) ──────────────────────────────
router.patch("/users/:id/status", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  // Cannot deactivate yourself
  if (raw === req.user.id) {
    res.status(403).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
    return;
  }

  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    res.status(400).json({ error: "isActive (boolean) est requis" });
    return;
  }

  const [membership] = await db
    .select()
    .from(userCompanyTable)
    .where(and(eq(userCompanyTable.userId, raw), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  if (!membership) { res.status(404).json({ error: "Utilisateur introuvable dans cette entreprise" }); return; }

  // Cannot deactivate a super_admin user (platform-level protection)
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, raw)).limit(1);
  if (targetUser?.isSuperAdmin && !isActive) {
    res.status(403).json({ error: "Impossible de désactiver un super administrateur de la plateforme." });
    return;
  }

  await db.update(userCompanyTable).set({ isActive })
    .where(and(eq(userCompanyTable.userId, raw), eq(userCompanyTable.companyId, info.companyId)));

  res.json({ success: true, isActive });
});

// ── Reset password ────────────────────────────────────────────────────────────
router.post("/users/:id/reset-password", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { password } = req.body;
  if (!password || password.length < 6) {
    res.status(400).json({ error: "Le mot de passe doit avoir au moins 6 caractères" });
    return;
  }

  const [membership] = await db
    .select()
    .from(userCompanyTable)
    .where(and(eq(userCompanyTable.userId, raw), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);
  if (!membership) { res.status(404).json({ error: "Utilisateur introuvable dans cette entreprise" }); return; }

  await db.update(usersTable).set({ passwordHash: hashSync(password, 10) }).where(eq(usersTable.id, raw));
  res.json({ success: true });
});

// ── DELETE is disabled — use /status to deactivate ───────────────────────────
router.delete("/users/:id", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  res.status(405).json({ error: "La suppression de compte est désactivée. Utilisez la désactivation." });
});

function serializeUser(u: {
  id: string; email: string | null; firstName: string | null; lastName: string | null;
  profileImageUrl: string | null; companyId: number; roleId: number | null;
  roleName: string | null | undefined; isActive: boolean; createdAt: Date; updatedAt: Date;
}) {
  return { ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() };
}

export default router;
