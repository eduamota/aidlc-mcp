import { StageDefinition } from "../types.js";
import { ScopeDefinition } from "./profiles.js";
import { ScopeSpec } from "../scopes/registry.js";
import { StageSpec } from "../stages/registry.js";
import { SensorSpec } from "../sensors/registry.js";
export interface CustomExtensionPack {
    tier: "tier2-org" | "tier3-workspace";
    sourcePath: string;
    manifest?: {
        name: string;
        version?: string;
        description?: string;
        author?: string;
    };
    scopes: Record<string, ScopeDefinition>;
    stages: Record<string, StageDefinition>;
    stageSpecs: Record<string, StageSpec>;
    scopeSpecs: Record<string, ScopeSpec>;
    sensors: Record<string, SensorSpec>;
    knowledge: Array<{
        id: string;
        title: string;
        category: string;
        content: string;
        filePath: string;
    }>;
}
export interface ExtensionRegistryCache {
    workspaceDir: string;
    packs: CustomExtensionPack[];
    scopes: Record<string, ScopeDefinition>;
    scopeSpecs: Record<string, ScopeSpec>;
    stages: Record<string, StageDefinition>;
    stageSpecs: Record<string, StageSpec>;
    sensors: Record<string, SensorSpec>;
    knowledge: Array<{
        id: string;
        title: string;
        category: string;
        content: string;
        filePath: string;
    }>;
}
/**
 * Scans Tier 2 (Org Repo / AIDLC_FLOWS_DIR) and Tier 3 (Workspace Local .aidlc/ or aidlc/custom/).
 */
export declare function loadAllExtensions(workspaceDir?: string): ExtensionRegistryCache;
/**
 * Clears the active cache (useful during testing or when files are edited).
 */
export declare function clearExtensionCache(): void;
export declare function getCustomScopeDefinition(name: string, workspaceDir?: string): ScopeDefinition | undefined;
export declare function getAllCustomScopes(workspaceDir?: string): ScopeDefinition[];
export declare function getCustomScopeSpec(name: string, workspaceDir?: string): ScopeSpec | undefined;
export declare function getAllCustomScopeSpecs(workspaceDir?: string): ScopeSpec[];
export declare function getCustomStageDefinition(id: string, workspaceDir?: string): StageDefinition | undefined;
export declare function getAllCustomStages(workspaceDir?: string): StageDefinition[];
export declare function getCustomStageSpec(slug: string, workspaceDir?: string): StageSpec | undefined;
export declare function getAllCustomStageSpecs(workspaceDir?: string): StageSpec[];
export declare function getCustomSensors(workspaceDir?: string): SensorSpec[];
export declare function getCustomKnowledgeDocs(workspaceDir?: string): {
    id: string;
    title: string;
    category: string;
    content: string;
    filePath: string;
}[];
