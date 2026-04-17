import { db, usersTable } from ".";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "admin@nawras.mr";
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "Admin@2025!";

async function seed() {
  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, EMAIL)).limit(1);

  if (existing[0]) {
    const [updated] = await db.update(usersTable)
      .set({ isSuperAdmin: true, passwordHash })
      .where(eq(usersTable.email, EMAIL))
      .returning();
    console.log(`Super admin mis à jour : ${updated!.email}`);
  } else {
    const [user] = await db.insert(usersTable).values({
      email: EMAIL,
      firstName: "Super",
      lastName: "Admin",
      passwordHash,
      isSuperAdmin: true,
    }).returning();
    console.log(`Super admin créé : ${user!.email}`);
  }

  console.log(`\nIdentifiants de connexion :`);
  console.log(`  Email    : ${EMAIL}`);
  console.log(`  Password : ${PASSWORD}`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
