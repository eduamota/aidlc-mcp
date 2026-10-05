import { IntentState, ProfileType, ProjectType, RubricEvaluationResult } from "../types.js";
import { STAGE_DEFINITIONS } from "./socratic-rubric.js";
export declare class DlcStateMachine {
    /**
     * Initializes a new Intent with selected profile and scaffolds files.
     */
    static initIntent(params: {
        label: string;
        description: string;
        profile?: ProfileType;
        projectType?: ProjectType;
        workspaceDir?: string;
    }): Promise<{
        intent: IntentState;
        intentDir: string;
    }>;
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
