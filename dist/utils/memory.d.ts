import { Phase } from "../types.js";
/**
 * Ensures memory directories exist and seeds default memory files if missing.
 */
export declare function ensureMemoryDirs(workspaceDir?: string, space?: string): Promise<string>;
/**
 * Reads the raw content of a specific memory layer or phase guardrail file.
 */
export declare function readMemoryLayer(layer: string, workspaceDir?: string, space?: string): Promise<string>;
/**
 * Resolves active layered memory (org -> team -> project -> phase guardrails).
 */
export declare function resolveActiveMemory(params?: {
    phase?: Phase;
    workspaceDir?: string;
    space?: string;
}): Promise<{
    layers: {
        org: string;
        team: string;
        project: string;
        phaseRules?: string;
    };
    combinedText: string;
}>;
/**
 * Extracts a specific H2 section rule from an exact memory layer (for [memory:M<n>] source verification).
 */
export declare function getMemoryRule(layer: "org" | "team" | "project" | string, heading: string, workspaceDir?: string, space?: string): Promise<string | null>;
/**
 * Updates or sets an affirmed rule under an H2 heading in team.md or project.md.
 */
export declare function updateMemoryRule(layer: "team" | "project", heading: string, content: string, workspaceDir?: string, space?: string): Promise<{
    success: boolean;
    filePath: string;
}>;
/**
 * Records a human correction or learned practice to learnings.md.
 */
export declare function recordLearning(params: {
    stageId?: string;
    learning: string;
    author?: string;
    workspaceDir?: string;
    space?: string;
}): Promise<{
    success: boolean;
    filePath: string;
}>;
