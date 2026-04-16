import { integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { rolesTable } from "./roles";

// Extension of the base users table — links Replit users to companies and roles
export const userCompanyTable = pgTable("user_company", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").references(() => rolesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UserCompany = typeof userCompanyTable.$inferSelect;
