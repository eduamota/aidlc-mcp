import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DlcStateMachine } from "../engine/state-machine.js";
import { evaluateRubric, STAGE_DEFINITIONS } from "../engine/socratic-rubric.js";
import { listAllIntents, loadActiveIntentState } from "../utils/filesystem.js";
import { SCOPES, detectScopeFromPrompt, getScopeSpec, getAllScopeSpecs } from "../engine/profiles.js";
import { scanWorkspaceForReverseEngineering } from "../utils/reverse-engineering.js";
import { runDlcDoctor } from "../utils/doctor.js";
import { addKnowledgeDocument, listKnowledgeDocuments, readKnowledgeDocument } from "../utils/knowledge.js";
import { getStageSpec, getAllStageSpecs } from "../stages/registry.js";
import { readAuditTrail } from "../engine/audit.js";
import { executeHook } from "../hooks/runner.js";
import { installHooks } from "../hooks/installer.js";
import fs from "node:fs/promises";
import path from "node:path";
import { getWorkspaceDir, setActiveWorkspaceDir, getActiveWorkspaceDir } from "../config.js";
import {
  resolveActiveMemory,
  getMemoryRule,
  updateMemoryRule,
  recordLearning,
  readMemoryLayer,
} from "../utils/memory.js";
import { runStageSensors } from "../engine/sensors.js";
import { getSensorSpec, getAllSensorSpecs } from "../sensors/registry.js";
import {
  computeSessionCost,
  generateSessionReplay,
  generateOutcomesPack,
} from "../engine/skills.js";
import { getSkillSpec, getAllSkillSpecs } from "../skills/registry.js";
import { loadAllExtensions } from "../engine/extensions.js";

const SKILL_ENUM = [
  "aidlc-outcomes-pack",
  "aidlc-replay",
  "aidlc-session-cost",
  "aidlc-knowledge",
] as const;

const SENSOR_ENUM = [
  "claim-sources",
  "required-sections",
  "traceability",
  "upstream-coverage",
  "type-check",
  "linter",
] as const;

const SCOPE_ENUM_STRICT = [
  "enterprise",
  "feature",
  "mvp",
  "poc",
  "bugfix",
  "refactor",
  "infra",
  "security-patch",
  "classic",
  "workshop",
  "express",
] as const;

const SCOPE_ENUM = [
  "auto",
  ...SCOPE_ENUM_STRICT,
] as const;

const workspaceSchema = z
  .string()
  .optional()
  .describe("Optional target project workspace root path. Anchors the active workspace for this and subsequent tool calls.");

function resolveWs(workspace?: string): string {
  if (workspace && typeof workspace === "string" && workspace.trim() !== "" && workspace.trim() !== "/") {
    setActiveWorkspaceDir(workspace);
    return path.resolve(workspace.trim());
  }
  return getWorkspaceDir();
}

