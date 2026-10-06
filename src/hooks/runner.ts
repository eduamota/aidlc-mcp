import { HookEvent, HookContext, HookResult } from "../types.js";
import { loadActiveIntentState } from "../utils/filesystem.js";
import { getWorkspaceDir } from "../config.js";
import { appendAuditLog } from "../engine/audit.js";

/**
 * Executes an AI-DLC lifecycle hook event.
 */
export async function executeHook(context: HookContext): Promise<HookResult> {
  const ws = context.workspaceDir || getWorkspaceDir();
  const activeIntent = await loadActiveIntentState(ws);

  switch (context.event) {
    case "session-start": {
      if (!activeIntent) {
        return {
          action: "allow",
          message: "No active AI-DLC intent. Use `dlc_init_intent` to begin a scoped workflow.",
        };
      }

      await appendAuditLog(
        {
          type: "SESSION_STARTED",
          intentId: activeIntent.intentId,
          summary: `Session started/resumed for intent '${activeIntent.intentId}' (source: ${context.sessionSource || "startup"}).`,
          details: { source: context.sessionSource },
        },
        ws
      );

      const currentStage = activeIntent.stages[activeIntent.currentStageIndex];
      const gateStatus =
        currentStage?.status === "rubric_satisfied"
          ? "READY FOR APPROVAL"
          : currentStage?.status === "approved"
          ? "APPROVED"
          : "IN PROGRESS";

      const contextPayload = [
        `[AI-DLC Active Session Context]`,
        `* Active Intent: \`${activeIntent.intentId}\` (${activeIntent.label}, scope: \`${activeIntent.profile}\`)`,
        `* Current Stage: Stage ${currentStage?.number || "?"} - **${currentStage?.name || "None"}** (${currentStage?.status || "unknown"})`,
        `* Gate Status: **${gateStatus}**`,
        `* Contract Reminder: Enforce the Voice Contract (narrate work, not plumbing), and respect HARD STOP approval gates.`,
      ].join("\n");

      return {
        action: "allow",
        contextPayload,
        message: `Injected workflow context for intent '${activeIntent.intentId}'.`,
      };
    }

    case "session-end": {
      if (activeIntent) {
        await appendAuditLog(
          {
            type: "SESSION_ENDED",
            intentId: activeIntent.intentId,
            summary: `Session ended for intent '${activeIntent.intentId}'.`,
          },
          ws
        );
      }
      return { action: "allow" };
    }

    case "pre-tool": {
      const toolName = context.toolArgs?.name || context.toolName || "";
      const pathArg = context.toolArgs?.path || context.toolArgs?.target || "";

      // Refuse direct edits to state or audit logs
      if (typeof pathArg === "string" && (pathArg.includes("aidlc-state.md") || pathArg.includes("/audit/"))) {
        return {
          action: "block",
          message: `[STATE_TRANSITION_GUARD] Direct edits to '${pathArg}' are prohibited. State and audit mutations must occur through AI-DLC MCP tools.`,
        };
      }

      return { action: "allow" };
    }

    case "post-tool": {
      return { action: "allow" };
    }

    case "stop": {
      if (!activeIntent) {
        return { action: "allow" };
      }

      const currentStage = activeIntent.stages[activeIntent.currentStageIndex];

      // Legitimate turn stops:
      // 1. Stage rubric is satisfied and waiting for human gate approval (HARD STOP rule)
      if (currentStage?.status === "rubric_satisfied") {
        return {
          action: "allow",
          message: "Stopping turn at approval gate checkpoint. Waiting for explicit human confirmation.",
        };
      }

      // 2. Entire workflow is complete
      if (activeIntent.status === "completed" || activeIntent.currentStageIndex >= activeIntent.stages.length) {
        return {
          action: "allow",
          message: "All workflow stages completed.",
        };
      }

      // 3. In-progress stage with questions or normal turn stop
      return {
        action: "allow",
        message: "Turn completed.",
      };
    }

    case "statusline": {
      if (!activeIntent) {
        return {
          action: "notify",
          message: "AI-DLC: Inactive",
        };
      }

      const currentStage = activeIntent.stages[activeIntent.currentStageIndex];
      const gateIcon =
        currentStage?.status === "rubric_satisfied"
          ? "🟡 Gate Pending"
          : currentStage?.status === "approved"
          ? "🟢 Approved"
          : "🔵 Working";

      const status = `[AI-DLC: ${activeIntent.label}] Stage ${currentStage?.number || "?"} (${currentStage?.name || "None"}) | ${gateIcon}`;

      return {
        action: "notify",
        message: status,
      };
    }

    default:
      return { action: "allow" };
  }
}
