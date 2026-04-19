import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, consultationsTable, projectsTable, projectSitesTable, projectReportsTable, employeesTable } from "@workspace/db";
import { requirePermission } from "../lib/rbac";

const router: IRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function genRef(prefix: string): string {
  const y = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}-${rand}`;
}

// ── CONSULTATIONS ─────────────────────────────────────────────────────────────

router.get("/consultations", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.json({ data: [], total: 0 }); return; }
  const cid = req.user!.company!.companyId;
  const rows = await db
    .select()
    .from(consultationsTable)
    .where(eq(consultationsTable.companyId, cid))
    .orderBy(desc(consultationsTable.createdAt));
  res.json({ data: rows, total: rows.length });
});

router.get("/consultations/:id", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(404).json({ error: "Non trouvé" }); return; }
  const cid = req.user!.company!.companyId;
  const [row] = await db.select().from(consultationsTable)
    .where(and(eq(consultationsTable.id, Number(req.params.id)), eq(consultationsTable.companyId, cid)));
  if (!row) { res.status(404).json({ error: "Consultation introuvable" }); return; }
  res.json(row);
});

router.post("/consultations", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const cid = req.user!.company!.companyId;
  const { title, partnerId, clientRef, type, serviceTypes, description, receivedAt, deadlineAt, estimatedAmount, currency, notes } = req.body;
  if (!title) { res.status(400).json({ error: "Titre requis" }); return; }

  const [row] = await db.insert(consultationsTable).values({
    companyId: cid,
    reference: genRef("RFQ"),
    title,
    partnerId: partnerId ? Number(partnerId) : null,
    clientRef: clientRef ?? null,
    type: type ?? "rfq",
    serviceTypes: serviceTypes ? JSON.stringify(serviceTypes) : null,
    description: description ?? null,
    receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
    deadlineAt: deadlineAt ? new Date(deadlineAt) : null,
    estimatedAmount: estimatedAmount ?? null,
    currency: currency ?? "MRU",
    notes: notes ?? null,
    createdBy: req.user!.id,
  }).returning();
  res.status(201).json(row);
});

router.patch("/consultations/:id", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const cid = req.user!.company!.companyId;
  const id = Number(req.params.id);
  const [exists] = await db.select({ id: consultationsTable.id }).from(consultationsTable)
    .where(and(eq(consultationsTable.id, id), eq(consultationsTable.companyId, cid)));
  if (!exists) { res.status(404).json({ error: "Consultation introuvable" }); return; }

  const allowed = ["title", "partnerId", "clientRef", "type", "serviceTypes", "description",
    "receivedAt", "deadlineAt", "status", "awardedAt", "lostReason", "estimatedAmount", "currency", "notes"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in req.body) {
      let v = req.body[k];
      if (k === "serviceTypes" && Array.isArray(v)) v = JSON.stringify(v);
      if (k === "partnerId") v = v ? Number(v) : null;
      if ((k === "receivedAt" || k === "deadlineAt" || k === "awardedAt") && v) v = new Date(v);
      const dbKey = k.replace(/([A-Z])/g, "_$1").toLowerCase() as keyof typeof consultationsTable.$inferInsert;
      (updates as any)[dbKey] = v;
    }
  }
  updates.updated_by = req.user!.id;

  const [row] = await db.update(consultationsTable).set(updates as any).where(eq(consultationsTable.id, id)).returning();
  res.json(row);
});

router.delete("/consultations/:id", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const cid = req.user!.company!.companyId;
  const id = Number(req.params.id);
  const [exists] = await db.select({ id: consultationsTable.id }).from(consultationsTable)
    .where(and(eq(consultationsTable.id, id), eq(consultationsTable.companyId, cid)));
  if (!exists) { res.status(404).json({ error: "Consultation introuvable" }); return; }
  await db.delete(consultationsTable).where(eq(consultationsTable.id, id));
  res.json({ success: true });
});

// ── PROJETS ───────────────────────────────────────────────────────────────────

router.get("/projects", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.json({ data: [], total: 0 }); return; }
  const cid = req.user!.company!.companyId;
  const rows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.companyId, cid))
    .orderBy(desc(projectsTable.createdAt));
  res.json({ data: rows, total: rows.length });
});

router.get("/projects/:id", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(404).json({ error: "Non trouvé" }); return; }
  const cid = req.user!.company!.companyId;
  const id = Number(req.params.id);
  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.companyId, cid)));
  if (!project) { res.status(404).json({ error: "Projet introuvable" }); return; }

  const sites = await db.select().from(projectSitesTable)
    .where(eq(projectSitesTable.projectId, id))
    .orderBy(projectSitesTable.id);
  const reports = await db.select().from(projectReportsTable)
    .where(eq(projectReportsTable.projectId, id))
    .orderBy(desc(projectReportsTable.reportDate));

  res.json({ ...project, sites, reports });
});

router.post("/projects", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const cid = req.user!.company!.companyId;
  const {
    title, consultationId, partnerId, serviceTypes, startDate, endDatePlanned,
    contractAmount, currency,
    commercialManager, commercialManagerId,
    technicalManager, technicalManagerId,
    hseManager, hseManagerId,
    specifications, contractualTerms, onshore, offshore, location, notes,
  } = req.body;
  if (!title) { res.status(400).json({ error: "Titre requis" }); return; }

  // Résoudre les noms depuis les IDs employés si fournis
  let resolvedCommercial = commercialManager ?? null;
  let resolvedTechnical = technicalManager ?? null;
  let resolvedHse = hseManager ?? null;

  if (commercialManagerId) {
    const [emp] = await db.select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
      .from(employeesTable).where(eq(employeesTable.id, Number(commercialManagerId)));
    if (emp) resolvedCommercial = `${emp.firstName} ${emp.lastName}`;
  }
  if (technicalManagerId) {
    const [emp] = await db.select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
      .from(employeesTable).where(eq(employeesTable.id, Number(technicalManagerId)));
    if (emp) resolvedTechnical = `${emp.firstName} ${emp.lastName}`;
  }
  if (hseManagerId) {
    const [emp] = await db.select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
      .from(employeesTable).where(eq(employeesTable.id, Number(hseManagerId)));
    if (emp) resolvedHse = `${emp.firstName} ${emp.lastName}`;
  }

  const [row] = await db.insert(projectsTable).values({
    companyId: cid,
    reference: genRef("PRJ"),
    title,
    consultationId: consultationId ? Number(consultationId) : null,
    partnerId: partnerId ? Number(partnerId) : null,
    serviceTypes: serviceTypes ? JSON.stringify(serviceTypes) : null,
    startDate: startDate ? new Date(startDate) : null,
    endDatePlanned: endDatePlanned ? new Date(endDatePlanned) : null,
    contractAmount: contractAmount ?? null,
    currency: currency ?? "MRU",
    commercialManager: resolvedCommercial,
    commercialManagerId: commercialManagerId ? Number(commercialManagerId) : null,
    technicalManager: resolvedTechnical,
    technicalManagerId: technicalManagerId ? Number(technicalManagerId) : null,
    hseManager: resolvedHse,
    hseManagerId: hseManagerId ? Number(hseManagerId) : null,
    specifications: specifications ?? null,
    contractualTerms: contractualTerms ?? null,
    onshore: onshore !== false,
    offshore: !!offshore,
    location: location ?? null,
    notes: notes ?? null,
    createdBy: req.user!.id,
  }).returning();
  res.status(201).json(row);
});

router.patch("/projects/:id", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const cid = req.user!.company!.companyId;
  const id = Number(req.params.id);
  const [exists] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.companyId, cid)));
  if (!exists) { res.status(404).json({ error: "Projet introuvable" }); return; }

  const allowed = ["title", "partnerId", "serviceTypes", "status", "startDate", "endDatePlanned",
    "endDateActual", "contractAmount", "currency",
    "commercialManager", "commercialManagerId",
    "technicalManager", "technicalManagerId",
    "hseManager", "hseManagerId",
    "specifications", "contractualTerms", "onshore", "offshore", "location",
    "billingStatus", "notes"];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in req.body) {
      let v = req.body[k];
      if (k === "serviceTypes" && Array.isArray(v)) v = JSON.stringify(v);
      if (["partnerId", "commercialManagerId", "technicalManagerId", "hseManagerId"].includes(k)) v = v ? Number(v) : null;
      if (["startDate","endDatePlanned","endDateActual"].includes(k) && v) v = new Date(v);
      const dbKey = k.replace(/([A-Z])/g, "_$1").toLowerCase();
      (updates as any)[dbKey] = v;
    }
  }

  // Résoudre les noms depuis les IDs si fournis
  if ("commercialManagerId" in req.body && req.body.commercialManagerId) {
    const [emp] = await db.select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
      .from(employeesTable).where(eq(employeesTable.id, Number(req.body.commercialManagerId)));
    if (emp) updates.commercial_manager = `${emp.firstName} ${emp.lastName}`;
  }
  if ("technicalManagerId" in req.body && req.body.technicalManagerId) {
    const [emp] = await db.select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
      .from(employeesTable).where(eq(employeesTable.id, Number(req.body.technicalManagerId)));
    if (emp) updates.technical_manager = `${emp.firstName} ${emp.lastName}`;
  }
  if ("hseManagerId" in req.body && req.body.hseManagerId) {
    const [emp] = await db.select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
      .from(employeesTable).where(eq(employeesTable.id, Number(req.body.hseManagerId)));
    if (emp) updates.hse_manager = `${emp.firstName} ${emp.lastName}`;
  }

  updates.updated_by = req.user!.id;

  const [row] = await db.update(projectsTable).set(updates as any).where(eq(projectsTable.id, id)).returning();
  res.json(row);
});

router.delete("/projects/:id", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const cid = req.user!.company!.companyId;
  const id = Number(req.params.id);
  const [exists] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.companyId, cid)));
  if (!exists) { res.status(404).json({ error: "Projet introuvable" }); return; }
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.json({ success: true });
});

// ── SITES ─────────────────────────────────────────────────────────────────────

router.get("/projects/:id/sites", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.json([]); return; }
  const cid = req.user!.company!.companyId;
  const id = Number(req.params.id);
  const [p] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.companyId, cid)));
  if (!p) { res.status(404).json({ error: "Projet introuvable" }); return; }
  const sites = await db.select().from(projectSitesTable).where(eq(projectSitesTable.projectId, id));
  res.json(sites);
});

router.post("/projects/:id/sites", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const cid = req.user!.company!.companyId;
  const projectId = Number(req.params.id);
  const [p] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.companyId, cid)));
  if (!p) { res.status(404).json({ error: "Projet introuvable" }); return; }

  const { name, type, location, waterDepth, plannedStart, plannedEnd, notes } = req.body;
  if (!name) { res.status(400).json({ error: "Nom du site requis" }); return; }

  const [row] = await db.insert(projectSitesTable).values({
    projectId,
    name,
    type: type ?? "onshore",
    location: location ?? null,
    waterDepth: waterDepth ?? null,
    plannedStart: plannedStart ? new Date(plannedStart) : null,
    plannedEnd: plannedEnd ? new Date(plannedEnd) : null,
    notes: notes ?? null,
  }).returning();
  res.status(201).json(row);
});

router.patch("/projects/:id/sites/:siteId", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const siteId = Number(req.params.siteId);
  const [s] = await db.select({ id: projectSitesTable.id }).from(projectSitesTable).where(eq(projectSitesTable.id, siteId));
  if (!s) { res.status(404).json({ error: "Site introuvable" }); return; }
  const { name, type, location, waterDepth, status, plannedStart, plannedEnd, actualStart, actualEnd, notes } = req.body;
  const [row] = await db.update(projectSitesTable).set({
    ...(name !== undefined && { name }),
    ...(type !== undefined && { type }),
    ...(location !== undefined && { location }),
    ...(waterDepth !== undefined && { waterDepth }),
    ...(status !== undefined && { status }),
    ...(plannedStart !== undefined && { plannedStart: plannedStart ? new Date(plannedStart) : null }),
    ...(plannedEnd !== undefined && { plannedEnd: plannedEnd ? new Date(plannedEnd) : null }),
    ...(actualStart !== undefined && { actualStart: actualStart ? new Date(actualStart) : null }),
    ...(actualEnd !== undefined && { actualEnd: actualEnd ? new Date(actualEnd) : null }),
    ...(notes !== undefined && { notes }),
  }).where(eq(projectSitesTable.id, siteId)).returning();
  res.json(row);
});

router.delete("/projects/:id/sites/:siteId", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const siteId = Number(req.params.siteId);
  await db.delete(projectSitesTable).where(eq(projectSitesTable.id, siteId));
  res.json({ success: true });
});

// ── RAPPORTS ──────────────────────────────────────────────────────────────────

router.get("/projects/:id/reports", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.json([]); return; }
  const cid = req.user!.company!.companyId;
  const id = Number(req.params.id);
  const [p] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.companyId, cid)));
  if (!p) { res.status(404).json({ error: "Projet introuvable" }); return; }
  const reports = await db.select().from(projectReportsTable)
    .where(eq(projectReportsTable.projectId, id))
    .orderBy(desc(projectReportsTable.reportDate));
  res.json(reports);
});

router.post("/projects/:id/reports", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) { res.status(403).json({ error: "Sélectionnez une entreprise" }); return; }
  const cid = req.user!.company!.companyId;
  const projectId = Number(req.params.id);
  const [p] = await db.select({ id: projectsTable.id }).from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.companyId, cid)));
  if (!p) { res.status(404).json({ error: "Projet introuvable" }); return; }

  const { siteId, type, title, reportDate, periodStart, periodEnd, summary, progressPercent,
    issuesEncountered, nextSteps, hseObservations, author } = req.body;
  if (!title) { res.status(400).json({ error: "Titre du rapport requis" }); return; }

  const [row] = await db.insert(projectReportsTable).values({
    projectId,
    siteId: siteId ? Number(siteId) : null,
    reference: genRef("RPT"),
    type: type ?? "avancement",
    title,
    reportDate: reportDate ? new Date(reportDate) : new Date(),
    periodStart: periodStart ? new Date(periodStart) : null,
    periodEnd: periodEnd ? new Date(periodEnd) : null,
    summary: summary ?? null,
    progressPercent: progressPercent ?? 0,
    issuesEncountered: issuesEncountered ?? null,
    nextSteps: nextSteps ?? null,
    hseObservations: hseObservations ?? null,
    author: author ?? null,
    createdBy: req.user!.id,
  }).returning();
  res.status(201).json(row);
});

router.patch("/projects/:id/reports/:reportId", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const reportId = Number(req.params.reportId);
  const [r] = await db.select({ id: projectReportsTable.id }).from(projectReportsTable).where(eq(projectReportsTable.id, reportId));
  if (!r) { res.status(404).json({ error: "Rapport introuvable" }); return; }
  const { type, title, reportDate, periodStart, periodEnd, summary, progressPercent,
    issuesEncountered, nextSteps, hseObservations, author, status } = req.body;
  const [row] = await db.update(projectReportsTable).set({
    ...(type !== undefined && { type }),
    ...(title !== undefined && { title }),
    ...(reportDate !== undefined && { reportDate: new Date(reportDate) }),
    ...(periodStart !== undefined && { periodStart: periodStart ? new Date(periodStart) : null }),
    ...(periodEnd !== undefined && { periodEnd: periodEnd ? new Date(periodEnd) : null }),
    ...(summary !== undefined && { summary }),
    ...(progressPercent !== undefined && { progressPercent: Number(progressPercent) }),
    ...(issuesEncountered !== undefined && { issuesEncountered }),
    ...(nextSteps !== undefined && { nextSteps }),
    ...(hseObservations !== undefined && { hseObservations }),
    ...(author !== undefined && { author }),
    ...(status !== undefined && { status }),
  }).where(eq(projectReportsTable.id, reportId)).returning();
  res.json(row);
});

router.delete("/projects/:id/reports/:reportId", requirePermission("create_invoice"), async (req: Request, res: Response): Promise<void> => {
  const reportId = Number(req.params.reportId);
  await db.delete(projectReportsTable).where(eq(projectReportsTable.id, reportId));
  res.json({ success: true });
});

// ── STATISTIQUES ──────────────────────────────────────────────────────────────

router.get("/projects-stats", requirePermission("view_billing"), async (req: Request, res: Response): Promise<void> => {
  if (req.user!.isSuperAdmin && !req.user!.company) {
    res.json({ consultations: 0, projects: 0, activeProjects: 0, tauxAttribution: 0 });
    return;
  }
  const cid = req.user!.company!.companyId;
  const [cStats] = await db.select({
    total: sql<number>`count(*)`,
    attribuees: sql<number>`count(*) filter (where status = 'attribue')`,
  }).from(consultationsTable).where(eq(consultationsTable.companyId, cid));
  const [pStats] = await db.select({
    total: sql<number>`count(*)`,
    actifs: sql<number>`count(*) filter (where status in ('en_cours','mobilisation'))`,
  }).from(projectsTable).where(eq(projectsTable.companyId, cid));

  const total = Number(cStats.total);
  const attribuees = Number(cStats.attribuees);
  res.json({
    consultations: total,
    tauxAttribution: total > 0 ? Math.round((attribuees / total) * 100) : 0,
    projects: Number(pStats.total),
    activeProjects: Number(pStats.actifs),
  });
});

export default router;
