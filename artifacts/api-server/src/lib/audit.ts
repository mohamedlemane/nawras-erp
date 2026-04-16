import { db, auditLogsTable } from "@workspace/db";
import { logger } from "./logger";

export async function createAuditLog(params: {
  companyId?: number;
  userId?: string;
  userEmail?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
}) {
  try {
    await db.insert(auditLogsTable).values({
      companyId: params.companyId ?? null,
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      oldValues: params.oldValues ? JSON.stringify(params.oldValues) : null,
      newValues: params.newValues ? JSON.stringify(params.newValues) : null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create audit log");
  }
}
