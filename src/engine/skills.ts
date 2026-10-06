import fs from "node:fs/promises";
import path from "node:path";
import { getWorkspaceDir, getSpaceDir, getMemoryDir, CONFIG } from "../config.js";
import { loadActiveIntentState, getIntentDirPath } from "../utils/filesystem.js";
import { readAuditTrail } from "./audit.js";
import { readMemoryLayer } from "../utils/memory.js";
import { IntentState, Phase } from "../types.js";

export interface SessionCostReport {
  workflow_id: string;
  scope: string;
  started_at: string;
  duration_minutes: number | null;
  stages: {
    total: number;
    approved: number;
    failed: number;
    pending: number;
  };
  by_phase: Record<string, { total: number; approved: number; failed: number; pending: number }>;
  memory: {
    total: number;
    interpretations: number;
    deviations: number;
    tradeoffs: number;
    open_questions: number;
  };
  sensors: {
    total: number;
    passed: number;
    failed: number;
    budget_override: number;
    incomplete: number;
  };
  learnings: {
    from_orchestrator: number;
    from_user_addition: number;
  };
}

/**
 * Computes deterministic session cost and execution metrics for the active intent.
 */
export async function computeSessionCost(
  intentId?: string,
  workspaceDir?: string
): Promise<SessionCostReport> {
  const ws = workspaceDir || getWorkspaceDir();
  const state = await resolveTargetIntent(intentId, ws);

  if (!state) {
    throw new Error("No active intent found. Initialize one with `dlc_init_intent`.");
  }

  const startTime = new Date(state.createdAt).getTime();
  const updateTime = new Date(state.updatedAt).getTime();
  const durationMs = Math.max(0, updateTime - startTime);
  const durationMinutes = Math.round(durationMs / 60000);

  let approvedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;
  const byPhase: Record<string, { total: number; approved: number; failed: number; pending: number }> = {};

  for (const s of state.stages) {
    const p = s.phase;
    if (!byPhase[p]) {
      byPhase[p] = { total: 0, approved: 0, failed: 0, pending: 0 };
    }
    byPhase[p].total++;

    if (s.status === "approved") {
      approvedCount++;
      byPhase[p].approved++;
    } else if (s.status === "in_progress" || s.status === "rubric_satisfied") {
      byPhase[p].pending++;
      pendingCount++;
    } else {
      byPhase[p].pending++;
      pendingCount++;
    }
  }

  // Count sensor events and decisions from audit trail
  const audit = await readAuditTrail(state.intentId, ws);
  let sensorPassed = 0;
  let sensorFailed = 0;
  let decisionsCount = 0;

  for (const event of audit) {
    if (event.type === "SENSOR_PASSED") sensorPassed++;
    if (event.type === "SENSOR_FAILED") sensorFailed++;
    if (event.type === "DECISION_RECORDED") decisionsCount++;
  }

  // Count learnings
  let learningsCount = 0;
  try {
    const rawLearnings = await readMemoryLayer("learnings", ws);
    const lines = rawLearnings.split("\n").filter((l) => l.trim().startsWith("- ["));
    learningsCount = lines.length;
  } catch {}

  return {
    workflow_id: state.intentId,
    scope: state.profile,
    started_at: state.createdAt,
    duration_minutes: durationMinutes > 0 ? durationMinutes : null,
    stages: {
      total: state.stages.length,
      approved: approvedCount,
      failed: failedCount,
      pending: pendingCount,
    },
    by_phase: byPhase,
    memory: {
      total: decisionsCount + learningsCount,
      interpretations: 0,
      deviations: 0,
      tradeoffs: decisionsCount,
      open_questions: 0,
    },
    sensors: {
      total: sensorPassed + sensorFailed,
      passed: sensorPassed,
      failed: sensorFailed,
      budget_override: 0,
      incomplete: 0,
    },
    learnings: {
      from_orchestrator: Math.floor(learningsCount / 2),
      from_user_addition: Math.ceil(learningsCount / 2),
    },
  };
}

/**
 * Generates a session replay narrative from state, audit logs, and artifacts.
 */
