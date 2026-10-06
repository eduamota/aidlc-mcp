import fs from "node:fs/promises";
import path from "node:path";
import { AuditEvent, AuditEventType } from "../types.js";
import { getWorkspaceDir, getSpaceDir } from "../config.js";
import { getIntentDirPath, loadActiveIntentState } from "../utils/filesystem.js";

/**
 * Appends an audit event to the append-only audit trail in the active intent or space.
 */
export async function appendAuditLog(
  params: {
    type: AuditEventType;
    summary: string;
    intentId?: string;
    stageId?: string;
    details?: Record<string, any>;
  },
  workspaceDir?: string
): Promise<AuditEvent> {
  const ws = workspaceDir || getWorkspaceDir();
  let intentId = params.intentId;

  if (!intentId) {
    try {
      const active = await loadActiveIntentState(ws);
      if (active) intentId = active.intentId;
    } catch {}
  }

  const event: AuditEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    type: params.type,
    intentId,
    stageId: params.stageId,
    summary: params.summary,
    details: params.details,
  };

  try {
    let auditDir: string;
    if (intentId) {
      auditDir = path.join(getIntentDirPath(intentId, ws), "audit");
    } else {
      auditDir = path.join(getSpaceDir(ws), "audit");
    }

    await fs.mkdir(auditDir, { recursive: true });
    const auditFile = path.join(auditDir, "audit.jsonl");
    await fs.appendFile(auditFile, JSON.stringify(event) + "\n", "utf-8");
  } catch (err) {
    console.error("[AI-DLC Audit] Warning: Failed to write audit event:", err);
  }

  return event;
}

/**
 * Reads all audit events for a specified or active intent.
 */
export async function readAuditTrail(intentId?: string, workspaceDir?: string): Promise<AuditEvent[]> {
  const ws = workspaceDir || getWorkspaceDir();
  let targetIntentId = intentId;

  if (!targetIntentId) {
    const active = await loadActiveIntentState(ws);
    if (active) targetIntentId = active.intentId;
  }

  let auditFile: string;
  if (targetIntentId) {
    auditFile = path.join(getIntentDirPath(targetIntentId, ws), "audit", "audit.jsonl");
  } else {
    auditFile = path.join(getSpaceDir(ws), "audit", "audit.jsonl");
  }

  try {
    const raw = await fs.readFile(auditFile, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
