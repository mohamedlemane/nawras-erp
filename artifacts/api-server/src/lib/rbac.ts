import { type Request, type Response, type NextFunction } from "express";
import { db, rolePermissionsTable, permissionsTable, userCompanyTable, rolesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

// Check if current request is from the platform super admin
export function isPlatformSuperAdmin(req: Request): boolean {
  return !!(req.user as any)?.isSuperAdmin;
}

// Handle missing company info — returns appropriate response based on context
// Returns true if response was sent (caller should return), false if not super admin
// `shape` controls the empty-list response shape for GET-list endpoints.
export function handleNoCompany(req: Request, res: Response, shape: "paginated" | "array" = "paginated"): boolean {
  if (!isPlatformSuperAdmin(req)) return false;

  const hasIdParam = !!req.params?.id;

  if (req.method === "GET" && !hasIdParam) {
    if (shape === "array") {
      res.json([]);
    } else {
      res.json({ data: [], total: 0, page: 1, limit: 20 });
    }
  } else if (req.method === "GET") {
    res.status(404).json({ error: "Ressource introuvable" });
  } else {
    res.status(403).json({
      error: "Le super admin de la plateforme doit se connecter en tant que gérant d'une entreprise pour cette action.",
    });
  }
  return true;
}

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

    // Platform super admin bypasses ALL permission checks
    if (isPlatformSuperAdmin(req)) {
      next();
      return;
    }

    const info = await getUserCompanyInfo(req.user.id);
    if (!info) {
      res.status(403).json({ error: "No company membership found" });
      return;
    }

    // Company super_admin role bypasses checks within their company
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
  next();
}
