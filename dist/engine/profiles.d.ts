import { ScopeType, ProjectType, DepthLevel, TestStrategy, StageState } from "../types.js";
import { ScopeSpec } from "../scopes/registry.js";
export { ScopeSpec };
export declare function getScopeSpec(name: string, workspaceDir?: string): ScopeSpec | undefined;
export declare function getAllScopeSpecs(workspaceDir?: string): ScopeSpec[];
export declare function detectScopeFromPrompt(prompt: string, workspaceDir?: string): ScopeType | string | undefined;
export interface ScopeDefinition {
    type: ScopeType;
    name: string;
    description: string;
    defaultDepth: DepthLevel;
    defaultTestStrategy: TestStrategy;
    stageIds: string[];
    spec?: ScopeSpec;
}
export declare const SCOPES: Record<ScopeType, ScopeDefinition>;
export declare const PROFILES: Record<ScopeType, ScopeDefinition>;
/**
 * Initializes the list of StageState objects for a given scope and project type.
 * Greenfield projects skip reverse-engineering automatically.
 */
export declare function createStagesForScope(scopeType: ScopeType | string, projectType?: ProjectType, workspaceDir?: string): StageState[];
export declare const createStagesForProfile: typeof createStagesForScope;
