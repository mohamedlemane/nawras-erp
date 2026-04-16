import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  userId: varchar("user_id"),
  userEmail: varchar("user_email", { length: 255 }),
  action: varchar("action", { length: 50 }).notNull(),
  entity: varchar("entity", { length: 100 }).notNull(),
  entityId: varchar("entity_id"),
  oldValues: text("old_values"),
  newValues: text("new_values"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
