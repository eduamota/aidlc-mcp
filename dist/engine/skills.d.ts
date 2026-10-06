export interface SessionCostReport {
    workflow_id: string;
    scope: string;
    started_at: string;
    duration_minutes: number | null;
    stages: {
        total: number;
        approved: number;
        failed: number;
        pending: number;
    };
    by_phase: Record<string, {
        total: number;
        approved: number;
        failed: number;
        pending: number;
    }>;
    memory: {
        total: number;
        interpretations: number;
        deviations: number;
        tradeoffs: number;
        open_questions: number;
    };
    sensors: {
        total: number;
        passed: number;
        failed: number;
        budget_override: number;
        incomplete: number;
    };
    learnings: {
        from_orchestrator: number;
        from_user_addition: number;
    };
}
/**
 * Computes deterministic session cost and execution metrics for the active intent.
 */
export declare function computeSessionCost(intentId?: string, workspaceDir?: string): Promise<SessionCostReport>;
/**
 * Generates a session replay narrative from state, audit logs, and artifacts.
 */
export declare function generateSessionReplay(intentId?: string, workspaceDir?: string): Promise<string>;
/**
 * Generates the OUTCOMES.md comprehensive handover pack and optionally writes to disk.
 */
export declare function generateOutcomesPack(params?: {
    intentId?: string;
    workspaceDir?: string;
    writeToFile?: boolean;
}): Promise<{
    content: string;
    filePath?: string;
}>;
