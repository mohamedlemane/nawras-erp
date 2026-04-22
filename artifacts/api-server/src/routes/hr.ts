import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db, departmentsTable, positionsTable, employeesTable, contractsTable, leaveTypesTable, leaveRequestsTable, attendancesTable, employeeDocumentsTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo, handleNoCompany } from "../lib/rbac";
import { handleDbError } from "../lib/db-errors";
import { createAuditLog } from "../lib/audit";

const router: IRouter = Router();

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────

router.get("/departments", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res, "array")) res.status(403).json({ error: "No company membership" }); return; }

  const depts = await db.select().from(departmentsTable).where(eq(departmentsTable.companyId, info.companyId)).orderBy(departmentsTable.name);
  
  // Count employees per dept
  const counts = await db
    .select({ deptId: employeesTable.departmentId, cnt: sql<number>`count(*)::int` })
    .from(employeesTable)
    .where(eq(employeesTable.companyId, info.companyId))
    .groupBy(employeesTable.departmentId);
  
  const countMap = new Map(counts.map((c) => [c.deptId, c.cnt]));
  
  res.json(depts.map((d) => ({ ...d, employeeCount: countMap.get(d.id) ?? 0, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString() })));
});

router.post("/departments", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { name, description, managerId } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [dept] = await db.insert(departmentsTable).values({ companyId: info.companyId, name, description, managerId: managerId ?? null }).returning();
  res.status(201).json({ ...dept!, employeeCount: 0, createdAt: dept!.createdAt.toISOString(), updatedAt: dept!.updatedAt.toISOString() });
});

router.patch("/departments/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, description, managerId } = req.body;
  const [dept] = await db.update(departmentsTable).set({ name, description, managerId }).where(and(eq(departmentsTable.id, id), eq(departmentsTable.companyId, info.companyId))).returning();
  if (!dept) { res.status(404).json({ error: "Department not found" }); return; }
  res.json({ ...dept, employeeCount: 0, createdAt: dept.createdAt.toISOString(), updatedAt: dept.updatedAt.toISOString() });
});

router.delete("/departments/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  try {
    await db.delete(departmentsTable).where(and(eq(departmentsTable.id, id), eq(departmentsTable.companyId, info.companyId)));
    res.sendStatus(204);
  } catch (err) {
    if (!handleDbError(err, res, "department")) throw err;
  }
});

// ── POSITIONS ─────────────────────────────────────────────────────────────────

router.get("/positions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res, "array")) res.status(403).json({ error: "No company membership" }); return; }

  const positions = await db.select().from(positionsTable).where(eq(positionsTable.companyId, info.companyId)).orderBy(positionsTable.name);
  res.json(positions.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() })));
});

router.post("/positions", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { name, departmentId, description } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [pos] = await db.insert(positionsTable).values({ companyId: info.companyId, name, departmentId: departmentId ?? null, description }).returning();
  res.status(201).json({ ...pos!, createdAt: pos!.createdAt.toISOString(), updatedAt: pos!.updatedAt.toISOString() });
});

router.patch("/positions/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, departmentId, description } = req.body;
  const [pos] = await db.update(positionsTable).set({ name, departmentId, description }).where(and(eq(positionsTable.id, id), eq(positionsTable.companyId, info.companyId))).returning();
  if (!pos) { res.status(404).json({ error: "Position not found" }); return; }
  res.json({ ...pos, createdAt: pos.createdAt.toISOString(), updatedAt: pos.updatedAt.toISOString() });
});

router.delete("/positions/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  try {
    await db.delete(positionsTable).where(and(eq(positionsTable.id, id), eq(positionsTable.companyId, info.companyId)));
    res.sendStatus(204);
  } catch (err) {
    if (!handleDbError(err, res, "position")) throw err;
  }
});

// ── EMPLOYEES ─────────────────────────────────────────────────────────────────

