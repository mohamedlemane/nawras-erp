import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import crypto from "node:crypto";
import { db, webhooksTable, webhookDeliveriesTable } from "@workspace/db";
import { requireAuth, getUserCompanyInfo } from "../lib/rbac";
import { dispatchWebhookEvent } from "../lib/webhook-dispatcher";

const router: IRouter = Router();

const AVAILABLE_EVENTS = [
  "invoice.created", "invoice.paid", "invoice.updated",
  "quote.created", "quote.accepted",
  "project.created", "project.updated", "project.completed",
  "expense.created", "expense.approved",
  "employee.created", "employee.updated",
  "consultation.created", "consultation.updated",
  "ping",
];

// ── List events catalogue ─────────────────────────────────────────────────────
router.get("/webhooks/events", (_req, res) => {
  res.json(AVAILABLE_EVENTS);
});

// ── List webhooks for company ─────────────────────────────────────────────────
router.get("/webhooks", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company" }); return; }

  const hooks = await db.select().from(webhooksTable)
    .where(eq(webhooksTable.companyId, info.companyId))
    .orderBy(desc(webhooksTable.createdAt));

  res.json(hooks);
});

// ── Create webhook ────────────────────────────────────────────────────────────
router.post("/webhooks", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company" }); return; }

  const { name, url, secret, events } = req.body;
  if (!name || !url) { res.status(400).json({ error: "name et url sont requis" }); return; }
  try { new URL(url); } catch { res.status(400).json({ error: "URL invalide" }); return; }

  const [hook] = await db.insert(webhooksTable).values({
    companyId: info.companyId,
    name,
    url,
    secret: secret || crypto.randomBytes(24).toString("hex"),
    events: Array.isArray(events) ? events : [],
    isActive: true,
  }).returning();

  res.status(201).json(hook);
});

// ── Update webhook ────────────────────────────────────────────────────────────
router.patch("/webhooks/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company" }); return; }

  const id = parseInt(req.params.id, 10);
  const { name, url, secret, events, isActive } = req.body;
  if (url) { try { new URL(url); } catch { res.status(400).json({ error: "URL invalide" }); return; } }

  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (url !== undefined) updates.url = url;
  if (secret !== undefined) updates.secret = secret;
  if (events !== undefined) updates.events = events;
  if (isActive !== undefined) updates.isActive = isActive;

  const [hook] = await db.update(webhooksTable).set(updates)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.companyId, info.companyId)))
    .returning();

  if (!hook) { res.status(404).json({ error: "Webhook introuvable" }); return; }
  res.json(hook);
});

// ── Delete webhook ────────────────────────────────────────────────────────────
router.delete("/webhooks/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company" }); return; }

  const id = parseInt(req.params.id, 10);
  await db.delete(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.companyId, info.companyId)));
  res.sendStatus(204);
});

// ── Send a test ping ──────────────────────────────────────────────────────────
router.post("/webhooks/:id/test", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company" }); return; }

  const id = parseInt(req.params.id, 10);
  const [hook] = await db.select().from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.companyId, info.companyId))).limit(1);
  if (!hook) { res.status(404).json({ error: "Webhook introuvable" }); return; }

  await dispatchWebhookEvent(info.companyId, "ping", {
    message: "Test ping depuis CTA-ONE",
    webhookId: hook.id,
    webhookName: hook.name,
  });

  res.json({ success: true, message: "Ping envoyé" });
});

// ── Get recent deliveries for a webhook ──────────────────────────────────────
router.get("/webhooks/:id/deliveries", requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const info = await getUserCompanyInfo(req.user.id);
  if (!info) { res.status(403).json({ error: "No company" }); return; }

  const id = parseInt(req.params.id, 10);
  const [hook] = await db.select({ id: webhooksTable.id }).from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.companyId, info.companyId))).limit(1);
  if (!hook) { res.status(404).json({ error: "Webhook introuvable" }); return; }

  const deliveries = await db.select().from(webhookDeliveriesTable)
    .where(eq(webhookDeliveriesTable.webhookId, id))
    .orderBy(desc(webhookDeliveriesTable.createdAt))
    .limit(50);

  res.json(deliveries);
});

export default router;
