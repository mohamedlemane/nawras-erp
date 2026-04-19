import { boolean, decimal, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { partnersTable } from "./billing";

// ── Consultations / RFQ ───────────────────────────────────────────────────────
// Une consultation = demande entrante d'un client (RFQ/RFP)
export const consultationsTable = pgTable("consultations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),

  reference: varchar("reference", { length: 50 }),                   // RFQ-2025-001
  title: text("title").notNull(),                                     // Objet de la consultation
  partnerId: integer("partner_id").references(() => partnersTable.id), // Client demandeur
  clientRef: varchar("client_ref", { length: 100 }),                  // Référence client
  type: varchar("type", { length: 50 }).notNull().default("rfq"),    // rfq | rfp | appel_offre | gre_a_gre

  // Types de prestations demandées
  serviceTypes: text("service_types"),                               // JSON array: ["geotechnique","bathymetrie","essais",...]

  description: text("description"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  deadlineAt: timestamp("deadline_at", { withTimezone: true }),       // Date limite de réponse

  // Statut du processus commercial
  status: varchar("status", { length: 30 }).notNull().default("recu"),
  // recu → en_etude → proposition_envoyee → en_negociation → attribue | perdu | annule

  // Résultat
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
// Un projet = consultation attribuée → réalisation → facturation
export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),

  reference: varchar("reference", { length: 50 }),                   // PRJ-2025-001
  title: text("title").notNull(),
  consultationId: integer("consultation_id").references(() => consultationsTable.id),
  partnerId: integer("partner_id").references(() => partnersTable.id), // Client

  // Types de prestations réalisées
  serviceTypes: text("service_types"),                               // JSON array

  // Statut projet
  status: varchar("status", { length: 30 }).notNull().default("preparation"),
  // preparation → mobilisation → en_cours → suspendu → achevement → facture | clot

  // Dates
  startDate: timestamp("start_date", { withTimezone: true }),
  endDatePlanned: timestamp("end_date_planned", { withTimezone: true }),
  endDateActual: timestamp("end_date_actual", { withTimezone: true }),

  // Valeur contractuelle
  contractAmount: decimal("contract_amount", { precision: 14, scale: 2 }),
  currency: varchar("currency", { length: 10 }).notNull().default("MRU"),

  // Responsables
  commercialManager: varchar("commercial_manager"),                  // Nom ou ID utilisateur
  technicalManager: varchar("technical_manager"),
  hseManager: varchar("hse_manager"),

  // Documents & cahier des charges
  specifications: text("specifications"),                            // Résumé du cahier des charges
  contractualTerms: text("contractual_terms"),                       // Conditions contractuelles

  // Localisation
  onshore: boolean("onshore").notNull().default(true),
  offshore: boolean("offshore").notNull().default(false),
  location: text("location"),                                        // Description géographique

  // Facturation
  billingStatus: varchar("billing_status", { length: 30 }).notNull().default("non_facture"),
  // non_facture | en_cours | partiellement_facture | facture | regle

  notes: text("notes"),
  createdBy: varchar("created_by"),
  updatedBy: varchar("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ── Sites de projet ───────────────────────────────────────────────────────────
// Un projet peut avoir plusieurs sites (onshore / offshore)
export const projectSitesTable = pgTable("project_sites", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),

  name: text("name").notNull(),                                       // Nom du site
  type: varchar("type", { length: 20 }).notNull().default("onshore"), // onshore | offshore
  location: text("location"),                                         // Coordonnées / description
  waterDepth: decimal("water_depth", { precision: 8, scale: 2 }),    // Profondeur eau (offshore)

  status: varchar("status", { length: 20 }).notNull().default("planifie"),
  // planifie | mobilisation | en_cours | termine

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

  reference: varchar("reference", { length: 50 }),                   // RPT-2025-001
  type: varchar("type", { length: 30 }).notNull().default("avancement"),
  // avancement | journalier | hebdomadaire | final | hse | incident

  title: text("title").notNull(),
  reportDate: timestamp("report_date", { withTimezone: true }).notNull().defaultNow(),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),

  // Contenu
  summary: text("summary"),                                          // Résumé des travaux
  progressPercent: integer("progress_percent").notNull().default(0), // 0-100
  issuesEncountered: text("issues_encountered"),
  nextSteps: text("next_steps"),
  hseObservations: text("hse_observations"),                         // Observations HSE

  author: varchar("author"),                                         // Auteur du rapport
  status: varchar("status", { length: 20 }).notNull().default("brouillon"),
  // brouillon | soumis | valide | transmis_client

  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