router.get("/employees", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const departmentId = req.query.departmentId ? parseInt(String(req.query.departmentId), 10) : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const conditions = [eq(employeesTable.companyId, info.companyId)];
  if (departmentId) conditions.push(eq(employeesTable.departmentId, departmentId));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db
    .select({
      id: employeesTable.id, companyId: employeesTable.companyId, employeeCode: employeesTable.employeeCode,
      nni: employeesTable.nni,
      firstName: employeesTable.firstName, lastName: employeesTable.lastName, gender: employeesTable.gender,
      birthDate: employeesTable.birthDate, phone: employeesTable.phone, email: employeesTable.email,
      address: employeesTable.address, hireDate: employeesTable.hireDate,
      departmentId: employeesTable.departmentId, departmentName: departmentsTable.name,
      positionId: employeesTable.positionId, positionName: positionsTable.name,
      managerId: employeesTable.managerId, employmentStatus: employeesTable.employmentStatus,
      createdAt: employeesTable.createdAt, updatedAt: employeesTable.updatedAt,
    })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
    .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
    .where(whereClause).limit(limit).offset(offset).orderBy(employeesTable.lastName);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable).where(whereClause);
  res.json({ data: data.map(serEmp), total: count, page, limit });
});

router.post("/employees", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { firstName, lastName, gender, nni, birthDate, phone, email, address, hireDate, departmentId, positionId, managerId, notes, emergencyContact, employeeCode: providedCode } = req.body;
  if (!firstName || !lastName || !hireDate) { res.status(400).json({ error: "firstName, lastName, hireDate required" }); return; }

  let employeeCode = providedCode?.trim() || null;
  if (!employeeCode) {
    const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` }).from(employeesTable).where(eq(employeesTable.companyId, info.companyId));
    employeeCode = `EMP-${String(cnt + 1).padStart(5, "0")}`;
  }

  const [emp] = await db.insert(employeesTable).values({ companyId: info.companyId, employeeCode, nni: nni ?? null, firstName, lastName, gender, birthDate, phone, email, address, hireDate, departmentId: departmentId ?? null, positionId: positionId ?? null, managerId: managerId ?? null, notes, emergencyContact, createdBy: req.user.id }).returning();
  res.status(201).json({ ...serEmp({ ...emp!, departmentName: null, positionName: null }) });
});

router.get("/employees/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [emp] = await db.select({ id: employeesTable.id, companyId: employeesTable.companyId, employeeCode: employeesTable.employeeCode, nni: employeesTable.nni, firstName: employeesTable.firstName, lastName: employeesTable.lastName, gender: employeesTable.gender, birthDate: employeesTable.birthDate, phone: employeesTable.phone, email: employeesTable.email, address: employeesTable.address, hireDate: employeesTable.hireDate, departmentId: employeesTable.departmentId, departmentName: departmentsTable.name, positionId: employeesTable.positionId, positionName: positionsTable.name, managerId: employeesTable.managerId, employmentStatus: employeesTable.employmentStatus, notes: employeesTable.notes, emergencyContact: employeesTable.emergencyContact, createdAt: employeesTable.createdAt, updatedAt: employeesTable.updatedAt }).from(employeesTable).leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id)).leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id)).where(and(eq(employeesTable.id, id), eq(employeesTable.companyId, info.companyId))).limit(1);
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }

  const contracts = await db.select().from(contractsTable).where(eq(contractsTable.employeeId, id));
  const documents = await db.select().from(employeeDocumentsTable).where(eq(employeeDocumentsTable.employeeId, id));
  res.json({ ...serEmp(emp), contracts: contracts.map(serContract), documents: documents.map(serDoc) });
});

router.patch("/employees/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { firstName, lastName, gender, nni, birthDate, phone, email, address, hireDate, departmentId, positionId, managerId, employmentStatus, notes, emergencyContact, employeeCode: newCode } = req.body;
  const updateData: any = { firstName, lastName, gender, nni: nni ?? null, birthDate, phone, email, address, hireDate, departmentId, positionId, managerId, employmentStatus, notes, emergencyContact, updatedBy: req.user.id };
  if (newCode?.trim()) updateData.employeeCode = newCode.trim();
  const [emp] = await db.update(employeesTable).set(updateData).where(and(eq(employeesTable.id, id), eq(employeesTable.companyId, info.companyId))).returning();
  if (!emp) { res.status(404).json({ error: "Employee not found" }); return; }
  res.json(serEmp({ ...emp, departmentName: null, positionName: null }));
});

router.delete("/employees/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(employeesTable).where(and(eq(employeesTable.id, id), eq(employeesTable.companyId, info.companyId)));
  res.sendStatus(204);
});

// ── CONTRACTS ─────────────────────────────────────────────────────────────────

router.get("/contracts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const employeeId = req.query.employeeId ? parseInt(String(req.query.employeeId), 10) : undefined;

  const conditions = [eq(contractsTable.companyId, info.companyId)];
  if (employeeId) conditions.push(eq(contractsTable.employeeId, employeeId));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select({ id: contractsTable.id, companyId: contractsTable.companyId, employeeId: contractsTable.employeeId, employeeName: sql<string>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`, contractType: contractsTable.contractType, startDate: contractsTable.startDate, endDate: contractsTable.endDate, salary: contractsTable.salary, status: contractsTable.status, createdAt: contractsTable.createdAt, updatedAt: contractsTable.updatedAt }).from(contractsTable).leftJoin(employeesTable, eq(contractsTable.employeeId, employeesTable.id)).where(whereClause).limit(limit).offset(offset).orderBy(contractsTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(contractsTable).where(whereClause);
  res.json({ data: data.map(serContract), total: count, page, limit });
});

