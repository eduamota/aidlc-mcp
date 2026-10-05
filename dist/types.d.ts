export type Phase = "initialization" | "ideation" | "inception" | "construction" | "verification" | "operation";
export type ProfileType = "feature" | "mvp" | "bugfix" | "express";
export type ProjectType = "greenfield" | "brownfield";
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
}
export interface IntentState {
    intentId: string;
    label: string;
    profile: ProfileType;
    projectType?: ProjectType;
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
