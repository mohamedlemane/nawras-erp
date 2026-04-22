import { date, decimal, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

// Departments
export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  managerId: integer("manager_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Positions
export const positionsTable = pgTable("positions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Employees
export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  employeeCode: varchar("employee_code", { length: 50 }).notNull(),
  nni: varchar("nni", { length: 50 }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  gender: varchar("gender", { length: 10 }),
  birthDate: date("birth_date"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  hireDate: date("hire_date").notNull(),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  positionId: integer("position_id").references(() => positionsTable.id),
  managerId: integer("manager_id"),
  employmentStatus: varchar("employment_status", { length: 20 }).notNull().default("active"),
  emergencyContact: text("emergency_contact"),
  notes: text("notes"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Contracts
export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  contractType: varchar("contract_type", { length: 20 }).notNull().default("cdi"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  salary: decimal("salary", { precision: 14, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Leave types
export const leaveTypesTable = pgTable("leave_types", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  daysAllowed: integer("days_allowed"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Leave requests
export const leaveRequestsTable = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  leaveTypeId: integer("leave_type_id").notNull().references(() => leaveTypesTable.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  daysCount: integer("days_count").notNull().default(1),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Attendances
export const attendancesTable = pgTable("attendances", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  checkIn: varchar("check_in", { length: 20 }),
  checkOut: varchar("check_out", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("present"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Employee documents
export const employeeDocumentsTable = pgTable("employee_documents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  fileUrl: text("file_url"),
  documentType: varchar("document_type", { length: 50 }).notNull().default("other"),
  uploadedBy: varchar("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractSchema = createInsertSchema(contractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Department = typeof departmentsTable.$inferSelect;
export type Position = typeof positionsTable.$inferSelect;
export type Employee = typeof employeesTable.$inferSelect;
export type Contract = typeof contractsTable.$inferSelect;
export type LeaveType = typeof leaveTypesTable.$inferSelect;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type Attendance = typeof attendancesTable.$inferSelect;
export type EmployeeDocument = typeof employeeDocumentsTable.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
