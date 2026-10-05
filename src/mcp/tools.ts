import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DlcStateMachine } from "../engine/state-machine.js";
import { evaluateRubric, STAGE_DEFINITIONS } from "../engine/socratic-rubric.js";
import { listAllIntents } from "../utils/filesystem.js";
import { PROFILES } from "../engine/profiles.js";
import { scanWorkspaceForReverseEngineering } from "../utils/reverse-engineering.js";

export function registerDlcTools(server: McpServer): void {
  // 1. dlc_init_intent
  server.tool(
    "dlc_init_intent",
    "Initialize a new AI-DLC intent with an adaptive workflow profile, scaffolding `./aidlc/spaces/default/intents/<date>-<label>/` and `aidlc-state.md`.",
    {
      label: z.string().describe("Short hyphenated label for the intent (e.g. 'inventory-api', 'oauth-migration')"),
      description: z.string().describe("Comprehensive description of the intent, objectives, and scope"),
      profile: z
        .enum(["feature", "mvp", "bugfix", "express"])
        .optional()
        .default("feature")
        .describe("Workflow profile: 'feature' (all 6 phases), 'mvp' (fast prototype), 'bugfix' (RCA & fix), 'express' (condensed)"),
      projectType: z
        .enum(["greenfield", "brownfield", "auto"])
        .optional()
        .default("auto")
        .describe("Project type: 'greenfield' (new project), 'brownfield' (existing codebase, injects Reverse Engineering stage), or 'auto' (scans workspace automatically)"),
    },
    async ({ label, description, profile, projectType }) => {
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
          profile,
          projectType: resolvedType,
        });

        const activeStage = intent.stages[0];
        const stageDef = STAGE_DEFINITIONS[activeStage.id];

        const output = [
          `# AI-DLC Intent Initialized: ${intent.intentId}`,
          `📁 **Record Directory**: \`${intentDir}\``,
          `🎯 **Profile**: \`${intent.profile}\` (${PROFILES[intent.profile].name})`,
          `📋 **Total Stages**: ${intent.stages.length}`,
          "",
          `### 🚀 Active Stage: ${activeStage.number} ${activeStage.name}`,
          `* **Phase**: \`${activeStage.phase}\``,
          `* **Domain Expert**: \`${stageDef?.persona || "aidlc-agent"}\``,
          `* **Goal**: ${stageDef?.description}`,
          "",
          "### 🔍 Immediate Socratic Probes to Discuss:",
          ...(activeStage.unresolvedProbes || []).map((p) => `* ${p}`),
          "",
          "---",
          "Next step: Act as the assigned domain persona. Probe the user on these dimensions before submitting the draft artifact with `dlc_submit_draft`.",
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

  // 2. dlc_get_status
  server.tool(
    "dlc_get_status",
    "Get the current status, active intent, current stage, gate readiness, and lingering Socratic probes.",
    {
      intentId: z.string().optional().describe("Optional specific intent ID. If omitted, uses active intent."),
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
          `* **Profile**: \`${intent.profile}\``,
          `* **Stage Progress**: ${intent.currentStageIndex + 1} of ${intent.stages.length}`,
          "",
          `### Current Stage: ${activeStageState.number} ${activeStageState.name}`,
          `* **Phase**: \`${activeStageState.phase}\``,
          `* **Status**: \`${activeStageState.status}\``,
          `* **Domain Expert**: \`${currentStage?.persona}\``,
          activeStageState.artifactPath ? `* **Artifact**: \`${activeStageState.artifactPath}\`` : "* **Artifact**: Not yet submitted",
          "",
          "### Gate Status:",
          activeStageState.status === "rubric_satisfied"
            ? "✅ **Rubric Satisfied**: Ready for human gate approval (`dlc_approve_gate`)."
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

  // 3. dlc_check_rubric
  server.tool(
    "dlc_check_rubric",
    "Pre-evaluate draft content against a stage's Socratic rubric without saving to disk, discovering remaining probes and gaps.",
    {
      stageId: z.string().optional().describe("Stage ID (e.g. 'intent-capture', 'requirements-analysis', 'architecture-design'). Defaults to active stage."),
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

  // 4. dlc_submit_draft
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

  // 5. dlc_approve_gate
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
          `**Status**: ${result.workflowComplete ? "🎉 Workflow Complete!" : `Advanced to Stage '${result.nextStageId}'`}`,
          `**Notes**: ${notes || "Approved by user"}`,
          "",
          result.workflowComplete
            ? "All stages across the AI-DLC lifecycle are complete! Review the final artifacts under the intent directory."
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

  // 6. dlc_list_intents
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

  // 7. dlc_get_setup_requirements
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
          "*Alternative (Local clone)*:",
          "```bash",
          "claude mcp add aidlc -- node /absolute/path/to/aidlc-mcp/dist/index.js",
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
          "- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`",
          "- Windows: `%APPDATA%\\Claude\\claude_desktop_config.json`",
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
        "1. **Check Connection**: Invoke tool `dlc_list_intents` in your AI chat. If connected, it will return the intents in your workspace.",
        "2. **Start a Workflow**: Use prompt `aidlc_start` or call `dlc_init_intent({ label: 'my-feature', profile: 'feature', description: '...' })`.",
        "3. **Socratic Dialogue**: The assistant will adopt the domain persona and interrogate unstated assumptions, boundaries, and failure modes.",
        "4. **Rubric Review**: Call `dlc_submit_draft({ content: '...' })`. The server checks the stage's Socratic rubric.",
        "5. **Gate Approval**: Once satisfied, explicit sign-off enables `dlc_approve_gate` to advance the stage."
      );

      return {
        content: [{ type: "text", text: sections.join("\n") }],
      };
    }
  );

  // 8. dlc_scan_workspace
  server.tool(
    "dlc_scan_workspace",
    "Scan the current workspace for brownfield reverse engineering, detecting runtimes, manifests, key directories, dependencies, and generating the baseline reverse-engineering documentation.",
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
}