router.post("/contracts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { employeeId, contractType, startDate, endDate, salary } = req.body;
  if (!employeeId || !contractType || !startDate || salary === undefined) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [contract] = await db.insert(contractsTable).values({ companyId: info.companyId, employeeId, contractType, startDate, endDate: endDate ?? null, salary: String(salary), createdBy: req.user.id }).returning();
  res.status(201).json(serContract(contract!));
});

router.get("/contracts/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [contract] = await db.select().from(contractsTable).where(and(eq(contractsTable.id, id), eq(contractsTable.companyId, info.companyId))).limit(1);
  if (!contract) { res.status(404).json({ error: "Contract not found" }); return; }
  res.json(serContract(contract));
});

router.patch("/contracts/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { contractType, startDate, endDate, salary, status } = req.body;
  const [contract] = await db.update(contractsTable).set({ contractType, startDate, endDate, salary: salary !== undefined ? String(salary) : undefined, status, updatedBy: req.user.id }).where(and(eq(contractsTable.id, id), eq(contractsTable.companyId, info.companyId))).returning();
  if (!contract) { res.status(404).json({ error: "Contract not found" }); return; }
  res.json(serContract(contract));
});

// ── LEAVE TYPES ───────────────────────────────────────────────────────────────

router.get("/leave-types", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res, "array")) res.status(403).json({ error: "No company membership" }); return; }

  const types = await db.select().from(leaveTypesTable).where(eq(leaveTypesTable.companyId, info.companyId)).orderBy(leaveTypesTable.name);
  res.json(types.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

router.post("/leave-types", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { name, daysAllowed, description } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [type] = await db.insert(leaveTypesTable).values({ companyId: info.companyId, name, daysAllowed: daysAllowed ?? null, description }).returning();
  res.status(201).json({ ...type!, createdAt: type!.createdAt.toISOString() });
});

router.patch("/leave-types/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const id = parseInt(String(req.params.id), 10);
  const { name, daysAllowed, description } = req.body;
  const [type] = await db.update(leaveTypesTable)
    .set({ ...(name !== undefined && { name }), ...(daysAllowed !== undefined && { daysAllowed: daysAllowed ?? null }), ...(description !== undefined && { description }) })
    .where(and(eq(leaveTypesTable.id, id), eq(leaveTypesTable.companyId, info.companyId)))
    .returning();
  if (!type) { res.status(404).json({ error: "Type de congé introuvable" }); return; }
  res.json({ ...type, createdAt: type.createdAt.toISOString() });
});

