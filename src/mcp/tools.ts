import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DlcStateMachine } from "../engine/state-machine.js";
import { evaluateRubric, STAGE_DEFINITIONS } from "../engine/socratic-rubric.js";
import { listAllIntents } from "../utils/filesystem.js";
import { SCOPES } from "../engine/profiles.js";
import { scanWorkspaceForReverseEngineering } from "../utils/reverse-engineering.js";
import { runDlcDoctor } from "../utils/doctor.js";
import { addKnowledgeDocument, listKnowledgeDocuments, readKnowledgeDocument } from "../utils/knowledge.js";
import { getStageSpec, getAllStageSpecs } from "../stages/registry.js";
import { readAuditTrail } from "../engine/audit.js";
import { executeHook } from "../hooks/runner.js";
import { installHooks } from "../hooks/installer.js";

const SCOPE_ENUM = [
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

export function registerDlcTools(server: McpServer): void {
  // 1. dlc_doctor: System Health & Diagnostics
  server.tool(
    "dlc_doctor",
    "Run comprehensive AI-DLC environment and workspace diagnostics (checks Node.js, Git, permissions, active space, and intent health).",
    {},
    async () => {
      try {
        const report = await runDlcDoctor();
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
        .enum(SCOPE_ENUM)
        .optional()
        .default("feature")
        .describe("Workflow scope profile: enterprise (33 stages), feature (33), mvp (23), poc (8), bugfix (9), refactor (10), infra (13), security-patch (10), classic (18), workshop (26), express (10)"),
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
    },
    async ({ label, description, scope, depth, testStrategy, projectType }) => {
      try {
        let resolvedType: "greenfield" | "brownfield" = "greenfield";
        if (projectType === "auto") {
          const scan = await scanWorkspaceForReverseEngineering();
          resolvedType = scan.projectType;
        } else {
          resolvedType = projectType;
        }

        const { intent, intentDir } = await DlcStateMachine.initIntent({
          label,
          description,
          profile: scope,
          projectType: resolvedType,
          depth,
          testStrategy,
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
    },
    async ({ intentId }) => {
      try {
        const status = await DlcStateMachine.getStatus(intentId);
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
    },
    async ({ content, stageId, artifactName, intentId }) => {
      try {
        const result = await DlcStateMachine.submitDraft({
          stageId,
          artifactName,
          content,
          intentId,
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
    },
    async ({ stageId, notes, force, intentId }) => {
      try {
        const result = await DlcStateMachine.approveGate({
          stageId,
          notes,
          force,
          intentId,
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
  server.tool("dlc_list_intents", "List all AI-DLC intents tracked in the current workspace.", {}, async () => {
    try {
      const intents = await listAllIntents();
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
    },
    async ({ client }) => {
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
    },
    async ({ decision, rationale, optionsConsidered, stageId, intentId }) => {
      try {
        const result = await DlcStateMachine.logDecision({
          decision,
          rationale,
          optionsConsidered,
          stageId,
          intentId,
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
    },
    async ({ stageId, reviewer, intentId }) => {
      try {
        const result = await DlcStateMachine.requestReview({
          stageId,
          reviewer,
          intentId,
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
    },
    async ({ stageId, reason, intentId }) => {
      try {
        const result = await DlcStateMachine.reopenStage({
          stageId,
          reason,
          intentId,
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
    },
    async ({ stageId, intentId }) => {
      try {
        let targetId = stageId;
        if (!targetId) {
          const status = await DlcStateMachine.getStatus(intentId);
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
    },
    async ({ intentId, limit }) => {
      try {
        const events = await readAuditTrail(intentId);
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
    },
    async ({ target }) => {
      try {
        const res = await installHooks({ target });
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
    },
    async ({ event, toolName, pathArg }) => {
      try {
        const res = await executeHook({
          event: event as any,
          toolName,
          toolArgs: pathArg ? { path: pathArg } : undefined,
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
}
