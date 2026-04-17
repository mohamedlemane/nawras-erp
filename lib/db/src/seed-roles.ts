import { db, rolesTable, permissionsTable, rolePermissionsTable } from "./index";
import { eq, inArray } from "drizzle-orm";

const PERMISSIONS: { name: string; description: string; module: string }[] = [
  // Facturation
  { name: "billing.view", description: "Voir le module facturation", module: "billing" },
  { name: "billing.quotes.create", description: "Créer des devis", module: "billing" },
  { name: "billing.quotes.edit", description: "Modifier des devis", module: "billing" },
  { name: "billing.quotes.delete", description: "Supprimer des devis", module: "billing" },
  { name: "billing.proformas.create", description: "Créer des proformas", module: "billing" },
  { name: "billing.proformas.edit", description: "Modifier des proformas", module: "billing" },
  { name: "billing.proformas.delete", description: "Supprimer des proformas", module: "billing" },
  { name: "billing.invoices.create", description: "Créer des factures", module: "billing" },
  { name: "billing.invoices.edit", description: "Modifier des factures", module: "billing" },
  { name: "billing.invoices.delete", description: "Supprimer des factures", module: "billing" },
  { name: "billing.payments.manage", description: "Gérer les paiements", module: "billing" },
  { name: "billing.partners.view", description: "Voir les partenaires", module: "billing" },
  { name: "billing.partners.manage", description: "Gérer les partenaires", module: "billing" },
  { name: "billing.products.view", description: "Voir les produits/services", module: "billing" },
  { name: "billing.products.manage", description: "Gérer les produits/services", module: "billing" },
  // RH
  { name: "hr.view", description: "Voir le module RH", module: "hr" },
  { name: "hr.employees.manage", description: "Gérer les employés", module: "hr" },
  { name: "hr.departments.manage", description: "Gérer les départements", module: "hr" },
  { name: "hr.contracts.manage", description: "Gérer les contrats", module: "hr" },
  { name: "hr.leaves.manage", description: "Gérer les congés", module: "hr" },
  { name: "hr.attendance.manage", description: "Gérer les présences", module: "hr" },
  { name: "hr.documents.manage", description: "Gérer les documents RH", module: "hr" },
  // Paramètres
  { name: "settings.view", description: "Voir les paramètres", module: "settings" },
  { name: "settings.manage", description: "Modifier les paramètres", module: "settings" },
  // Administration
  { name: "admin.users.manage", description: "Gérer les utilisateurs", module: "admin" },
  { name: "admin.roles.manage", description: "Gérer les rôles et permissions", module: "admin" },
  { name: "admin.audit.view", description: "Voir le journal d'activité", module: "admin" },
];

const DEFAULT_ROLES: {
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}[] = [
  {
    name: "super_admin",
    description: "Accès complet à toutes les fonctionnalités",
    isSystem: true,
    permissions: PERMISSIONS.map((p) => p.name),
  },
  {
    name: "manager",
    description: "Accès complet sauf gestion des rôles et utilisateurs",
    isSystem: true,
    permissions: PERMISSIONS.filter(
      (p) => !["admin.users.manage", "admin.roles.manage"].includes(p.name)
    ).map((p) => p.name),
  },
  {
    name: "comptable",
    description: "Accès au module facturation uniquement",
    isSystem: true,
    permissions: PERMISSIONS.filter((p) => p.module === "billing").map((p) => p.name),
  },
  {
    name: "rh_manager",
    description: "Accès au module RH uniquement",
    isSystem: true,
    permissions: PERMISSIONS.filter((p) => p.module === "hr" || p.name === "settings.view").map(
      (p) => p.name
    ),
  },
  {
    name: "employe",
    description: "Accès en lecture seule aux modules autorisés",
    isSystem: true,
    permissions: ["billing.view", "billing.partners.view", "billing.products.view", "hr.view"],
  },
];

async function seed() {
  console.log("Seeding permissions...");

  // Upsert permissions
  for (const perm of PERMISSIONS) {
    const existing = await db
      .select()
      .from(permissionsTable)
      .where(eq(permissionsTable.name, perm.name))
      .limit(1);

    if (!existing[0]) {
      await db.insert(permissionsTable).values(perm);
      console.log(`  + permission: ${perm.name}`);
    }
  }

  console.log("Seeding default roles...");

  for (const roleDef of DEFAULT_ROLES) {
    let role = (
      await db.select().from(rolesTable).where(eq(rolesTable.name, roleDef.name)).limit(1)
    )[0];

    if (!role) {
      [role] = await db
        .insert(rolesTable)
        .values({
          name: roleDef.name,
          description: roleDef.description,
          isSystem: roleDef.isSystem,
        })
        .returning();
      console.log(`  + role: ${roleDef.name}`);
    }

    // Set permissions
    const permRecords = await db
      .select()
      .from(permissionsTable)
      .where(inArray(permissionsTable.name, roleDef.permissions));

    await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, role!.id));

    if (permRecords.length > 0) {
      await db.insert(rolePermissionsTable).values(
        permRecords.map((p) => ({ roleId: role!.id, permissionId: p.id }))
      );
    }
    console.log(`  ✓ ${roleDef.name}: ${permRecords.length} permissions`);
  }

  console.log("Done.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