router.delete("/leave-types/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const id = parseInt(String(req.params.id), 10);
  try {
    await db.delete(leaveTypesTable).where(and(eq(leaveTypesTable.id, id), eq(leaveTypesTable.companyId, info.companyId)));
    res.sendStatus(204);
  } catch (err) {
    if (!handleDbError(err, res, "leave_type")) throw err;
  }
});

// ── LEAVE REQUESTS ────────────────────────────────────────────────────────────

router.get("/leave-requests", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const employeeId = req.query.employeeId ? parseInt(String(req.query.employeeId), 10) : undefined;

  const conditions = [eq(leaveRequestsTable.companyId, info.companyId)];
  if (status) conditions.push(eq(leaveRequestsTable.status, status));
  if (employeeId) conditions.push(eq(leaveRequestsTable.employeeId, employeeId));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select({ id: leaveRequestsTable.id, companyId: leaveRequestsTable.companyId, employeeId: leaveRequestsTable.employeeId, employeeName: sql<string>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`, leaveTypeId: leaveRequestsTable.leaveTypeId, leaveTypeName: leaveTypesTable.name, startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate, daysCount: leaveRequestsTable.daysCount, reason: leaveRequestsTable.reason, status: leaveRequestsTable.status, approvedBy: leaveRequestsTable.approvedBy, approvedAt: leaveRequestsTable.approvedAt, createdAt: leaveRequestsTable.createdAt, updatedAt: leaveRequestsTable.updatedAt }).from(leaveRequestsTable).leftJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id)).leftJoin(leaveTypesTable, eq(leaveRequestsTable.leaveTypeId, leaveTypesTable.id)).where(whereClause).limit(limit).offset(offset).orderBy(leaveRequestsTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(leaveRequestsTable).where(whereClause);
  res.json({ data: data.map(serLeave), total: count, page, limit });
});

router.post("/leave-requests", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { employeeId, leaveTypeId, startDate, endDate, reason } = req.body;
  if (!employeeId || !leaveTypeId || !startDate || !endDate) { res.status(400).json({ error: "Missing required fields" }); return; }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;

  const [leave] = await db.insert(leaveRequestsTable).values({ companyId: info.companyId, employeeId, leaveTypeId, startDate, endDate, daysCount, reason }).returning();
  res.status(201).json(serLeave({ ...leave!, employeeName: null as unknown as string, leaveTypeName: null }));
});

router.get("/leave-requests/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [leave] = await db.select({ id: leaveRequestsTable.id, companyId: leaveRequestsTable.companyId, employeeId: leaveRequestsTable.employeeId, employeeName: sql<string>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`, leaveTypeId: leaveRequestsTable.leaveTypeId, leaveTypeName: leaveTypesTable.name, startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate, daysCount: leaveRequestsTable.daysCount, reason: leaveRequestsTable.reason, status: leaveRequestsTable.status, approvedBy: leaveRequestsTable.approvedBy, approvedAt: leaveRequestsTable.approvedAt, createdAt: leaveRequestsTable.createdAt, updatedAt: leaveRequestsTable.updatedAt }).from(leaveRequestsTable).leftJoin(employeesTable, eq(leaveRequestsTable.employeeId, employeesTable.id)).leftJoin(leaveTypesTable, eq(leaveRequestsTable.leaveTypeId, leaveTypesTable.id)).where(and(eq(leaveRequestsTable.id, id), eq(leaveRequestsTable.companyId, info.companyId))).limit(1);
  if (!leave) { res.status(404).json({ error: "Leave request not found" }); return; }
  res.json(serLeave(leave));
});

router.patch("/leave-requests/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, reason } = req.body;
  const updates: any = { status };
  if (reason !== undefined) updates.reason = reason;
  if (status === "approved") { updates.approvedAt = new Date(); }

  const [leave] = await db.update(leaveRequestsTable).set(updates).where(and(eq(leaveRequestsTable.id, id), eq(leaveRequestsTable.companyId, info.companyId))).returning();
  if (!leave) { res.status(404).json({ error: "Leave request not found" }); return; }
  res.json(serLeave({ ...leave, employeeName: null as unknown as string, leaveTypeName: null }));
});

