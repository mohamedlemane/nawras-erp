import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, companiesTable, usersTable, userCompanyTable, rolesTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, isPlatformSuperAdmin } from "../lib/rbac";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

// ── Helper: generate subdomain from company name ──────────────────────────────
function generateSubdomain(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 63);
}

// ── PUBLIC: Get company info by subdomain (no auth required) ──────────────────
router.get("/public/company-by-subdomain", async (req: Request, res: Response): Promise<void> => {
  const subdomain = typeof req.query.subdomain === "string" ? req.query.subdomain.trim() : null;
  if (!subdomain) { res.status(400).json({ error: "subdomain requis" }); return; }

  const [company] = await db
    .select({ id: companiesTable.id, name: companiesTable.name, logo: companiesTable.logo, subdomain: companiesTable.subdomain, status: companiesTable.status })
    .from(companiesTable)
    .where(eq(companiesTable.subdomain, subdomain))
    .limit(1);

  if (!company) { res.status(404).json({ error: "Entreprise introuvable" }); return; }
  if (company.status !== "active") { res.status(403).json({ error: "Compte suspendu" }); return; }

  res.json(company);
});

// ── List all companies (PLATFORM SUPER ADMIN ONLY) ───────────────────────────
router.get("/companies", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!isPlatformSuperAdmin(req)) {
    res.status(403).json({ error: "Accès réservé au super administrateur de la plateforme." });
    return;
  }
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.name);

  const result = await Promise.all(
    companies.map(async (c) => {
      const admin = await db
        .select({
          id: usersTable.id, email: usersTable.email,
          firstName: usersTable.firstName, lastName: usersTable.lastName, roleName: rolesTable.name,
        })
        .from(userCompanyTable)
        .innerJoin(usersTable, eq(userCompanyTable.userId, usersTable.id))
        .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
        .where(and(eq(userCompanyTable.companyId, c.id), eq(rolesTable.name, "super_admin")))
        .limit(1);

      return { ...serializeCompany(c), admin: admin[0] ?? null };
    })
  );

  res.json(result);
});

// ── Create company (PLATFORM SUPER ADMIN ONLY) ───────────────────────────────
router.post("/companies", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!isPlatformSuperAdmin(req)) {
    res.status(403).json({ error: "Seul le super administrateur de la plateforme peut créer des entreprises." });
    return;
  }
  const {
    name, subdomain: rawSubdomain, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
    logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode,
    adminEmail, adminFirstName, adminLastName, adminPassword,
  } = req.body;

  if (!name) { res.status(400).json({ error: "Le nom de l'entreprise est requis" }); return; }
  if (!adminEmail) { res.status(400).json({ error: "L'email de l'administrateur est requis" }); return; }

  // Generate or clean subdomain
  const subdomain = rawSubdomain ? generateSubdomain(rawSubdomain) : generateSubdomain(name);
  if (!subdomain) { res.status(400).json({ error: "Impossible de générer un sous-domaine valide" }); return; }

  // Check subdomain uniqueness
  const [existingSub] = await db.select({ id: companiesTable.id }).from(companiesTable)
    .where(eq(companiesTable.subdomain, subdomain)).limit(1);
  if (existingSub) {
    res.status(409).json({ error: `Le sous-domaine "${subdomain}" est déjà utilisé`, subdomain });
    return;
  }

  const [company] = await db
    .insert(companiesTable)
    .values({ name, subdomain, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
      logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode })
    .returning();

  const passwordHash = adminPassword ? bcrypt.hashSync(adminPassword, 10) : null;

  let [adminUser] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail)).limit(1);
  if (!adminUser) {
    [adminUser] = await db.insert(usersTable).values({
      email: adminEmail, firstName: adminFirstName ?? null, lastName: adminLastName ?? null, passwordHash,
    }).returning();
  } else {
    const updates: Record<string, any> = {};
    if (adminFirstName) updates.firstName = adminFirstName;
    if (adminLastName) updates.lastName = adminLastName;
    if (passwordHash) updates.passwordHash = passwordHash;
    if (Object.keys(updates).length > 0) {
      [adminUser] = await db.update(usersTable).set(updates).where(eq(usersTable.id, adminUser!.id)).returning();
    }
  }

  const [superAdminRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, "super_admin")).limit(1);

  const existing = await db.select().from(userCompanyTable)
    .where(and(eq(userCompanyTable.userId, adminUser!.id), eq(userCompanyTable.companyId, company!.id))).limit(1);
  if (!existing[0]) {
    await db.insert(userCompanyTable).values({ userId: adminUser!.id, companyId: company!.id, roleId: superAdminRole?.id ?? null });
  }

  await createAuditLog({
    userId: req.isAuthenticated() ? req.user.id : undefined,
    action: "create", entity: "company", entityId: String(company!.id),
    newValues: { ...company, adminEmail },
  });

  res.status(201).json({
    ...serializeCompany(company!),
    admin: { id: adminUser!.id, email: adminUser!.email, firstName: adminUser!.firstName, lastName: adminUser!.lastName, roleName: superAdminRole?.name ?? null },
  });
});

// ── Get my company ────────────────────────────────────────────────────────────
router.get("/companies/mine", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(404).json({ error: "No company associated with this user" }); return; }
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, info.companyId)).limit(1);
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  res.json(serializeCompany(company));
});

// ── Update my company ─────────────────────────────────────────────────────────
router.patch("/companies/mine", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(404).json({ error: "No company associated with this user" }); return; }

  const { name, subdomain: rawSubdomain, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
    logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode } = req.body;

  const updates: Record<string, any> = { name, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
    logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode };

  if (rawSubdomain !== undefined) {
    const cleaned = generateSubdomain(rawSubdomain);
    const [existing] = await db.select({ id: companiesTable.id }).from(companiesTable)
      .where(eq(companiesTable.subdomain, cleaned)).limit(1);
    if (existing && existing.id !== info.companyId) {
      res.status(409).json({ error: `Le sous-domaine "${cleaned}" est déjà utilisé` }); return;
    }
    updates.subdomain = cleaned;
  }

  const [company] = await db.update(companiesTable).set(updates).where(eq(companiesTable.id, info.companyId)).returning();
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  await createAuditLog({ userId: req.user.id, action: "update", entity: "company", entityId: String(company.id), newValues: company });
  res.json(serializeCompany(company));
});

// ── Get company by ID ─────────────────────────────────────────────────────────
router.get("/companies/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id)).limit(1);
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  res.json(serializeCompany(company));
});

// ── Update company by ID (PLATFORM SUPER ADMIN ONLY) ─────────────────────────
router.patch("/companies/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!isPlatformSuperAdmin(req)) {
    res.status(403).json({ error: "Seul le super administrateur de la plateforme peut modifier d'autres entreprises." });
    return;
  }
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, subdomain: rawSubdomain, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
    logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode, status } = req.body;

  const updates: Record<string, any> = { name, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
    logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode, status };

  if (rawSubdomain !== undefined) {
    const cleaned = generateSubdomain(rawSubdomain);
    const [existing] = await db.select({ id: companiesTable.id }).from(companiesTable)
      .where(eq(companiesTable.subdomain, cleaned)).limit(1);
    if (existing && existing.id !== id) {
      res.status(409).json({ error: `Le sous-domaine "${cleaned}" est déjà utilisé` }); return;
    }
    updates.subdomain = cleaned;
  }

  const [company] = await db.update(companiesTable).set(updates).where(eq(companiesTable.id, id)).returning();
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  res.json(serializeCompany(company));
});

function serializeCompany(c: typeof companiesTable.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() };
}

export default router;
