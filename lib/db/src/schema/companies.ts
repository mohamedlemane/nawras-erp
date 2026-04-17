import { pgTable, serial, text, timestamp, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subdomain: varchar("subdomain", { length: 63 }).unique(),
  legalName: text("legal_name"),
  taxNumber: varchar("tax_number", { length: 50 }),
  registrationNumber: varchar("registration_number", { length: 50 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Mauritanie"),
  logo: text("logo"),
  bankName: varchar("bank_name", { length: 100 }),
  bankCode: varchar("bank_code", { length: 20 }),
  branchCode: varchar("branch_code", { length: 20 }),
  accountNumber: varchar("account_number", { length: 30 }),
  ribKey: varchar("rib_key", { length: 5 }),
  rib: varchar("rib", { length: 30 }),
  swiftCode: varchar("swift_code", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
