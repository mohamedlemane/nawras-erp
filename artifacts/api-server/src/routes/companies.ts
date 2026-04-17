import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, companiesTable, usersTable, userCompanyTable, rolesTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo } from "../lib/rbac";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

router.get("/companies", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const companies = await db.select().from(companiesTable).orderBy(companiesTable.name);

  // Attach admin user to each company
  const result = await Promise.all(
    companies.map(async (c) => {
      const admin = await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          roleName: rolesTable.name,
        })
        .from(userCompanyTable)
        .innerJoin(usersTable, eq(userCompanyTable.userId, usersTable.id))
        .leftJoin(rolesTable, eq(userCompanyTable.roleId, rolesTable.id))
        .where(
          and(
            eq(userCompanyTable.companyId, c.id),
            eq(rolesTable.name, "super_admin")
          )
        )
        .limit(1);

      return { ...serializeCompany(c), admin: admin[0] ?? null };
    })
  );

  res.json(result);
});

router.post("/companies", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const {
    name, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
    logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode,
    adminEmail, adminFirstName, adminLastName, adminPassword,
  } = req.body;

  if (!name) { res.status(400).json({ error: "Le nom de l'entreprise est requis" }); return; }
  if (!adminEmail) { res.status(400).json({ error: "L'email de l'administrateur est requis" }); return; }

  // Create the company
  const [company] = await db
    .insert(companiesTable)
    .values({ name, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
      logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode })
    .returning();

  // Hash password if provided
  const passwordHash = adminPassword ? bcrypt.hashSync(adminPassword, 10) : null;

  // Find or create the admin user
  let [adminUser] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail)).limit(1);
  if (!adminUser) {
    [adminUser] = await db.insert(usersTable).values({
      email: adminEmail,
      firstName: adminFirstName ?? null,
      lastName: adminLastName ?? null,
      passwordHash,
    }).returning();
  } else {
    // Update name and/or password if provided
    const updates: Record<string, any> = {};
    if (adminFirstName) updates.firstName = adminFirstName;
    if (adminLastName) updates.lastName = adminLastName;
    if (passwordHash) updates.passwordHash = passwordHash;
    if (Object.keys(updates).length > 0) {
      [adminUser] = await db.update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, adminUser!.id))
        .returning();
    }
  }

  // Find super_admin role
  const [superAdminRole] = await db.select().from(rolesTable).where(eq(rolesTable.name, "super_admin")).limit(1);

  // Link admin user to company with super_admin role
  const existing = await db.select().from(userCompanyTable)
    .where(and(eq(userCompanyTable.userId, adminUser!.id), eq(userCompanyTable.companyId, company!.id)))
    .limit(1);

  if (!existing[0]) {
    await db.insert(userCompanyTable).values({
      userId: adminUser!.id,
      companyId: company!.id,
      roleId: superAdminRole?.id ?? null,
    });
  }

  await createAuditLog({
    userId: req.isAuthenticated() ? req.user.id : undefined,
    action: "create",
    entity: "company",
    entityId: String(company!.id),
    newValues: { ...company, adminEmail },
  });

  res.status(201).json({
    ...serializeCompany(company!),
    admin: {
      id: adminUser!.id,
      email: adminUser!.email,
      firstName: adminUser!.firstName,
      lastName: adminUser!.lastName,
      roleName: superAdminRole?.name ?? null,
    },
  });
});

router.get("/companies/mine", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(404).json({ error: "No company associated with this user" }); return; }
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, info.companyId)).limit(1);
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  res.json(serializeCompany(company));
});

router.patch("/companies/mine", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(404).json({ error: "No company associated with this user" }); return; }
  const { name, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
    logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode } = req.body;
  const [company] = await db
    .update(companiesTable)
    .set({ name, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
      logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode })
    .where(eq(companiesTable.id, info.companyId))
    .returning();
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  await createAuditLog({
    userId: req.user.id, action: "update", entity: "company",
    entityId: String(company.id), newValues: company,
  });
  res.json(serializeCompany(company));
});

router.get("/companies/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id)).limit(1);
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  res.json(serializeCompany(company));
});

router.patch("/companies/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
    logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode, status } = req.body;
  const [company] = await db
    .update(companiesTable)
    .set({ name, legalName, taxNumber, registrationNumber, email, phone, address, city, country,
      logo, bankName, bankCode, branchCode, accountNumber, ribKey, rib, swiftCode, status })
    .where(eq(companiesTable.id, id))
    .returning();
  if (!company) { res.status(404).json({ error: "Company not found" }); return; }
  res.json(serializeCompany(company));
});

function serializeCompany(c: typeof companiesTable.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() };
}

export default router;
