import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, usersTable, userCompanyTable, rolesTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany } from "../lib/rbac";

const router: IRouter = Router();

router.get("/users", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

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
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(eq(userCompanyTable.companyId, info.companyId))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .where(eq(userCompanyTable.companyId, info.companyId));

  res.json({
    data: members.map(serializeUser),
    total: count,
    page,
    limit,
  });
});

router.post("/users", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { email, firstName, lastName, roleId } = req.body;
  if (!email || !roleId) {
    res.status(400).json({ error: "email and roleId are required" });
    return;
  }

  // Check if user exists
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    // Create placeholder user
    [user] = await db.insert(usersTable).values({ email, firstName, lastName }).returning();
  }

  // Check if already in company
  const existing = await db
    .select()
    .from(userCompanyTable)
    .where(and(eq(userCompanyTable.userId, user!.id), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  if (!existing[0]) {
    await db.insert(userCompanyTable).values({ userId: user!.id, companyId: info.companyId, roleId });
  } else {
    await db.update(userCompanyTable).set({ roleId }).where(eq(userCompanyTable.id, existing[0].id));
  }

  const [result] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      companyId: userCompanyTable.companyId,
      roleId: userCompanyTable.roleId,
      roleName: rolesTable.name,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.id, user!.id), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  res.status(201).json(serializeUser(result!));
});

router.get("/users/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [result] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      companyId: userCompanyTable.companyId,
      roleId: userCompanyTable.roleId,
      roleName: rolesTable.name,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.id, raw), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(serializeUser(result));
});

router.patch("/users/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { firstName, lastName, roleId } = req.body;

  if (firstName !== undefined || lastName !== undefined) {
    await db.update(usersTable).set({ firstName, lastName }).where(eq(usersTable.id, raw));
  }

  if (roleId !== undefined) {
    await db
      .update(userCompanyTable)
      .set({ roleId })
      .where(and(eq(userCompanyTable.userId, raw), eq(userCompanyTable.companyId, info.companyId)));
  }

  const [result] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      companyId: userCompanyTable.companyId,
      roleId: userCompanyTable.roleId,
      roleName: rolesTable.name,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .innerJoin(userCompanyTable, eq(usersTable.id, userCompanyTable.userId))
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.id, raw), eq(userCompanyTable.companyId, info.companyId)))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(serializeUser(result));
});

router.delete("/users/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db
    .delete(userCompanyTable)
    .where(and(eq(userCompanyTable.userId, raw), eq(userCompanyTable.companyId, info.companyId)));

  res.sendStatus(204);
});

function serializeUser(u: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  companyId: number;
  roleId: number | null;
  roleName: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...u,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export default router;
