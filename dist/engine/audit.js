import fs from "node:fs/promises";
import path from "node:path";
import { getWorkspaceDir, getSpaceDir } from "../config.js";
import { getIntentDirPath, loadActiveIntentState } from "../utils/filesystem.js";
/**
 * Appends an audit event to the append-only audit trail in the active intent or space.
 */
export async function appendAuditLog(params, workspaceDir) {
    const ws = workspaceDir || getWorkspaceDir();
    const event = {
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        type: params.type,
        intentId: params.intentId,
        stageId: params.stageId,
        summary: params.summary,
        details: params.details,
    };
    if (!ws || ws === "/") {
        return event;
    }
    let intentId = params.intentId;
    if (!intentId) {
        try {
            const active = await loadActiveIntentState(ws);
            if (active)
                intentId = active.intentId;
        }
        catch { }
    }
    event.intentId = intentId;
    try {
        let auditDir;
        if (intentId) {
            auditDir = path.join(getIntentDirPath(intentId, ws), "audit");
        }
        else {
            auditDir = path.join(getSpaceDir(ws), "audit");
        }
        await fs.mkdir(auditDir, { recursive: true });
        const auditFile = path.join(auditDir, "audit.jsonl");
        await fs.appendFile(auditFile, JSON.stringify(event) + "\n", "utf-8");
    }
    catch (err) {
        console.error("[AI-DLC Audit] Warning: Failed to write audit event:", err);
    }
    return event;
}
/**
 * Reads all audit events for a specified or active intent.
 */
export async function readAuditTrail(intentId, workspaceDir) {
    const ws = workspaceDir || getWorkspaceDir();
    if (!ws || ws === "/") {
        return [];
    }
    let targetIntentId = intentId;
    if (!targetIntentId) {
        const active = await loadActiveIntentState(ws);
        if (active)
            targetIntentId = active.intentId;
    }
    let auditFile;
    if (targetIntentId) {
        auditFile = path.join(getIntentDirPath(targetIntentId, ws), "audit", "audit.jsonl");
    }
    else {
        auditFile = path.join(getSpaceDir(ws), "audit", "audit.jsonl");
    }
    try {
        const raw = await fs.readFile(auditFile, "utf-8");
        const lines = raw.trim().split("\n").filter(Boolean);
        return lines.map((line) => JSON.parse(line));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=audit.js.map