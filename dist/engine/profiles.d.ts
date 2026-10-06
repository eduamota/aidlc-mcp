import { ScopeType, ProjectType, DepthLevel, TestStrategy, StageState } from "../types.js";
import { getScopeSpec, getAllScopeSpecs, detectScopeFromPrompt, ScopeSpec } from "../scopes/registry.js";
export { getScopeSpec, getAllScopeSpecs, detectScopeFromPrompt, ScopeSpec };
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
export declare function createStagesForScope(scopeType: ScopeType, projectType?: ProjectType): StageState[];
export declare const createStagesForProfile: typeof createStagesForScope;
