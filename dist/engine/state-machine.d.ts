import { IntentState, ScopeType, ProjectType, DepthLevel, TestStrategy, RubricEvaluationResult } from "../types.js";
import { STAGE_DEFINITIONS } from "./socratic-rubric.js";
export declare class DlcStateMachine {
    /**
     * Initializes a new Intent with selected scope/profile, depth, and test strategy.
     */
    static initIntent(params: {
        label: string;
        description: string;
        profile?: ScopeType;
        projectType?: ProjectType;
        depth?: DepthLevel;
        testStrategy?: TestStrategy;
        workspaceDir?: string;
    }): Promise<{
        intent: IntentState;
        intentDir: string;
    }>;
    /**
     * Switches the active intent.
     */
    static switchIntent(intentId: string, workspaceDir?: string): Promise<IntentState>;
    /**
     * Gets current intent and active stage status.
     */
    static getStatus(intentId?: string, workspaceDir?: string): Promise<{
        intent: IntentState | null;
        currentStage: (typeof STAGE_DEFINITIONS)[string] | null;
        activeStageState: any;
        isComplete: boolean;
    }>;
    /**
     * Submits a draft artifact for the current or specified stage,
     * saves it, and evaluates against the Socratic rubric.
     */
    static submitDraft(params: {
        stageId?: string;
        artifactName?: string;
        content: string;
        intentId?: string;
        workspaceDir?: string;
    }): Promise<{
        evaluation: RubricEvaluationResult;
        artifactPath: string;
        stageUpdated: boolean;
    }>;
    /**
     * Approves a stage gate and advances the intent state machine.
     */
    static approveGate(params: {
        stageId?: string;
        notes?: string;
        force?: boolean;
        intentId?: string;
        workspaceDir?: string;
    }): Promise<{
        success: boolean;
        previousStageId: string;
        nextStageId: string | null;
        workflowComplete: boolean;
        message: string;
    }>;
}
