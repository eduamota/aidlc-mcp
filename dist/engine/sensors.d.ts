export interface SensorFinding {
    sensorId: string;
    pass: boolean;
    severity: "advisory" | "strict";
    findings: string[];
    details?: Record<string, any>;
}
export interface StageSensorsReport {
    stageSlug: string;
    overallPass: boolean;
    results: SensorFinding[];
}
/**
 * 1. required-sections sensor:
 * Checks output contains at least 2 H2 headings.
 * For unit-of-work-dependency.md, validates the YAML DAG for syntax and cycles.
 * Checks against template overrides in memory/templates/ if present.
 */
export declare function evaluateRequiredSections(params: {
    content: string;
    filename?: string;
    space?: string;
    workspaceDir?: string;
}): Promise<SensorFinding>;
/**
 * 2. claim-sources sensor:
 * Checks Intent Capture deliverables carry inline source tags ([desc], [scope], [Q<n>], [memory:...], [assumption]).
 */
export declare function evaluateClaimSources(params: {
    content: string;
    projectDescription?: string;
    scope?: string;
}): Promise<SensorFinding>;
/**
 * 3. traceability sensor:
 * Validates traceability.json coverage table and status values (OK, GAP, ORPHAN, Deferred, N/A).
 */
export declare function evaluateTraceabilityJson(jsonContent: string): SensorFinding;
/**
 * 4. upstream-coverage sensor:
 * Verifies stage deliverables cite declared upstream consumed artifacts.
 */
export declare function evaluateUpstreamCoverage(params: {
    consumes: (string | {
        artifact: string;
    })[];
    deliverableContents: string[];
}): SensorFinding;
/**
 * Orchestrates running applicable sensors for a stage.
 */
export declare function runStageSensors(params: {
    stageSlug: string;
    content: string;
    filename?: string;
    workspaceDir?: string;
    space?: string;
}): Promise<StageSensorsReport>;
