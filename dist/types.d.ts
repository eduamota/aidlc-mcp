export type Phase = "initialization" | "ideation" | "inception" | "construction" | "operation";
export type ScopeType = "enterprise" | "feature" | "mvp" | "poc" | "bugfix" | "refactor" | "infra" | "security-patch" | "classic" | "workshop" | "express";
export type ProfileType = ScopeType;
export type ProjectType = "greenfield" | "brownfield";
export type DepthLevel = "comprehensive" | "standard" | "minimal";
export type TestStrategy = "comprehensive" | "standard" | "minimal";
export interface RubricDimension {
    id: string;
    title: string;
    description: string;
    probingQuestions: string[];
    heuristicKeywords?: string[];
}
export interface SocraticRubric {
    stageId: string;
    stageName: string;
    persona: string;
    dimensions: RubricDimension[];
}
export interface StageDefinition {
    id: string;
    number: string;
    name: string;
    phase: Phase;
    description: string;
    persona: string;
    defaultArtifactName: string;
    rubric: SocraticRubric;
}
export interface StageState {
    id: string;
    number: string;
    name: string;
    phase: Phase;
    status: "pending" | "in_progress" | "rubric_satisfied" | "approved" | "skipped";
    artifactPath?: string;
    artifactSummary?: string;
    approvedAt?: string;
    gateNotes?: string;
    unresolvedProbes?: string[];
    frozen?: boolean;
    frozenReason?: string;
}
export interface IntentState {
    intentId: string;
    label: string;
    profile: ScopeType;
    projectType: ProjectType;
    depth: DepthLevel;
    testStrategy: TestStrategy;
    description: string;
    createdAt: string;
    updatedAt: string;
    currentStageIndex: number;
    stages: StageState[];
    status: "in_progress" | "completed" | "abandoned";
}
export interface RubricDimensionResult {
    dimensionId: string;
    title: string;
    satisfied: boolean;
    notes: string;
    suggestedProbes: string[];
}
export interface RubricEvaluationResult {
    stageId: string;
    satisfied: boolean;
    score: number;
    dimensionResults: RubricDimensionResult[];
    unresolvedProbes: string[];
    feedback: string;
}
export interface KnowledgeDocument {
    id: string;
    filename: string;
    relativePath: string;
    category: "shared" | "agent" | "documentkb";
    agent?: string;
    sizeBytes: number;
    updatedAt: string;
    preview: string;
}
export interface DoctorCheck {
    name: string;
    status: "pass" | "warn" | "fail";
    message: string;
    details?: string;
}
export interface DoctorReport {
    overallStatus: "healthy" | "warning" | "error";
    workspaceDir: string;
    activeSpace: string;
    checks: DoctorCheck[];
}
export type AuditEventType = "SESSION_STARTED" | "SESSION_ENDED" | "INTENT_INITIALIZED" | "INTENT_SWITCHED" | "STAGE_TRANSITION" | "RUBRIC_EVALUATED" | "REVIEW_REQUESTED" | "REVIEW_COMPLETED" | "STAGE_FROZEN" | "STAGE_UNFROZEN" | "PLAN_APPROVAL_GRANTED" | "GATE_APPROVED" | "DECISION_RECORDED" | "GUARD_REFUSAL";
export interface AuditEvent {
    id: string;
    timestamp: string;
    type: AuditEventType;
    intentId?: string;
    stageId?: string;
    summary: string;
    details?: Record<string, any>;
}
export type HookEvent = "session-start" | "session-end" | "pre-tool" | "post-tool" | "pre-compact" | "stop" | "statusline";
export interface HookContext {
    event: HookEvent;
    workspaceDir?: string;
    toolName?: string;
    toolArgs?: Record<string, any>;
    sessionSource?: "startup" | "resume" | "clear" | "compact";
}
export interface HookResult {
    action: "allow" | "block" | "notify";
    message?: string;
    contextPayload?: string;
}
