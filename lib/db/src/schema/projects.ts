import { boolean, decimal, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { partnersTable } from "./billing";
import { employeesTable } from "./hr";

// ── Types de prestations paramétrables ───────────────────────────────────────
export const projectServiceTypesTable = pgTable("project_service_types", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  label: varchar("label", { length: 150 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Types de consultation paramétrables ───────────────────────────────────────
export const consultationTypesTable = pgTable("consultation_types", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }).notNull(),
  label: varchar("label", { length: 150 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Consultations / RFQ ───────────────────────────────────────────────────────
export const consultationsTable = pgTable("consultations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),

  reference: varchar("reference", { length: 50 }),
  title: text("title").notNull(),
  partnerId: integer("partner_id").references(() => partnersTable.id),
  clientRef: varchar("client_ref", { length: 100 }),
  type: varchar("type", { length: 50 }).notNull().default("rfq"),

  serviceTypes: text("service_types"),

  description: text("description"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),

  status: varchar("status", { length: 30 }).notNull().default("recu"),

  awardedAt: timestamp("awarded_at", { withTimezone: true }),
  lostReason: text("lost_reason"),
  estimatedAmount: decimal("estimated_amount", { precision: 14, scale: 2 }),
  currency: varchar("currency", { length: 10 }).notNull().default("MRU"),

  notes: text("notes"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Projets ───────────────────────────────────────────────────────────────────
export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),

  reference: varchar("reference", { length: 50 }),
  title: text("title").notNull(),
  consultationId: integer("consultation_id").references(() => consultationsTable.id),
  partnerId: integer("partner_id").references(() => partnersTable.id),

  serviceTypes: text("service_types"),

  status: varchar("status", { length: 30 }).notNull().default("preparation"),

  startDate: timestamp("start_date", { withTimezone: true }),
  endDatePlanned: timestamp("end_date_planned", { withTimezone: true }),
  endDateActual: timestamp("end_date_actual", { withTimezone: true }),

  contractAmount: decimal("contract_amount", { precision: 14, scale: 2 }),
  currency: varchar("currency", { length: 10 }).notNull().default("MRU"),

  // Responsables (varchar pour affichage + FK employé)
  commercialManager: varchar("commercial_manager"),
  commercialManagerId: integer("commercial_manager_id").references(() => employeesTable.id, { onDelete: "set null" }),
  technicalManager: varchar("technical_manager"),
  technicalManagerId: integer("technical_manager_id").references(() => employeesTable.id, { onDelete: "set null" }),
  hseManager: varchar("hse_manager"),
  hseManagerId: integer("hse_manager_id").references(() => employeesTable.id, { onDelete: "set null" }),

  specifications: text("specifications"),
  contractualTerms: text("contractual_terms"),

  onshore: boolean("onshore").notNull().default(true),
  offshore: boolean("offshore").notNull().default(false),
  location: text("location"),

  billingStatus: varchar("billing_status", { length: 30 }).notNull().default("non_facture"),

  notes: text("notes"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Sites de projet ───────────────────────────────────────────────────────────
export const projectSitesTable = pgTable("project_sites", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  type: varchar("type", { length: 20 }).notNull().default("onshore"),
  location: text("location"),
  waterDepth: decimal("water_depth", { precision: 8, scale: 2 }),

  status: varchar("status", { length: 20 }).notNull().default("planifie"),

  plannedStart: timestamp("planned_start", { withTimezone: true }),
  plannedEnd: timestamp("planned_end", { withTimezone: true }),
  actualStart: timestamp("actual_start", { withTimezone: true }),
  actualEnd: timestamp("actual_end", { withTimezone: true }),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Rapports d'avancement ─────────────────────────────────────────────────────
export const projectReportsTable = pgTable("project_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  siteId: integer("site_id").references(() => projectSitesTable.id),

  reference: varchar("reference", { length: 50 }),
  type: varchar("type", { length: 30 }).notNull().default("avancement"),

  title: text("title").notNull(),
  reportDate: timestamp("report_date", { withTimezone: true }).notNull().defaultNow(),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),

  summary: text("summary"),
  progressPercent: integer("progress_percent").notNull().default(0),
  issuesEncountered: text("issues_encountered"),
  nextSteps: text("next_steps"),
  hseObservations: text("hse_observations"),

  author: varchar("author"),
  status: varchar("status", { length: 20 }).notNull().default("brouillon"),

  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Pièces jointes ────────────────────────────────────────────────────────────
export const projectAttachmentsTable = pgTable("project_attachments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 30 }).notNull(), // 'consultation' | 'project' | 'report'
  entityId: integer("entity_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 100 }).notNull(),
  size: integer("size").notNull().default(0),
  objectPath: text("object_path"),         // chemin GCS (fichiers uploadés)
  externalUrl: text("external_url"),       // URL externe (liens)
  category: varchar("category", { length: 50 }).notNull().default("document"), // document | image | lien | autre
  uploadedBy: varchar("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectServiceType = typeof projectServiceTypesTable.$inferSelect;
export type ConsultationType = typeof consultationTypesTable.$inferSelect;
export type Consultation = typeof consultationsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type ProjectSite = typeof projectSitesTable.$inferSelect;
export type ProjectReport = typeof projectReportsTable.$inferSelect;
export type ProjectAttachment = typeof projectAttachmentsTable.$inferSelect;
