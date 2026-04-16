import { type Request, type Response, type NextFunction } from "express";
import { db, rolePermissionsTable, permissionsTable, userCompanyTable, rolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// Get user permissions for their company
export async function getUserPermissions(userId: string, companyId: number): Promise<string[]> {
  const userCompany = await db
    .select()
    .from(userCompanyTable)
    .where(and(eq(userCompanyTable.userId, userId), eq(userCompanyTable.companyId, companyId)))
    .limit(1);

  if (!userCompany[0]?.roleId) return [];

  const perms = await db
    .select({ name: permissionsTable.name })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(eq(rolePermissionsTable.roleId, userCompany[0].roleId));

  return perms.map((p) => p.name);
}

// Get user's role and company info
export async function getUserCompanyInfo(userId: string) {
  const result = await db
    .select({
      companyId: userCompanyTable.companyId,
      roleId: userCompanyTable.roleId,
      roleName: rolesTable.name,
    })
    .from(userCompanyTable)
    .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
    .where(eq(userCompanyTable.userId, userId))
    .limit(1);

  return result[0] ?? null;
}

// Middleware: require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Middleware: require specific permission
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const info = await getUserCompanyInfo(req.user.id);
    if (!info) {
      res.status(403).json({ error: "No company membership found" });
      return;
    }

    // Super admin bypasses all checks
    if (info.roleName === "super_admin") {
      (req as any).companyId = info.companyId;
      next();
      return;
    }

    const perms = await getUserPermissions(req.user.id, info.companyId);
    if (!perms.includes(permission)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    (req as any).companyId = info.companyId;
    next();
  };
}

// Middleware: attach company id from user membership (no permission check)
export function attachCompany(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // companyId will be resolved in the route handler
  next();
}
