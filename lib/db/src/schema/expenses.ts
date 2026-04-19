import { boolean, decimal, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

// ── Types de dépenses (paramétrable par entreprise) ─────────────────────────
export const expenseTypesTable = pgTable("expense_types", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 20 }).default("#6366f1"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Dépenses ─────────────────────────────────────────────────────────────────
export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  expenseTypeId: integer("expense_type_id").references(() => expenseTypesTable.id, { onDelete: "set null" }),
  reference: varchar("reference", { length: 50 }),
  label: text("label").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 10 }).notNull().default("MRU"),
  expenseDate: timestamp("expense_date", { withTimezone: true }).notNull().defaultNow(),
  paymentMethod: varchar("payment_method", { length: 30 }).default("cash"),
  status: varchar("status", { length: 20 }).notNull().default("paid"),
  supplier: text("supplier"),
  invoiceRef: varchar("invoice_ref", { length: 100 }),
  projectId: integer("project_id"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Zod schemas
export const insertExpenseTypeSchema = createInsertSchema(expenseTypesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ExpenseType = typeof expenseTypesTable.$inferSelect;
export type Expense = typeof expensesTable.$inferSelect;
export type InsertExpenseType = z.infer<typeof insertExpenseTypeSchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
