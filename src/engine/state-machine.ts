import fs from "node:fs/promises";
import path from "node:path";
import { IntentState, ScopeType, ProjectType, DepthLevel, TestStrategy, RubricEvaluationResult } from "../types.js";
import { SCOPES, createStagesForScope } from "./profiles.js";
import { STAGE_DEFINITIONS, evaluateRubric } from "./socratic-rubric.js";
import {
  generateIntentId,
  scaffoldIntent,
  loadActiveIntentState,
  loadIntentState,
  persistIntentState,
  saveStageArtifact,
  setActiveIntent,
  getIntentDirPath,
} from "../utils/filesystem.js";
import { getWorkspaceDir } from "../config.js";

export class DlcStateMachine {
  /**
   * Initializes a new Intent with selected scope/profile, depth, and test strategy.
   */
  public static async initIntent(params: {
    label: string;
    description: string;
    profile?: ScopeType;
    projectType?: ProjectType;
    depth?: DepthLevel;
    testStrategy?: TestStrategy;
    workspaceDir?: string;
  }): Promise<{ intent: IntentState; intentDir: string }> {
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

    const intent: IntentState = {
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
  public static async switchIntent(intentId: string, workspaceDir?: string): Promise<IntentState> {
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
  public static async getStatus(intentId?: string, workspaceDir?: string): Promise<{
    intent: IntentState | null;
    currentStage: (typeof STAGE_DEFINITIONS)[string] | null;
    activeStageState: any;
    isComplete: boolean;
  }> {
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
  public static async submitDraft(params: {
    stageId?: string;
    artifactName?: string;
    content: string;
    intentId?: string;
    workspaceDir?: string;
  }): Promise<{
    evaluation: RubricEvaluationResult;
    artifactPath: string;
    stageUpdated: boolean;
  }> {
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
      } else {
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
  public static async approveGate(params: {
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
  }> {
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
      throw new Error(
        `Stage '${currentStage.id}' has not met the Socratic rubric yet (status: '${currentStage.status}'). Submit a draft artifact and satisfy all rubric dimensions before approving.`
      );
    }

    // Mark current stage as approved
    currentStage.status = "approved";
    currentStage.approvedAt = new Date().toISOString();
    currentStage.gateNotes = params.notes || "Gate approved by user.";

    // Advance to next stage
    const nextIdx = currentIdx + 1;
    intent.currentStageIndex = nextIdx;

    let nextStageId: string | null = null;
    let workflowComplete = false;

    if (nextIdx < intent.stages.length) {
      const nextStage = intent.stages[nextIdx];
      nextStage.status = "in_progress";
      nextStageId = nextStage.id;
    } else {
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

  /**
   * Logs a non-gate structured decision made during Socratic interview (§2).
   */
  public static async logDecision(params: {
    stageId?: string;
    decision: string;
    rationale: string;
    optionsConsidered?: string[];
    intentId?: string;
    workspaceDir?: string;
  }): Promise<{ logged: boolean; count: number }> {
    const ws = params.workspaceDir || getWorkspaceDir();
    const intent = params.intentId ? await loadIntentState(params.intentId, ws) : await loadActiveIntentState(ws);
    if (!intent) throw new Error("No active intent found.");

    const intentDir = getIntentDirPath(intent.intentId, ws);
    const decPath = path.join(intentDir, "decisions.json");

    let existing: any[] = [];
    try {
      const raw = await fs.readFile(decPath, "utf-8");
      existing = JSON.parse(raw);
    } catch {}

    const entry = {
      id: `dec-${Date.now()}`,
      stageId: params.stageId || intent.stages[intent.currentStageIndex]?.id,
      decision: params.decision,
      rationale: params.rationale,
      optionsConsidered: params.optionsConsidered || [],
      timestamp: new Date().toISOString(),
    };

    existing.push(entry);
    await fs.writeFile(decPath, JSON.stringify(existing, null, 2), "utf-8");

    return { logged: true, count: existing.length };
  }

  /**
   * Dispatches independent reviewer verification according to §12a.
   */
  public static async requestReview(params: {
    stageId?: string;
    reviewer?: string;
    intentId?: string;
    workspaceDir?: string;
  }): Promise<{
    stageId: string;
    reviewer: string;
    verdict: "APPROVED" | "REVISE" | "ADVISORY";
    findings: string[];
    reviewSummary: string;
  }> {
    const ws = params.workspaceDir || getWorkspaceDir();
    const intent = params.intentId ? await loadIntentState(params.intentId, ws) : await loadActiveIntentState(ws);
    if (!intent) throw new Error("No active intent found.");

    const currentStage = intent.stages[intent.currentStageIndex];
    const targetStageId = params.stageId || currentStage?.id;
    if (!targetStageId) throw new Error("No stage specified.");

    const stageState = intent.stages.find((s) => s.id === targetStageId);
    if (!stageState || !stageState.artifactPath) {
      throw new Error(`Stage '${targetStageId}' has no submitted artifact to review.`);
    }

    const artifactFullPath = path.join(ws, stageState.artifactPath);
    let content = "";
    try {
      content = await fs.readFile(artifactFullPath, "utf-8");
    } catch {
      throw new Error(`Could not read artifact at '${stageState.artifactPath}'`);
    }

    const evalResult = evaluateRubric(targetStageId, content);
    const reviewerName = params.reviewer || `${targetStageId}-reviewer`;

    let verdict: "APPROVED" | "REVISE" | "ADVISORY" = "APPROVED";
    const findings: string[] = [];

    if (!evalResult.satisfied) {
      verdict = "REVISE";
      findings.push(...evalResult.unresolvedProbes.map((p) => `Unresolved dimension: ${p}`));
    } else if (evalResult.score < 1.0) {
      verdict = "ADVISORY";
      findings.push("Artifact meets minimum rubric criteria; minor architectural clarifications recommended.");
    } else {
      verdict = "APPROVED";
      findings.push("All required rubric criteria and boundary conditions verified.");
    }

    // Save review file under intent record dir
    const intentDir = getIntentDirPath(intent.intentId, ws);
    const reviewsDir = path.join(intentDir, "reviews");
    await fs.mkdir(reviewsDir, { recursive: true });

    const reviewFilename = `${targetStageId}-review.json`;
    await fs.writeFile(
      path.join(reviewsDir, reviewFilename),
      JSON.stringify(
        {
          stageId: targetStageId,
          reviewer: reviewerName,
          verdict,
          findings,
          score: evalResult.score,
          reviewedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );

    return {
      stageId: targetStageId,
      reviewer: reviewerName,
      verdict,
      findings,
      reviewSummary: `Independent review by '${reviewerName}': verdict ${verdict}.`,
    };
  }

  /**
   * Reopens a stage according to Recovery Protocol.
   */
  public static async reopenStage(params: {
    stageId: string;
    reason?: string;
    intentId?: string;
    workspaceDir?: string;
  }): Promise<{ success: boolean; reopenedStageId: string; message: string }> {
    const ws = params.workspaceDir || getWorkspaceDir();
    const intent = params.intentId ? await loadIntentState(params.intentId, ws) : await loadActiveIntentState(ws);
    if (!intent) throw new Error("No active intent found.");

    const targetIdx = intent.stages.findIndex((s) => s.id === params.stageId);
    if (targetIdx === -1) {
      throw new Error(`Stage '${params.stageId}' not found in intent roadmap.`);
    }

    intent.currentStageIndex = targetIdx;
    const stage = intent.stages[targetIdx];
    stage.status = "in_progress";
    delete stage.approvedAt;
    stage.gateNotes = params.reason ? `Reopened: ${params.reason}` : "Reopened by user request.";

    await persistIntentState(intent, ws);

    return {
      success: true,
      reopenedStageId: stage.id,
      message: `Reopened Stage ${stage.number} (${stage.name}). Files preserved for revision.`,
    };
  }
}