export function registerDlcTools(server: McpServer): void {
  // 1. dlc_doctor: System Health & Diagnostics
  server.tool(
    "dlc_doctor",
    "Run comprehensive AI-DLC environment and workspace diagnostics (checks Node.js, Git, permissions, active space, and intent health).",
    {
      workspace: workspaceSchema,
    },
    async ({ workspace }) => {
      try {
        const ws = workspace ? resolveWs(workspace) : undefined;
        const report = await runDlcDoctor(ws);
        const statusEmoji = report.overallStatus === "healthy" ? "✅" : report.overallStatus === "warning" ? "⚠️" : "❌";

        const lines = [
          `# ${statusEmoji} AI-DLC Doctor Diagnostic Report`,
          `* **Overall Status**: \`${report.overallStatus.toUpperCase()}\``,
          `* **Workspace**: \`${report.workspaceDir}\``,
          `* **Active Space**: \`${report.activeSpace}\``,
          "",
          "## Diagnostic Checks:",
        ];

        for (const check of report.checks) {
          const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
          lines.push(`* ${icon} **${check.name}**: ${check.message}`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Doctor failed: ${err.message}` }],
        };
      }
    }
  );

  // 2. dlc_init_intent: Scoped Lifecycle Initialization
  server.tool(
    "dlc_init_intent",
    "Initialize an AI-DLC intent with an adaptive workflow scope (enterprise, feature, mvp, poc, bugfix, refactor, infra, security-patch, classic, workshop, express), depth, and test strategy.",
    {
      label: z.string().describe("Hyphenated label for the intent (e.g. 'inventory-api', 'auth-migration')"),
      description: z.string().describe("Comprehensive description of what is being built or resolved"),
      scope: z
        .string()
        .optional()
        .default("auto")
        .describe("Workflow scope profile: 'auto' (detects based on description/keywords), any built-in scope (enterprise, feature, mvp, poc, bugfix, refactor, infra, security-patch, classic, workshop, express), or any custom extension scope"),
      depth: z
        .enum(["comprehensive", "standard", "minimal"])
        .optional()
        .describe("Depth of documentation detail (defaults to scope default)"),
      testStrategy: z
        .enum(["comprehensive", "standard", "minimal"])
        .optional()
        .describe("Test coverage strategy (defaults to scope default)"),
      projectType: z
        .enum(["greenfield", "brownfield", "auto"])
        .optional()
        .default("auto")
        .describe("Project type: 'greenfield' (new project), 'brownfield' (existing code, injects reverse-engineering), or 'auto' (scans workspace automatically)"),
      workspace: workspaceSchema,
    },
    async ({ label, description, scope, depth, testStrategy, projectType, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        let resolvedType: "greenfield" | "brownfield" = "greenfield";
        if (projectType === "auto") {
          const scan = await scanWorkspaceForReverseEngineering(ws);
          resolvedType = scan.projectType;
        } else {
          resolvedType = projectType;
        }

        let resolvedScope = scope;
        if (resolvedScope === "auto") {
          resolvedScope = detectScopeFromPrompt(`${label} ${description}`) || "feature";
        }

        const { intent, intentDir } = await DlcStateMachine.initIntent({
          label,
          description,
          profile: resolvedScope as any,
          projectType: resolvedType,
          depth,
          testStrategy,
          workspaceDir: ws,
        });

        const activeStage = intent.stages[0];
        const stageDef = STAGE_DEFINITIONS[activeStage.id];
        const scopeDef = SCOPES[intent.profile];

        const output = [
          `# AI-DLC Intent Initialized: ${intent.intentId}`,
          `📁 **Record Directory**: \`${intentDir}\``,
          `🎯 **Scope**: \`${intent.profile}\` (${scopeDef.name})`,
          `🔍 **Project Classification**: \`${intent.projectType}\``,
          `📏 **Depth Level**: \`${intent.depth}\` | **Test Strategy**: \`${intent.testStrategy}\``,
          `📋 **Planned Stages**: ${intent.stages.length}`,
          "",
          `### 🚀 Active Stage: ${activeStage.number} ${activeStage.name}`,
          `* **Phase**: \`${activeStage.phase}\``,
          `* **Domain Expert**: \`${stageDef?.persona || "aidlc-agent"}\``,
          `* **Objective**: ${stageDef?.description}`,
          "",
          "### 🔍 Socratic Probes to Discuss:",
          ...(activeStage.unresolvedProbes || []).map((p) => `* ${p}`),
          "",
          "---",
          "Next: Adopt the assigned domain persona. Probe the user on these dimensions, draft the artifact, and submit via `dlc_submit_draft`.",
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to initialize intent: ${err.message}` }],
        };
      }
    }
  );

  // 3. dlc_get_status: Active Lifecycle Status
  server.tool(
    "dlc_get_status",
    "Get the current status, active intent, current stage, gate readiness, and unresolved Socratic probes.",
    {
      intentId: z.string().optional().describe("Optional intent ID. Defaults to the active intent."),
      workspace: workspaceSchema,
    },
    async ({ intentId, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const status = await DlcStateMachine.getStatus(intentId, ws);
        if (!status.intent) {
          return {
            content: [
              {
                type: "text",
                text: "No active AI-DLC intent found in this workspace. Call `dlc_init_intent` to begin a new workflow.",
              },
            ],
          };
        }

        const { intent, currentStage, activeStageState, isComplete } = status;
        if (isComplete) {
          return {
            content: [
              {
                type: "text",
                text: `🎉 AI-DLC Intent **${intent.intentId}** (${intent.label}) has completed all stages!`,
              },
            ],
          };
        }

        const output = [
          `# AI-DLC Status: ${intent.intentId}`,
          `* **Label**: ${intent.label}`,
          `* **Scope**: \`${intent.profile}\` (${intent.depth} depth, ${intent.testStrategy} tests)`,
          `* **Stage Progress**: Stage ${intent.currentStageIndex + 1} of ${intent.stages.length}`,
          "",
          `### Current Stage: ${activeStageState.number} ${activeStageState.name}`,
          `* **Phase**: \`${activeStageState.phase}\``,
          `* **Status**: \`${activeStageState.status}\``,
          `* **Domain Expert**: \`${currentStage?.persona}\``,
          activeStageState.artifactPath ? `* **Artifact**: \`${activeStageState.artifactPath}\`` : "* **Artifact**: Not yet submitted",
          "",
          "### Gate Status:",
          activeStageState.status === "rubric_satisfied"
            ? "✅ **Rubric Satisfied**: Ready for explicit human approval via `dlc_approve_gate`."
            : "⏳ **Rubric Incomplete**: Continue Socratic inquiry and update draft.",
          "",
          ...(activeStageState.unresolvedProbes && activeStageState.unresolvedProbes.length > 0
            ? ["### Unresolved Socratic Probes:", ...activeStageState.unresolvedProbes.map((p: string) => `* ${p}`)]
            : []),
        ].join("\n");

        return {
          content: [{ type: "text", text: output }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error getting status: ${err.message}` }],
        };
      }
    }
  );

  // 4. dlc_get_scope_matrix: Scope Routing Matrix
  server.tool(
    "dlc_get_scope_matrix",
    "View the AI-DLC scope routing table comparing all 11 scopes, their stage counts, depth levels, and test strategies.",
    {},
    async () => {
      const lines = [
        "# AI-DLC Scope Routing Matrix",
        "",
        "| Scope | Stages | Default Depth | Default Test Strategy | Description |",
        "|---|---|---|---|---|",
      ];

      for (const [key, s] of Object.entries(SCOPES)) {
        lines.push(`| \`${key}\` | ${s.stageIds.length} | ${s.defaultDepth} | ${s.defaultTestStrategy} | ${s.description} |`);
      }

      lines.push("");
      lines.push("Select any scope when calling `dlc_init_intent({ scope: '...' })`.");

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // 5. dlc_switch_intent: Switch Active Intent
  server.tool(
    "dlc_switch_intent",
    "Switch the workspace active intent to another existing intent.",
    {
      intentId: z.string().describe("The intent ID to activate (e.g. '261005-inventory-api')"),
    },
    async ({ intentId }) => {
      try {
        const intent = await DlcStateMachine.switchIntent(intentId);
        return {
          content: [
            {
              type: "text",
              text: `Switched active intent to **${intent.intentId}** (${intent.label}, scope: \`${intent.profile}\`, current stage: ${intent.currentStageIndex + 1}/${intent.stages.length}).`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to switch intent: ${err.message}` }],
        };
      }
    }
  );

  // 6. dlc_scan_workspace: Brownfield Code Discovery
  server.tool(
    "dlc_scan_workspace",
    "Scan the workspace for brownfield reverse engineering: detects runtimes, manifests, key directories, dependencies, and generates the baseline reverse-engineering documentation.",
    {
      autoSave: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, automatically saves the generated discovery report as reverse-engineering.md for the active intent."),
      intentId: z.string().optional().describe("Optional intent ID."),
    },
    async ({ autoSave, intentId }) => {
      try {
        const scan = await scanWorkspaceForReverseEngineering();

        let saveNotice = "";
        if (autoSave) {
          try {
            const sub = await DlcStateMachine.submitDraft({
              stageId: "reverse-engineering",
              artifactName: "reverse-engineering.md",
              content: scan.draftDocument,
              intentId,
            });
            saveNotice = `\n\n✅ **Auto-saved Artifact**: \`${sub.artifactPath}\` (Rubric satisfied: ${sub.evaluation.satisfied ? "Yes" : "No"})`;
          } catch (err: any) {
            saveNotice = `\n\n⚠️ Could not auto-save: ${err.message}`;
          }
        }

        const lines = [
          `# Workspace Discovery & Reverse Engineering Scan`,
          `* **Classification**: \`${scan.projectType}\``,
          `* **Runtimes**: ${scan.detectedRuntimes.length > 0 ? scan.detectedRuntimes.join(", ") : "None detected"}`,
          `* **Manifests**: ${scan.manifests.length > 0 ? scan.manifests.join(", ") : "None"}`,
          `* **Source Directories**: ${scan.keyDirectories.length > 0 ? scan.keyDirectories.join(", ") : "None"}`,
          `* **Dependencies**: ${scan.dependencies.length > 0 ? scan.dependencies.slice(0, 10).join(", ") : "Minimal"}`,
          saveNotice,
          "",
          "## Generated Reverse Engineering Baseline Document:",
          "```markdown",
          scan.draftDocument,
          "```",
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Workspace scan failed: ${err.message}` }],
        };
      }
    }
  );

  // 7. dlc_knowledge_add: Add Document to Two-Tier Knowledge Base
  server.tool(
    "dlc_knowledge_add",
    "Add or import a reference document (PRD, vision doc, architecture standard, or security policy) into the active space's knowledge base (`aidlc/spaces/default/knowledge/`).",
    {
      filename: z.string().describe("Filename to save as (e.g. 'vision.md', 'company-architecture-standards.md')"),
      content: z.string().describe("Full markdown or text content of the document"),
      category: z
        .enum(["shared", "agent", "documentkb"])
        .optional()
        .default("documentkb")
        .describe("Category: 'shared' (team-wide standard), 'agent' (agent-specific methodology), or 'documentkb' (intent reference document)"),
      agent: z.string().optional().describe("Agent persona name if category is 'agent' (e.g. 'aidlc-architect-agent')"),
    },
    async ({ filename, content, category, agent }) => {
      try {
        const doc = await addKnowledgeDocument({ filename, content, category, agent });
        return {
          content: [
            {
              type: "text",
              text: `Added knowledge document **${doc.filename}** at \`${doc.relativePath}\` (${doc.sizeBytes} bytes, category: \`${doc.category}\`).`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to add knowledge document: ${err.message}` }],
        };
      }
    }
  );

  // 8. dlc_knowledge_list: List Knowledge Documents
  server.tool(
    "dlc_knowledge_list",
    "List all available knowledge documents, standards, and references in the active space.",
    {},
    async () => {
      try {
        const docs = await listKnowledgeDocuments();
        if (docs.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Knowledge base is currently empty. Use `dlc_knowledge_add` to add PRDs, architectural standards, or policy documents.",
              },
            ],
          };
        }

        const lines = [
          `# Knowledge Base Documents (${docs.length})`,
          "| Document | Category | Size | Path |",
          "|---|---|---|---|",
        ];

        for (const d of docs) {
          lines.push(`| **${d.filename}** | \`${d.category}\` | ${d.sizeBytes} B | \`${d.relativePath}\` |`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to list knowledge: ${err.message}` }],
        };
      }
    }
  );

  // 9. dlc_knowledge_read: Read Knowledge Document
  server.tool(
    "dlc_knowledge_read",
    "Read the full contents of a knowledge base document by its filename or ID.",
    {
      identifier: z.string().describe("Filename or document ID (e.g. 'vision.md' or 'vision')"),
    },
    async ({ identifier }) => {
      try {
        const doc = await readKnowledgeDocument(identifier);
        if (!doc) {
          return {
            isError: true,
            content: [{ type: "text", text: `Knowledge document '${identifier}' not found.` }],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `# Knowledge Document: ${doc.filename}\nPath: \`${doc.relativePath}\`\n\n${doc.content}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to read knowledge: ${err.message}` }],
        };
      }
    }
  );

  // 10. dlc_check_rubric: Test Content against Socratic Rubric
  server.tool(
    "dlc_check_rubric",
    "Pre-evaluate draft content against a stage's Socratic rubric without saving to disk, discovering remaining probes and gaps.",
    {
      stageId: z.string().optional().describe("Stage ID (e.g. 'intent-capture', 'requirements-analysis', 'domain-design'). Defaults to active stage."),
      content: z.string().describe("Draft markdown or text content to evaluate against the rubric."),
      intentId: z.string().optional().describe("Optional intent ID."),
    },
    async ({ stageId, content, intentId }) => {
      try {
        let targetStageId = stageId;
        if (!targetStageId) {
          const status = await DlcStateMachine.getStatus(intentId);
          targetStageId = status.activeStageState?.id;
        }

        if (!targetStageId) {
          return {
            isError: true,
            content: [{ type: "text", text: "Target stage not specified and no active intent found." }],
          };
        }

        const evalResult = evaluateRubric(targetStageId, content);

        const lines = [
          `# Socratic Rubric Evaluation: ${targetStageId}`,
          `**Result**: ${evalResult.satisfied ? "✅ PASSED" : "❌ INCOMPLETE"} (Score: ${Math.round(evalResult.score * 100)}%)`,
          `**Summary**: ${evalResult.feedback}`,
          "",
          "### Dimension Breakdown:",
        ];

        for (const dim of evalResult.dimensionResults) {
          const icon = dim.satisfied ? "✅" : "❌";
          lines.push(`* ${icon} **${dim.title}**: ${dim.notes}`);
        }

        if (evalResult.unresolvedProbes.length > 0) {
          lines.push("");
          lines.push("### Lingering Socratic Questions:");
          for (const probe of evalResult.unresolvedProbes) {
            lines.push(`* ❓ ${probe}`);
          }
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to check rubric: ${err.message}` }],
        };
      }
    }
  );

  // 11. dlc_submit_draft: Save Stage Artifact & Evaluate Rubric
  server.tool(
    "dlc_submit_draft",
    "Submit and save a stage draft artifact to disk, validating it against the Socratic rubric and updating stage gate state.",
    {
      content: z.string().describe("Full markdown content of the artifact to save."),
      stageId: z.string().optional().describe("Stage ID. Defaults to the active stage."),
      artifactName: z.string().optional().describe("Custom artifact filename (e.g. 'requirements.md'). Defaults to standard stage artifact name."),
      intentId: z.string().optional().describe("Optional intent ID."),
      workspace: workspaceSchema,
    },
    async ({ content, stageId, artifactName, intentId, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const result = await DlcStateMachine.submitDraft({
          stageId,
          artifactName,
          content,
          intentId,
          workspaceDir: ws,
        });

        const { evaluation, artifactPath } = result;

        const lines = [
          `# Artifact Submitted: \`${artifactPath}\``,
          `**Rubric Status**: ${evaluation.satisfied ? "✅ Rubric Met" : "⚠️ Rubric Incomplete"} (${Math.round(evaluation.score * 100)}%)`,
          `**Feedback**: ${evaluation.feedback}`,
          "",
          "### Rubric Dimension Audit:",
        ];

        for (const d of evaluation.dimensionResults) {
          lines.push(`* ${d.satisfied ? "✅" : "❌"} **${d.title}**: ${d.notes}`);
        }

        if (evaluation.satisfied) {
          lines.push("");
          lines.push("🎉 **Ready for Approval Gate!**");
          lines.push("Ask the user for explicit approval, then call `dlc_approve_gate` to advance to the next stage.");
        } else {
          lines.push("");
          lines.push("### Mandatory Socratic Questions to Probe:");
          for (const p of evaluation.unresolvedProbes) {
            lines.push(`* ❓ ${p}`);
          }
          lines.push("");
          lines.push("Discuss these dimensions with the user, update the draft, and resubmit with `dlc_submit_draft`.");
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to submit draft: ${err.message}` }],
        };
      }
    }
  );

  // 12. dlc_approve_gate: Approval Gate Transition
  server.tool(
    "dlc_approve_gate",
    "Approve the stage gate after human verification and rubric satisfaction, advancing the workflow to the next lifecycle stage.",
    {
      stageId: z.string().optional().describe("The stage ID being approved. Defaults to active stage."),
      notes: z.string().optional().describe("Approval notes, user confirmation, or decisions recorded."),
      force: z.boolean().optional().default(false).describe("Set true to bypass rubric satisfaction check if explicitly requested by user."),
      intentId: z.string().optional().describe("Optional intent ID."),
      workspace: workspaceSchema,
    },
    async ({ stageId, notes, force, intentId, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const result = await DlcStateMachine.approveGate({
          stageId,
          notes,
          force,
          intentId,
          workspaceDir: ws,
        });

        const lines = [
          `# Gate Approved: Stage '${result.previousStageId}'`,
          `**Status**: ${result.workflowComplete ? "🎉 Full AI-DLC Workflow Complete!" : `Advanced to Stage '${result.nextStageId}'`}`,
          `**Notes**: ${notes || "Approved by user"}`,
          "",
          result.workflowComplete
            ? "All stages across the lifecycle are complete! Review the final artifacts under the intent directory."
            : `Next: Load prompt or persona for stage '${result.nextStageId}' and begin Socratic inquiry.`,
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Gate approval rejected: ${err.message}` }],
        };
      }
    }
  );

  // 13. dlc_list_intents: List Tracked Intents
  server.tool(
    "dlc_list_intents",
    "List all AI-DLC intents tracked in the current workspace.",
    {
      workspace: workspaceSchema,
    },
    async ({ workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const intents = await listAllIntents(ws);
      if (intents.length === 0) {
        return {
          content: [{ type: "text", text: "No intents found in `./aidlc/spaces/default/intents/`." }],
        };
      }

      const lines = [
        `# AI-DLC Intents in Workspace (${intents.length})`,
        ...intents.map((id) => `* \`${id}\``),
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Failed to list intents: ${err.message}` }],
      };
    }
  });

  // 14. dlc_get_setup_requirements: Setup & Client Config Guides
  server.tool(
    "dlc_get_setup_requirements",
    "Retrieve the exact system requirements, environment prerequisites, and step-by-step setup instructions for AI-DLC Socratic MCP across different AI assistants (Claude Code, Cursor, Codex, Claude Desktop).",
    {
      client: z
        .enum(["all", "claude-code", "cursor", "claude-desktop", "codex", "generic"])
        .optional()
        .default("all")
        .describe("Target AI client / harness to get specific instructions for (default: 'all')"),
      workspace: workspaceSchema,
    },
    async ({ client, workspace }) => {
      if (workspace) resolveWs(workspace);
      const selected = client || "all";
      const sections: string[] = [
        "# AI-DLC Socratic MCP: Setup & Environment Requirements",
        "",
        "## 1. System Prerequisites",
        "- **Node.js**: v18.0.0 or newer (Node 20+ LTS recommended). Verify with `node -v`.",
        "- **npm / npx**: v9.0.0 or newer. Verify with `npx -v`.",
        "- **Git**: Installed and available in PATH. Verify with `git --version`.",
        "- **Filesystem Permissions**: Full read/write access in your project root.",
        "- **Internet Access**: Required on initial run to download package dependencies if using `npx`.",
        "",
        "## 2. Workspace & Environment Configuration",
        "- **Default Workspace Directory**: By default, the server anchors to the working directory (`process.cwd()`) where your AI assistant launches.",
        "- **Custom Workspace Path (`AIDLC_WORKSPACE`)**: If your assistant runs in a separate directory from your project, set the `AIDLC_WORKSPACE` environment variable to your project's absolute path.",
        "- **Generated Artifact Directory**: The server will create and manage `./aidlc/spaces/default/intents/` inside that workspace.",
        "",
      ];

      const clientConfigs: Record<string, string> = {
        "claude-code": [
          "## 3. Claude Code CLI Setup",
          "Run this single command in your terminal to register the MCP server:",
          "```bash",
          "claude mcp add aidlc -- npx -y github:doitintl/aidlc-mcp",
          "```",
        ].join("\n"),

        "cursor": [
          "## 3. Cursor Setup",
          "Add to your project's `.cursor/mcp.json` or Cursor Global MCP Settings:",
          "```json",
          "{",
          '  "mcpServers": {',
          '    "aidlc": {',
          '      "command": "npx",',
          '      "args": ["-y", "github:doitintl/aidlc-mcp"]',
          "    }",
          "  }",
          "}",
          "```",
        ].join("\n"),

        "claude-desktop": [
          "## 3. Claude Desktop Setup",
          "Add to `claude_desktop_config.json`:",
          "```json",
          "{",
          '  "mcpServers": {',
          '    "aidlc": {',
          '      "command": "npx",',
          '      "args": ["-y", "github:doitintl/aidlc-mcp"]',
          "    }",
          "  }",
          "}",
          "```",
        ].join("\n"),

        "codex": [
          "## 3. Codex CLI Setup",
          "Configure in your Codex MCP configuration file:",
          "```json",
          "{",
          '  "mcpServers": {',
          '    "aidlc": {',
          '      "command": "npx",',
          '      "args": ["-y", "github:doitintl/aidlc-mcp"]',
          "    }",
          "  }",
          "}",
          "```",
        ].join("\n"),

        "generic": [
          "## 3. Generic Stdio MCP Host Setup",
          "- **Command**: `npx`",
          '- **Args**: `["-y", "github:doitintl/aidlc-mcp"]`',
          "- **Transport**: `stdio` (JSON-RPC over stdin/stdout, stderr for logs)",
        ].join("\n"),
      };

      if (selected === "all") {
        sections.push(clientConfigs["claude-code"]);
        sections.push("");
        sections.push(clientConfigs["cursor"]);
        sections.push("");
        sections.push(clientConfigs["claude-desktop"]);
        sections.push("");
        sections.push(clientConfigs["codex"]);
        sections.push("");
      } else if (clientConfigs[selected]) {
        sections.push(clientConfigs[selected]);
        sections.push("");
      }

      sections.push(
        "## 4. Verification & First Steps",
        "1. **Diagnostics**: Call `dlc_doctor` to verify your environment.",
        "2. **Check Matrix**: Call `dlc_get_scope_matrix` to review available scopes.",
        "3. **Start Workflow**: Call `dlc_init_intent({ label: 'my-feature', scope: 'feature', description: '...' })`.",
        "4. **Socratic Inquiry**: Probe unstated assumptions and edge cases.",
        "5. **Submit Draft**: Call `dlc_submit_draft({ content: '...' })` to check the stage rubric.",
        "6. **Gate Approval**: Explicit human sign-off enables `dlc_approve_gate` to advance the stage."
      );

      return {
        content: [{ type: "text", text: sections.join("\n") }],
      };
    }
  );

  // 15. dlc_log_decision: Protocol Non-Gate Decision Logger (§2)
  server.tool(
    "dlc_log_decision",
    "Log a non-gate architectural, technical, or trade-off decision into decisions.json (§2 Stage Protocol).",
    {
      decision: z.string().describe("Clear summary of the decision reached"),
      rationale: z.string().describe("Why this decision was chosen over alternatives"),
      optionsConsidered: z.array(z.string()).optional().describe("Alternative approaches considered"),
      stageId: z.string().optional().describe("Associated stage ID. Defaults to active stage."),
      intentId: z.string().optional().describe("Optional intent ID."),
      workspace: workspaceSchema,
    },
    async ({ decision, rationale, optionsConsidered, stageId, intentId, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const result = await DlcStateMachine.logDecision({
          decision,
          rationale,
          optionsConsidered,
          stageId,
          intentId,
          workspaceDir: ws,
        });
        return {
          content: [
            {
              type: "text",
              text: `Recorded decision into \`decisions.json\` (Total recorded: ${result.count}).\n* **Decision**: ${decision}\n* **Rationale**: ${rationale}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to log decision: ${err.message}` }],
        };
      }
    }
  );

  // 16. dlc_request_review: Independent Reviewer Invocation (§12a)
  server.tool(
    "dlc_request_review",
    "Dispatch an independent verification pass (§12a Reviewer Protocol) on a submitted stage artifact before gate presentation.",
    {
      stageId: z.string().optional().describe("Stage ID to review. Defaults to active stage."),
      reviewer: z.string().optional().describe("Reviewer persona name (e.g. 'aidlc-architecture-reviewer-agent')."),
      intentId: z.string().optional().describe("Optional intent ID."),
      workspace: workspaceSchema,
    },
    async ({ stageId, reviewer, intentId, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const result = await DlcStateMachine.requestReview({
          stageId,
          reviewer,
          intentId,
          workspaceDir: ws,
        });

        const icon = result.verdict === "APPROVED" ? "✅" : result.verdict === "ADVISORY" ? "ℹ️" : "⚠️";
        const lines = [
          `# ${icon} Reviewer Verdict: \`${result.verdict}\``,
          `* **Stage**: \`${result.stageId}\``,
          `* **Reviewer**: \`${result.reviewer}\``,
          `* **Summary**: ${result.reviewSummary}`,
          "",
          "## Findings:",
          ...result.findings.map((f) => `* ${f}`),
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Review request failed: ${err.message}` }],
        };
      }
    }
  );

  // 17. dlc_reopen_stage: Stage Reopen & Revision (Recovery Protocol)
  server.tool(
    "dlc_reopen_stage",
    "Reopen a previous stage back to 'in_progress' when requirements change or revisions are requested (Recovery Protocol), preserving all files.",
    {
      stageId: z.string().describe("Stage ID to reopen (e.g. 'domain-design', 'intent-capture')"),
      reason: z.string().optional().describe("Reason for reopening stage"),
      intentId: z.string().optional().describe("Optional intent ID."),
      workspace: workspaceSchema,
    },
    async ({ stageId, reason, intentId, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const result = await DlcStateMachine.reopenStage({
          stageId,
          reason,
          intentId,
          workspaceDir: ws,
        });

        return {
          content: [
            {
              type: "text",
              text: `🔄 ${result.message}\nStatus updated to \`in_progress\`. Use \`dlc_submit_draft\` when revisions are complete.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to reopen stage: ${err.message}` }],
        };
      }
    }
  );

  // 18. dlc_get_stage_spec: Official Upstream Stage Execution Specification
  server.tool(
    "dlc_get_stage_spec",
    "Retrieve the complete official AI-DLC step-by-step stage execution guide, frontmatter contracts, required inputs/outputs, and sensor rules from core/aidlc-common/stages/.",
    {
      stageId: z
        .string()
        .optional()
        .describe("Stage ID or slug (e.g. 'requirements-analysis', 'domain-design', 'intent-capture'). Defaults to active stage."),
      intentId: z.string().optional().describe("Optional intent ID."),
      workspace: workspaceSchema,
    },
    async ({ stageId, intentId, workspace }) => {
      try {
        const ws = workspace ? resolveWs(workspace) : undefined;
        let targetId = stageId;
        if (!targetId) {
          const status = await DlcStateMachine.getStatus(intentId, ws);
          targetId = status.activeStageState?.id;
        }

        if (!targetId) {
          return {
            isError: true,
            content: [{ type: "text", text: "No stage ID specified and no active intent found." }],
          };
        }

        const spec = getStageSpec(targetId);
        if (!spec) {
          const all = getAllStageSpecs().map((s) => s.slug).join(", ");
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Stage specification for '${targetId}' not found.\nAvailable stages:\n${all}`,
              },
            ],
          };
        }

        const metaLines = [
          `# Official Stage Specification: ${spec.name} (\`${spec.slug}\`)`,
          `* **Phase**: \`${spec.phase}\``,
          `* **Execution**: \`${spec.execution}\`${spec.condition ? ` (${spec.condition})` : ""}`,
          `* **Lead Agent**: \`${spec.lead_agent || "orchestrator"}\``,
          spec.reviewer ? `* **Reviewer Agent**: \`${spec.reviewer}\` (${spec.review_class || "advisory"})` : "",
          spec.produces && spec.produces.length > 0 ? `* **Produces Artifacts**: ${JSON.stringify(spec.produces)}` : "",
          spec.consumes && spec.consumes.length > 0 ? `* **Consumes Artifacts**: ${JSON.stringify(spec.consumes)}` : "",
          spec.sensors && spec.sensors.length > 0 ? `* **Sensors**: ${spec.sensors.join(", ")}` : "",
          spec.inputs ? `* **Inputs**: ${spec.inputs}` : "",
          spec.outputs ? `* **Outputs**: ${spec.outputs}` : "",
          "",
          "---",
          "",
          spec.markdown,
        ].filter(Boolean);

        return {
          content: [{ type: "text", text: metaLines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get stage spec: ${err.message}` }],
        };
      }
    }
  );

  // 19. dlc_get_audit_trail: Audit Trail Inspection
  server.tool(
    "dlc_get_audit_trail",
    "Inspect the append-only audit trail and lifecycle event log (<record>/audit/audit.jsonl) for the active intent.",
    {
      intentId: z.string().optional().describe("Optional intent ID. Defaults to active intent."),
      limit: z.number().optional().default(50).describe("Maximum number of recent events to retrieve (default: 50)."),
      workspace: workspaceSchema,
    },
    async ({ intentId, limit, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const events = await readAuditTrail(intentId, ws);
        if (events.length === 0) {
          return {
            content: [{ type: "text", text: "No audit events recorded yet." }],
          };
        }

        const recent = events.slice(-limit);
        const lines = [
          `# AI-DLC Audit Trail (${recent.length} recent events of ${events.length} total)`,
          "| Timestamp | Event Type | Stage | Summary |",
          "|---|---|---|---|",
        ];

        for (const e of recent) {
          lines.push(`| \`${e.timestamp}\` | \`${e.type}\` | \`${e.stageId || "-"}\` | ${e.summary} |`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to read audit trail: ${err.message}` }],
        };
      }
    }
  );

  // 20. dlc_install_hooks: Client Lifecycle Hooks Installer
  server.tool(
    "dlc_install_hooks",
    "Install and configure client harness lifecycle hooks (SessionStart, PreToolUse, Stop, statusLine) for Claude Code (.claude/settings.json), Cursor (.cursor/rules/), or Git (.git/hooks/pre-commit).",
    {
      target: z
        .enum(["all", "claude-code", "cursor", "git"])
        .optional()
        .default("all")
        .describe("Target client harness to install hooks into (default: 'all')"),
      workspace: workspaceSchema,
    },
    async ({ target, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const res = await installHooks({ target, workspaceDir: ws });
        const lines = [
          `# AI-DLC Lifecycle Hooks Installation`,
          `**Installed Components**:`,
          ...res.installed.map((i) => `* ✅ ${i}`),
        ];

        if (res.skipped.length > 0) {
          lines.push("", "**Skipped / Warnings**:");
          for (const s of res.skipped) lines.push(`* ⚠️ ${s}`);
        }

        if (res.instructions.length > 0) {
          lines.push("", "**Next Steps**:");
          for (const ins of res.instructions) lines.push(`* ${ins}`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to install hooks: ${err.message}` }],
        };
      }
    }
  );

  // 21. dlc_run_hook: Direct Lifecycle Hook Execution
  server.tool(
    "dlc_run_hook",
    "Manually execute an AI-DLC lifecycle hook event (session-start, pre-tool, stop, statusline) to evaluate guardrails and context.",
    {
      event: z
        .enum(["session-start", "session-end", "pre-tool", "post-tool", "stop", "statusline"])
        .describe("Hook event name to execute"),
      toolName: z.string().optional().describe("Tool name if executing pre-tool"),
      pathArg: z.string().optional().describe("Path argument if checking pre-tool"),
      workspace: workspaceSchema,
    },
    async ({ event, toolName, pathArg, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const res = await executeHook({
          event: event as any,
          toolName,
          toolArgs: pathArg ? { path: pathArg } : undefined,
          workspaceDir: ws,
        });

        const lines = [
          `# Hook Execution: \`${event}\``,
          `* **Action**: \`${res.action.toUpperCase()}\``,
          res.message ? `* **Message**: ${res.message}` : "",
          res.contextPayload ? `\n## Context Injected:\n\`\`\`\n${res.contextPayload}\n\`\`\`` : "",
        ].filter(Boolean);

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Hook execution failed: ${err.message}` }],
        };
      }
    }
  );

  // 22. dlc_memory_get: Query Layered Memory Rules or Resolve Composite Memory
  server.tool(
    "dlc_memory_get",
    "Query AI-DLC layered memory rules (org -> team -> project -> phase guardrails) or resolve active composite memory context.",
    {
      layer: z
        .enum([
          "active",
          "org",
          "team",
          "project",
          "learnings",
          "phases/ideation",
          "phases/inception",
          "phases/construction",
          "phases/operation",
        ])
        .optional()
        .default("active")
        .describe("Memory layer to retrieve: 'active' (composite hierarchy), 'org', 'team', 'project', 'learnings', or specific 'phases/*' guardrails"),
      heading: z
        .string()
        .optional()
        .describe("Optional H2 section heading to extract (e.g. 'Testing Posture', 'Way of Working', 'Code Completeness')"),
      phase: z
        .enum(["ideation", "inception", "construction", "operation"])
        .optional()
        .describe("Explicit phase for active guardrails resolution (defaults to active intent's phase)"),
      space: z.string().optional().describe("AI-DLC space name (defaults to default space)"),
      workspace: workspaceSchema,
    },
    async ({ layer, heading, phase, space, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        if (heading) {
          const ruleContent = await getMemoryRule(layer === "active" ? "team" : layer, heading, ws, space);
          if (!ruleContent) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Rule heading '## ${heading}' not found in memory layer '${layer}'.`,
                },
              ],
            };
          }
          const targetSpace = space || "default";
          const citation = `- [memory:M1] aidlc/spaces/${targetSpace}/memory/${layer}.md#${heading}`;
          return {
            content: [
              {
                type: "text",
                text: `# Memory Rule: \`${heading}\`\n**Provenance**: \`${citation}\`\n\n${ruleContent}`,
              },
            ],
          };
        }

        if (layer === "active") {
          let resolvedPhase = phase;
          if (!resolvedPhase) {
            const activeState = await loadActiveIntentState(ws);
            if (activeState) {
              const cur = activeState.stages[activeState.currentStageIndex];
              if (cur && ["ideation", "inception", "construction", "operation"].includes(cur.phase)) {
                resolvedPhase = cur.phase as any;
              }
            }
          }

          const mem = await resolveActiveMemory({ phase: resolvedPhase, space, workspaceDir: ws });
          return {
            content: [
              {
                type: "text",
                text: mem.combinedText,
              },
            ],
          };
        }

        const raw = await readMemoryLayer(layer, ws, space);
        return {
          content: [
            {
              type: "text",
              text: raw || `No content found for memory layer '${layer}'.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get memory: ${err.message}` }],
        };
      }
    }
  );

  // 23. dlc_memory_update: Affirm or Update Team/Project Rules
  server.tool(
    "dlc_memory_update",
    "Safely update or append an affirmed rule under a specific H2 heading in team.md or project.md (e.g. from practices-discovery or ADRs).",
    {
      layer: z
        .enum(["team", "project"])
        .describe("Memory layer to update ('team' for team-wide conventions, 'project' for repo-local constraints)"),
      heading: z
        .string()
        .describe("H2 section heading (e.g. 'Testing Posture', 'Way of Working', 'Mandated', 'Forbidden')"),
      content: z
        .string()
        .describe("Markdown text containing the affirmed rules or standards to persist under this heading"),
      space: z.string().optional().describe("AI-DLC space name (defaults to default space)"),
      workspace: workspaceSchema,
    },
    async ({ layer, heading, content, space, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const res = await updateMemoryRule(layer, heading, content, ws, space);
        const targetSpace = space || "default";
        const citation = `- [memory:M1] aidlc/spaces/${targetSpace}/memory/${layer}.md#${heading}`;

        return {
          content: [
            {
              type: "text",
              text: `# ✅ Memory Rule Updated\n* **Layer**: \`${layer}.md\`\n* **Heading**: \`## ${heading}\`\n* **File**: \`${res.filePath}\`\n* **Provenance Tag**: \`${citation}\`\n\n### Updated Content:\n${content.trim()}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to update memory rule: ${err.message}` }],
        };
      }
    }
  );

  // 24. dlc_memory_record_learning: Log Human Corrections & Discoveries
  server.tool(
    "dlc_memory_record_learning",
    "Record a human correction, architectural discovery, or runtime guidance to learnings.md.",
    {
      learning: z.string().describe("Specific human correction, pattern exception, or lesson learned"),
      stageId: z
        .string()
        .optional()
        .describe("Stage slug/ID during which this was learned (e.g. 'construction/code-generation')"),
      author: z.string().optional().default("human").describe("Author/originator of the learning"),
      space: z.string().optional().describe("AI-DLC space name (defaults to default space)"),
      workspace: workspaceSchema,
    },
    async ({ learning, stageId, author, space, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const res = await recordLearning({
          learning,
          stageId,
          author,
          space,
          workspaceDir: ws,
        });

        return {
          content: [
            {
              type: "text",
              text: `# ✅ Learning Recorded in Diary\n* **File**: \`${res.filePath}\`\n* **Author**: \`${author}\`\n${stageId ? `* **Stage**: \`${stageId}\`\n` : ""}* **Entry**: ${learning.trim()}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to record learning: ${err.message}` }],
        };
      }
    }
  );

  // 25. dlc_get_scope_spec: Scope Specification & Execution Policies
  server.tool(
    "dlc_get_scope_spec",
    "Retrieve the official AI-DLC scope specification, policies (skeleton, guardPolicy, reviewCap, sensors, learnings), and rationale for any of the 11 workflow scopes.",
    {
      scope: z.enum(SCOPE_ENUM_STRICT).describe("Scope name to inspect"),
      workspace: workspaceSchema,
    },
    async ({ scope, workspace }) => {
      if (workspace) resolveWs(workspace);
      try {
        const spec = getScopeSpec(scope);
        if (!spec) {
          return {
            isError: true,
            content: [{ type: "text", text: `Scope '${scope}' not found.` }],
          };
        }

        const lines = [
          `# AI-DLC Scope: \`${spec.name}\``,
          `* **Depth**: \`${spec.depth}\``,
          `* **Test Strategy**: \`${spec.testStrategy}\``,
          `* **Description**: ${spec.description}`,
          `* **Walking Skeleton**: \`${spec.skeleton}\``,
          `* **Guard Policy**: \`${spec.guardPolicy}\``,
          `* **Review Cap**: \`${spec.reviewCap || "advisory"}\``,
          `* **Sensors**: \`${spec.sensors}\``,
          `* **Learnings**: \`${spec.learnings}\``,
          `* **Summary Confirmation**: \`${spec.summaryConfirmation}\``,
          `* **Plan Approval**: \`${spec.planApproval}\``,
          `* **Collaborators**: \`${spec.collaborators}\``,
          spec.keywords.length > 0
            ? `* **Keyword Triggers**: ${spec.keywords.map((k) => `\`${k}\``).join(", ")}`
            : "* **Keyword Triggers**: *(None - selected explicitly or as fallback)*",
          "",
          "---",
          "",
          spec.markdown,
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get scope spec: ${err.message}` }],
        };
      }
    }
  );

  // 26. dlc_run_sensors: Execute Deterministic Sensor Verification
  server.tool(
    "dlc_run_sensors",
    "Run deterministic AI-DLC sensor validation (claim-sources, required-sections, traceability, upstream-coverage) against a stage deliverable.",
    {
      stageSlug: z.string().describe("Stage slug (e.g. 'intent-capture', 'units-generation', 'functional-design')"),
      content: z.string().optional().describe("Markdown content string to validate directly"),
      artifactPath: z.string().optional().describe("Workspace-relative or absolute path to artifact file"),
      space: z.string().optional().describe("AI-DLC space name (defaults to default space)"),
      workspace: workspaceSchema,
    },
    async ({ stageSlug, content, artifactPath, space, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        let textToValidate = content;
        let filename = artifactPath ? path.basename(artifactPath) : `${stageSlug}.md`;

        if (!textToValidate && artifactPath) {
          const fullPath = path.isAbsolute(artifactPath) ? artifactPath : path.join(ws, artifactPath);
          textToValidate = await fs.readFile(fullPath, "utf-8");
        }

        if (!textToValidate) {
          return {
            isError: true,
            content: [{ type: "text", text: "Must provide either 'content' or valid 'artifactPath' to run sensors." }],
          };
        }

        const report = await runStageSensors({
          stageSlug,
          content: textToValidate,
          filename,
          space,
          workspaceDir: ws,
        });

        const statusEmoji = report.overallPass ? "✅" : "⚠️";
        const lines = [
          `# ${statusEmoji} AI-DLC Sensors Report: \`${stageSlug}\``,
          `* **Overall Status**: \`${report.overallPass ? "PASSED" : "FINDINGS DETECTED"}\``,
          `* **Target Artifact**: \`${filename}\``,
          "",
          "## Sensor Checks:",
        ];

        for (const res of report.results) {
          const icon = res.pass ? "✅" : "❌";
          lines.push(`### ${icon} Sensor: \`${res.sensorId}\` (${res.severity})`);
          if (res.findings.length === 0) {
            lines.push("* Pass: No structural violations detected.");
          } else {
            for (const f of res.findings) {
              lines.push(`* ⚠️ ${f}`);
            }
          }
          if (res.details) {
            lines.push(`\`\`\`json\n${JSON.stringify(res.details, null, 2)}\n\`\`\``);
          }
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Sensor execution failed: ${err.message}` }],
        };
      }
    }
  );

  // 27. dlc_get_sensor_spec: Sensor Specification & Contracts
  server.tool(
    "dlc_get_sensor_spec",
    "Retrieve the official specification, trigger events, and contract schema for any of the 6 AI-DLC sensors.",
    {
      sensorId: z.enum(SENSOR_ENUM).describe("Sensor identifier"),
      workspace: workspaceSchema,
    },
    async ({ sensorId, workspace }) => {
      if (workspace) resolveWs(workspace);
      try {
        const spec = getSensorSpec(sensorId);
        if (!spec) {
          return {
            isError: true,
            content: [{ type: "text", text: `Sensor '${sensorId}' not found.` }],
          };
        }

        const lines = [
          `# AI-DLC Sensor: \`${spec.id}\``,
          `* **Category**: \`${spec.category}\``,
          `* **Default Severity**: \`${spec.defaultSeverity}\``,
          `* **Fire On**: \`${spec.fireOn}\``,
          `* **Description**: ${spec.description}`,
          `* **File Matches**: \`${spec.matches}\``,
          `* **Timeout**: ${spec.timeoutSeconds}s`,
          "",
          "---",
          "",
          spec.markdown,
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get sensor spec: ${err.message}` }],
        };
      }
    }
  );

  // 28. dlc_session_cost: Session Cost & Runtime Metrics
  server.tool(
    "dlc_session_cost",
    "Read-only session cost and execution metrics view. Prints deterministic aggregates for the current workflow: duration, stage outcomes, memory entries, sensor firings, and learnings.",
    {
      intentId: z.string().optional().describe("Optional intent ID (defaults to active intent)"),
      workspace: workspaceSchema,
    },
    async ({ intentId, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const report = await computeSessionCost(intentId, ws);

        const lines = [
          "# AI-DLC Session Cost",
          `* **Workflow**: \`${report.workflow_id}\``,
          `* **Scope**: \`${report.scope}\``,
          `* **Duration**: ${report.duration_minutes !== null ? `${report.duration_minutes} min` : "in progress"}`,
          "",
          "## Stages",
          `* **Total**: ${report.stages.total}`,
          `* **Approved**: ${report.stages.approved}`,
          `* **Failed**: ${report.stages.failed}`,
          `* **Pending**: ${report.stages.pending}`,
          "",
          "## By Phase",
        ];

        for (const [phase, tally] of Object.entries(report.by_phase)) {
          lines.push(`* **${phase.toUpperCase()}**: ${tally.approved}/${tally.total} approved (${tally.pending} pending)`);
        }

        lines.push(
          "",
          "## Memory Entries",
          `* **Total**: ${report.memory.total}`,
          `* **Interpretations**: ${report.memory.interpretations}`,
          `* **Deviations**: ${report.memory.deviations}`,
          `* **Trade-offs / Decisions**: ${report.memory.tradeoffs}`,
          `* **Open Questions**: ${report.memory.open_questions}`,
          "",
          "## Sensors",
          `* **Fired**: ${report.sensors.total}`,
          `* **Passed**: ${report.sensors.passed}`,
          `* **Failed**: ${report.sensors.failed}`,
          `* **Budget Overrides**: ${report.sensors.budget_override}`,
          `* **Incomplete**: ${report.sensors.incomplete}`,
          "",
          "## Learnings Captured",
          `* **From Orchestrator**: ${report.learnings.from_orchestrator}`,
          `* **From User Additions**: ${report.learnings.from_user_addition}`,
          "",
          "```json",
          JSON.stringify(report, null, 2),
          "```"
        );

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Session cost calculation failed: ${err.message}` }],
        };
      }
    }
  );

  // 29. dlc_session_replay: Narrative Session Replay
  server.tool(
    "dlc_session_replay",
    "Print a structured session narrative replay for stakeholders who weren't in the room. Sourced from audit logs and delivered artifacts without mutating state.",
    {
      intentId: z.string().optional().describe("Optional intent ID (defaults to active intent)"),
      workspace: workspaceSchema,
    },
    async ({ intentId, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const markdown = await generateSessionReplay(intentId, ws);
        return {
          content: [{ type: "text", text: markdown }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Session replay failed: ${err.message}` }],
        };
      }
    }
  );

  // 30. dlc_outcomes_pack: Handover Pack Generator
  server.tool(
    "dlc_outcomes_pack",
    "Generate a comprehensive OUTCOMES.md handover document at workflow close so the team can own, operate, and continue the system without re-running the workflow.",
    {
      intentId: z.string().optional().describe("Optional intent ID (defaults to active intent)"),
      writeToFile: z.boolean().optional().default(false).describe("If true, writes OUTCOMES.md to the workspace root"),
      workspace: workspaceSchema,
    },
    async ({ intentId, writeToFile, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const { content, filePath } = await generateOutcomesPack({
          intentId,
          writeToFile,
          workspaceDir: ws,
        });

        const lines = [content];
        if (filePath) {
          lines.unshift(`> ✅ **OUTCOMES.md written to workspace root**: \`${filePath}\`\n`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Outcomes pack generation failed: ${err.message}` }],
        };
      }
    }
  );

  // 31. dlc_get_skill_spec: Skill Specification & Contracts
  server.tool(
    "dlc_get_skill_spec",
    "Retrieve the official SKILL.md specification, classification, and argument hints for an AI-DLC skill.",
    {
      skillName: z.enum(SKILL_ENUM).describe("Skill identifier"),
      workspace: workspaceSchema,
    },
    async ({ skillName, workspace }) => {
      if (workspace) resolveWs(workspace);
      try {
        const spec = getSkillSpec(skillName);
        if (!spec) {
          return {
            isError: true,
            content: [{ type: "text", text: `Skill '${skillName}' not found.` }],
          };
        }

        const lines = [
          `# AI-DLC Skill: \`${spec.name}\``,
          `* **Classification**: \`${spec.classification}\``,
          `* **User Invocable**: \`${spec.userInvocable}\``,
          spec.argumentHint ? `* **Argument Hint**: \`${spec.argumentHint}\`` : "",
          `* **Description**: ${spec.description}`,
          "",
          "---",
          "",
          spec.markdown,
        ].filter(Boolean);

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to get skill spec: ${err.message}` }],
        };
      }
    }
  );

  // 32. dlc_install_skills: Export Skills to Agent Tools Directory
  server.tool(
    "dlc_install_skills",
    "Export AI-DLC skills into agent tool directories (e.g. .cursor/skills, .claude/skills, or .agents/skills) for native assistant invocation.",
    {
      targetDirectory: z.string().optional().describe("Target skills directory (relative to workspace or absolute; defaults to .cursor/skills)"),
      skills: z.array(z.enum(SKILL_ENUM)).optional().describe("Optional list of specific skills to export (defaults to all)"),
      workspace: workspaceSchema,
    },
    async ({ targetDirectory, skills, workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const baseDir = targetDirectory
          ? path.isAbsolute(targetDirectory)
            ? targetDirectory
            : path.join(ws, targetDirectory)
          : path.join(ws, ".cursor", "skills");

        const targetSkills = skills && skills.length > 0 ? skills : (Object.keys(SKILL_ENUM) as any, SKILL_ENUM);
        const written: string[] = [];

        for (const skillName of targetSkills) {
          const spec = getSkillSpec(skillName);
          if (!spec) continue;

          const skillDir = path.join(baseDir, skillName);
          await fs.mkdir(skillDir, { recursive: true });
          const skillFilePath = path.join(skillDir, "SKILL.md");
          await fs.writeFile(skillFilePath, spec.markdown, "utf-8");
          written.push(skillFilePath);
        }

        const lines = [
          "# ✅ AI-DLC Skills Installed",
          `* **Target Directory**: \`${baseDir}\``,
          `* **Installed Skills (${written.length})**:`,
        ];
        for (const f of written) {
          lines.push(`  - \`${f}\``);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to install skills: ${err.message}` }],
        };
      }
    }
  );

  // 33. dlc_list_extensions: Active Extensions & Custom Flows Inspector
  server.tool(
    "dlc_list_extensions",
    "List all active custom flows, scopes, stages, sensors, and knowledge packs loaded across the 3-tier hierarchy (Tier 1: Built-in, Tier 2: Org Repo, Tier 3: Workspace Local).",
    {
      workspace: workspaceSchema,
    },
    async ({ workspace }) => {
      try {
        const ws = resolveWs(workspace);
        const cache = loadAllExtensions(ws);
        const lines = [
          "# 🧩 AI-DLC Custom Flows & Extensions Registry",
          `* **Tier 1 (Built-in Core)**: 11 scopes, 33 stages, 59 playbooks, 6 sensors, 4 skills`,
          `* **Custom Packs Loaded**: ${cache.packs.length}`,
          "",
        ];

        if (cache.packs.length === 0) {
          lines.push("> *No external extension packs loaded. Core built-in lifecycle is active.*");
          lines.push("> *To load organization flows, set `AIDLC_FLOWS_DIR=/path/to/repo` or create `./.aidlc/` in the workspace.*");
        } else {
          lines.push("## Active Extension Packs:");
          for (const p of cache.packs) {
            const name = p.manifest?.name || path.basename(p.sourcePath);
            lines.push(`### 📦 \`${name}\` (${p.tier})`);
            lines.push(`* **Source**: \`${p.sourcePath}\``);
            if (p.manifest?.description) lines.push(`* **Description**: ${p.manifest.description}`);
            lines.push(`* **Custom Scopes**: ${Object.keys(p.scopes).join(", ") || "None"}`);
            lines.push(`* **Custom Stages**: ${Object.keys(p.stages).join(", ") || "None"}`);
            lines.push(`* **Custom Sensors**: ${Object.keys(p.sensors).join(", ") || "None"}`);
            lines.push(`* **Custom Knowledge Docs**: ${p.knowledge.length}`);
          }
        }

        const customScopes = Object.keys(cache.scopes);
        if (customScopes.length > 0) {
          lines.push("", "## Available Custom Scopes:");
          for (const s of Object.values(cache.scopes)) {
            lines.push(`* **\`${s.type}\`** (${s.name}): ${s.description} [${s.stageIds.length} stages]`);
          }
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
        };
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to list extensions: ${err.message}` }],
        };
      }
    }
  );
}