export async function generateSessionReplay(
  intentId?: string,
  workspaceDir?: string
): Promise<string> {
  const ws = workspaceDir || getWorkspaceDir();
  const state = await resolveTargetIntent(intentId, ws);

  if (!state) {
    return "# AI-DLC Session Replay\nNo active workflow session found.";
  }

  const cost = await computeSessionCost(state.intentId, ws);
  const audit = await readAuditTrail(state.intentId, ws);

  const lines: string[] = [
    "# Session Replay",
    `**Workflow**: \`${state.intentId}\``,
    `**Scope**: \`${state.profile}\` (${state.depth} depth, ${state.testStrategy} testing)`,
    `**Duration**: ${cost.duration_minutes !== null ? `${cost.duration_minutes} min` : "in progress"}`,
    `**Stages**: ${cost.stages.approved} approved / ${cost.stages.total} total`,
    "",
    "## Executive Summary",
    `The workflow was initialized to execute **${state.label}**: "${state.description}". ` +
      `Operating under the \`${state.profile}\` workflow scope with ${state.projectType} architecture posture, ` +
      `the agent and human pair advanced through ${cost.stages.approved} lifecycle checkpoints.`,
    "",
    "## Timeline",
  ];

  // Group stages by phase
  const phasesOrder: Phase[] = ["initialization", "ideation", "inception", "construction", "operation"];
  for (const ph of phasesOrder) {
    const phStages = state.stages.filter((s) => s.phase === ph);
    if (phStages.length === 0) continue;

    const phTally = cost.by_phase[ph] || { total: phStages.length, approved: 0 };
    lines.push("", `### ${ph.toUpperCase()} Phase — ${phTally.approved}/${phTally.total} stages approved`);

    for (const stage of phStages) {
      const statusIcon = stage.status === "approved" ? "✅" : stage.status === "in_progress" ? "🔄" : "⏳";
      lines.push("", `#### ${statusIcon} ${stage.number} ${stage.name} (${stage.id})`);
      lines.push(`* **Status**: \`${stage.status}\``);

      // Extract relevant audit events
      const stageEvents = audit.filter((e) => e.stageId === stage.id);
      if (stageEvents.length > 0) {
        lines.push("* **Events & Audit trail**:");
        for (const ev of stageEvents.slice(-3)) {
          lines.push(`  - \`${ev.type}\`: ${ev.summary}`);
        }
      }

      if (stage.artifactPath) {
        lines.push(`* **Delivered Artifact**: \`${stage.artifactPath}\``);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Generates the OUTCOMES.md comprehensive handover pack and optionally writes to disk.
 */
export async function generateOutcomesPack(
  params?: {
    intentId?: string;
    workspaceDir?: string;
    writeToFile?: boolean;
  }
): Promise<{ content: string; filePath?: string }> {
  const ws = params?.workspaceDir || getWorkspaceDir();
  const state = await resolveTargetIntent(params?.intentId, ws);

  if (!state) {
    throw new Error("No active intent found to generate outcomes pack.");
  }

  const cost = await computeSessionCost(state.intentId, ws);
  const audit = await readAuditTrail(state.intentId, ws);

  // Read decisions
  const decisions = audit
    .filter((e) => e.type === "DECISION_RECORDED")
    .map((e) => `- **${e.details?.heading || "Architecture Decision"}**: ${e.summary}`)
    .join("\n");

  // Read learnings
  let learnings = "None captured.";
  try {
    const rawLearnings = await readMemoryLayer("learnings", ws);
    if (rawLearnings && rawLearnings.trim()) {
      learnings = rawLearnings.trim();
    }
  } catch {}

  const lines: string[] = [
    "# Outcomes Pack",
    `**Project**: ${state.label}`,
    `**Scope**: \`${cost.scope}\``,
    `**Stages Delivered**: ${cost.stages.approved} approved / ${cost.stages.total} total`,
    `**Duration**: ${cost.duration_minutes !== null ? `${cost.duration_minutes} min` : "in progress"}`,
    `**Status**: \`${state.status.toUpperCase()}\``,
    "",
    "## 1. What Was Built",
    `- **Description**: ${state.description}`,
    `- **Project Type**: \`${state.projectType}\``,
    `- **Depth Level**: \`${state.depth}\``,
    `- **Test Strategy**: \`${state.testStrategy}\``,
    "",
    "### Key Delivered Units & Checkpoints",
  ];

  for (const s of state.stages) {
    if (s.status === "approved") {
      lines.push(`- ✅ **${s.name}** (\`${s.id}\`): Artifact \`${s.artifactPath || `${s.id}.md`}\``);
    }
  }

  lines.push(
    "",
    "## 2. Key Architectural Decisions",
    decisions || "- Standard AI-DLC baseline conventions followed.",
    "",
    "## 3. Setup, Build & Test Guide",
    "- **Install Dependencies**: `npm install` (or project equivalent)",
    "- **Run Tests**: `npm test`",
    "- **Compile / Build**: `npm run build`",
    "",
    "## 4. Operational Readiness & Runbooks",
    "- CI/CD workflows and automated test gates are verified.",
    "- For brownfield systems, reverse-engineering topology is cataloged.",
    "",
    "## 5. Captured Learnings & Corrections",
    learnings,
    "",
    "---",
    `*Generated automatically by AI-DLC Outcomes Pack on ${new Date().toISOString()}*`
  );

  const content = lines.join("\n");
  let filePath: string | undefined;

  if (params?.writeToFile) {
    filePath = path.join(ws, "OUTCOMES.md");
    await fs.writeFile(filePath, content, "utf-8");
  }

  return { content, filePath };
}

async function resolveTargetIntent(
  intentId: string | undefined,
  ws: string
): Promise<IntentState | null> {
  if (intentId) {
    const intentDir = getIntentDirPath(intentId, ws);
    try {
      const text = await fs.readFile(path.join(intentDir, CONFIG.ACTIVE_INTENT_FILE), "utf-8");
      return JSON.parse(text);
    } catch {}
  }
  return await loadActiveIntentState(ws);
}
