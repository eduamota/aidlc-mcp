import { RubricEvaluationResult, StageDefinition } from "../types.js";
export declare const STAGE_DEFINITIONS: Record<string, StageDefinition>;
/**
 * Evaluates artifact content against a stage's Socratic rubric.
 */
export declare function evaluateRubric(stageId: string, content: string, workspaceDir?: string): RubricEvaluationResult;
