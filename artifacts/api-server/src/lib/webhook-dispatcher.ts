import crypto from "node:crypto";
import { db, webhooksTable, webhookDeliveriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export type WebhookEvent =
  | "invoice.created" | "invoice.paid" | "invoice.updated"
  | "quote.created" | "quote.accepted"
  | "project.created" | "project.updated" | "project.completed"
  | "expense.created" | "expense.approved"
  | "employee.created" | "employee.updated"
  | "consultation.created" | "consultation.updated"
  | "ping";

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function dispatchWebhookEvent(
  companyId: number,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const hooks = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.companyId, companyId), eq(webhooksTable.isActive, true)));

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const payloadStr = JSON.stringify(payload);

  for (const hook of hooks) {
    // Filter by subscribed events (empty array = all events)
    if (hook.events && hook.events.length > 0 && !hook.events.includes(event) && !hook.events.includes("*")) {
      continue;
    }

    const [delivery] = await db
      .insert(webhookDeliveriesTable)
      .values({
        webhookId: hook.id,
        event,
        payload: payload as any,
        status: "pending",
      })
      .returning();

    // Fire-and-forget (non-blocking)
    sendWebhook(hook, payloadStr, delivery!.id).catch(() => {});
  }
}

async function sendWebhook(
  hook: typeof webhooksTable.$inferSelect,
  payloadStr: string,
  deliveryId: number
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "CTA-ONE-Webhook/1.0",
    "X-CTA-Event": "",
    "X-CTA-Delivery": String(deliveryId),
    "X-CTA-Timestamp": new Date().toISOString(),
  };

  if (hook.secret) {
    headers["X-CTA-Signature"] = `sha256=${sign(payloadStr, hook.secret)}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(hook.url, {
      method: "POST",
      headers,
      body: payloadStr,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const responseBody = await res.text().catch(() => "");
    await db.update(webhookDeliveriesTable)
      .set({
        status: res.ok ? "success" : "failed",
        responseStatus: res.status,
        responseBody: responseBody.slice(0, 2000),
      })
      .where(eq(webhookDeliveriesTable.id, deliveryId));
  } catch (err: any) {
    await db.update(webhookDeliveriesTable)
      .set({ status: "error", error: String(err?.message ?? err).slice(0, 1000) })
      .where(eq(webhookDeliveriesTable.id, deliveryId));
  }
}