// ── ATTENDANCES ───────────────────────────────────────────────────────────────

router.get("/attendances", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const employeeId = req.query.employeeId ? parseInt(String(req.query.employeeId), 10) : undefined;

  const conditions = [eq(attendancesTable.companyId, info.companyId)];
  if (employeeId) conditions.push(eq(attendancesTable.employeeId, employeeId));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select({ id: attendancesTable.id, companyId: attendancesTable.companyId, employeeId: attendancesTable.employeeId, employeeName: sql<string>`concat(${employeesTable.firstName}, ' ', ${employeesTable.lastName})`, date: attendancesTable.date, checkIn: attendancesTable.checkIn, checkOut: attendancesTable.checkOut, status: attendancesTable.status, notes: attendancesTable.notes, createdAt: attendancesTable.createdAt }).from(attendancesTable).leftJoin(employeesTable, eq(attendancesTable.employeeId, employeesTable.id)).where(whereClause).limit(limit).offset(offset).orderBy(attendancesTable.date);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(attendancesTable).where(whereClause);
  res.json({ data: data.map(serAtt), total: count, page, limit });
});

router.post("/attendances", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { employeeId, date, checkIn, checkOut, status, notes } = req.body;
  if (!employeeId || !date || !status) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [att] = await db.insert(attendancesTable).values({ companyId: info.companyId, employeeId, date, checkIn, checkOut, status, notes }).returning();
  res.status(201).json(serAtt({ ...att!, employeeName: null as unknown as string }));
});

router.patch("/attendances/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { checkIn, checkOut, status, notes } = req.body;
  const [att] = await db.update(attendancesTable).set({ checkIn, checkOut, status, notes }).where(and(eq(attendancesTable.id, id), eq(attendancesTable.companyId, info.companyId))).returning();
  if (!att) { res.status(404).json({ error: "Attendance not found" }); return; }
  res.json(serAtt({ ...att, employeeName: null as unknown as string }));
});

// ── EMPLOYEE DOCUMENTS ────────────────────────────────────────────────────────

router.get("/employee-documents", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));
  const offset = (page - 1) * limit;
  const employeeId = req.query.employeeId ? parseInt(String(req.query.employeeId), 10) : undefined;

  const conditions = [eq(employeeDocumentsTable.companyId, info.companyId)];
  if (employeeId) conditions.push(eq(employeeDocumentsTable.employeeId, employeeId));
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

  const data = await db.select().from(employeeDocumentsTable).where(whereClause).limit(limit).offset(offset).orderBy(employeeDocumentsTable.createdAt);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(employeeDocumentsTable).where(whereClause);
  res.json({ data: data.map(serDoc), total: count, page, limit });
});

router.post("/employee-documents", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const { employeeId, title, fileUrl, documentType } = req.body;
  if (!employeeId || !title || !documentType) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [doc] = await db.insert(employeeDocumentsTable).values({ companyId: info.companyId, employeeId, title, fileUrl, documentType, uploadedBy: req.user.id }).returning();
  res.status(201).json(serDoc(doc!));
});

router.delete("/employee-documents/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { if (!handleNoCompany(req, res)) res.status(403).json({ error: "No company membership" }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(employeeDocumentsTable).where(and(eq(employeeDocumentsTable.id, id), eq(employeeDocumentsTable.companyId, info.companyId)));
  res.sendStatus(204);
});

// ── HELPERS ───────────────────────────────────────────────────────────────────

function serEmp(e: any) {
  return { ...e, createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt, updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : e.updatedAt };
}

function serContract(c: any) {
  return { ...c, salary: Number(c.salary), createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt, updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt };
}

function serLeave(l: any) {
  return { ...l, createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt, updatedAt: l.updatedAt instanceof Date ? l.updatedAt.toISOString() : l.updatedAt, approvedAt: l.approvedAt ? (l.approvedAt instanceof Date ? l.approvedAt.toISOString() : l.approvedAt) : null };
}

function serAtt(a: any) {
  return { ...a, createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt };
}

function serDoc(d: any) {
  return { ...d, createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt };
}

export default router;
