import { AuditEvent, AuditEventType } from "../types.js";
/**
 * Appends an audit event to the append-only audit trail in the active intent or space.
 */
export declare function appendAuditLog(params: {
    type: AuditEventType;
    summary: string;
    intentId?: string;
    stageId?: string;
    details?: Record<string, any>;
}, workspaceDir?: string): Promise<AuditEvent>;
/**
 * Reads all audit events for a specified or active intent.
 */
export declare function readAuditTrail(intentId?: string, workspaceDir?: string): Promise<AuditEvent[]>;
