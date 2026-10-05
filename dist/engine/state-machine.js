import { SCOPES, createStagesForScope } from "./profiles.js";
import { STAGE_DEFINITIONS, evaluateRubric } from "./socratic-rubric.js";
import { generateIntentId, scaffoldIntent, loadActiveIntentState, loadIntentState, persistIntentState, saveStageArtifact, setActiveIntent, } from "../utils/filesystem.js";
import { getWorkspaceDir } from "../config.js";
export class DlcStateMachine {
    /**
     * Initializes a new Intent with selected scope/profile, depth, and test strategy.
     */
    static async initIntent(params) {
        const ws = params.workspaceDir || getWorkspaceDir();
        const profile = params.profile || "feature";
        const projectType = params.projectType || "greenfield";
        const scopeDef = SCOPES[profile];
        if (!scopeDef) {
            throw new Error(`Invalid scope/profile: '${profile}'. Supported scopes: ${Object.keys(SCOPES).join(", ")}`);
        }
        const depth = params.depth || scopeDef.defaultDepth;
        const testStrategy = params.testStrategy || scopeDef.defaultTestStrategy;
        const intentId = generateIntentId(params.label);
        const now = new Date().toISOString();
        const stages = createStagesForScope(profile, projectType);
        const intent = {
            intentId,
            label: params.label,
            profile,
            projectType,
            depth,
            testStrategy,
            description: params.description,
            createdAt: now,
            updatedAt: now,
            currentStageIndex: 0,
            stages,
            status: "in_progress",
        };
        const intentDir = await scaffoldIntent(intent, ws);
        return { intent, intentDir };
    }
    /**
     * Switches the active intent.
     */
    static async switchIntent(intentId, workspaceDir) {
        const ws = workspaceDir || getWorkspaceDir();
        const intent = await loadIntentState(intentId, ws);
        if (!intent) {
            throw new Error(`Intent '${intentId}' not found in workspace.`);
        }
        await setActiveIntent(intentId, ws);
        return intent;
    }
    /**
     * Gets current intent and active stage status.
     */
    static async getStatus(intentId, workspaceDir) {
        const ws = workspaceDir || getWorkspaceDir();
        const intent = intentId ? await loadIntentState(intentId, ws) : await loadActiveIntentState(ws);
        if (!intent) {
            return {
                intent: null,
                currentStage: null,
                activeStageState: null,
                isComplete: false,
            };
        }
        const currentStageState = intent.stages[intent.currentStageIndex];
        const currentStageDef = currentStageState ? STAGE_DEFINITIONS[currentStageState.id] || null : null;
        const isComplete = intent.currentStageIndex >= intent.stages.length;
        return {
            intent,
            currentStage: currentStageDef,
            activeStageState: currentStageState || null,
            isComplete,
        };
    }
    /**
     * Submits a draft artifact for the current or specified stage,
     * saves it, and evaluates against the Socratic rubric.
     */
    static async submitDraft(params) {
        const ws = params.workspaceDir || getWorkspaceDir();
        const intent = params.intentId ? await loadIntentState(params.intentId, ws) : await loadActiveIntentState(ws);
        if (!intent) {
            throw new Error("No active intent found. Run dlc_init_intent first.");
        }
        const currentStageState = intent.stages[intent.currentStageIndex];
        const targetStageId = params.stageId || currentStageState?.id;
        if (!targetStageId) {
            throw new Error("No active stage to submit draft for.");
        }
        const stageDef = STAGE_DEFINITIONS[targetStageId];
        if (!stageDef) {
            throw new Error(`Unknown stage '${targetStageId}'`);
        }
        const artifactName = params.artifactName || stageDef.defaultArtifactName;
        const relArtifactPath = await saveStageArtifact(intent.intentId, stageDef.phase, artifactName, params.content, ws);
        // Evaluate against Socratic Rubric
        const evaluation = evaluateRubric(targetStageId, params.content);
        // Update StageState in intent
        const stageIndex = intent.stages.findIndex((s) => s.id === targetStageId);
        if (stageIndex !== -1) {
            const stage = intent.stages[stageIndex];
            stage.artifactPath = relArtifactPath;
            stage.unresolvedProbes = evaluation.unresolvedProbes;
            if (evaluation.satisfied) {
                stage.status = "rubric_satisfied";
            }
            else {
                stage.status = "in_progress";
            }
            await persistIntentState(intent, ws);
        }
        return {
            evaluation,
            artifactPath: relArtifactPath,
            stageUpdated: stageIndex !== -1,
        };
    }
    /**
     * Approves a stage gate and advances the intent state machine.
     */
    static async approveGate(params) {
        const ws = params.workspaceDir || getWorkspaceDir();
        const intent = params.intentId ? await loadIntentState(params.intentId, ws) : await loadActiveIntentState(ws);
        if (!intent) {
            throw new Error("No active intent found.");
        }
        const currentIdx = intent.currentStageIndex;
        if (currentIdx >= intent.stages.length) {
            return {
                success: true,
                previousStageId: "",
                nextStageId: null,
                workflowComplete: true,
                message: "Workflow is already completed.",
            };
        }
        const currentStage = intent.stages[currentIdx];
        const requestedStageId = params.stageId || currentStage.id;
        if (requestedStageId !== currentStage.id) {
            throw new Error(`Current stage is '${currentStage.id}', but approval was requested for '${requestedStageId}'.`);
        }
        // Verify rubric satisfaction unless forced
        if (!params.force && currentStage.status !== "rubric_satisfied") {
            throw new Error(`Stage '${currentStage.id}' has not met the Socratic rubric yet (status: '${currentStage.status}'). Submit a draft artifact and satisfy all rubric dimensions before approving.`);
        }
        // Mark current stage as approved
        currentStage.status = "approved";
        currentStage.approvedAt = new Date().toISOString();
        currentStage.gateNotes = params.notes || "Gate approved by user.";
        // Advance to next stage
        const nextIdx = currentIdx + 1;
        intent.currentStageIndex = nextIdx;
        let nextStageId = null;
        let workflowComplete = false;
        if (nextIdx < intent.stages.length) {
            const nextStage = intent.stages[nextIdx];
            nextStage.status = "in_progress";
            nextStageId = nextStage.id;
        }
        else {
            intent.status = "completed";
            workflowComplete = true;
        }
        await persistIntentState(intent, ws);
        return {
            success: true,
            previousStageId: currentStage.id,
            nextStageId,
            workflowComplete,
            message: workflowComplete
                ? `Stage '${currentStage.id}' approved. Full AI-DLC workflow completed!`
                : `Stage '${currentStage.id}' approved. Advanced to stage '${nextStageId}'.`,
        };
    }
}
//# sourceMappingURL=state-machine.js.map