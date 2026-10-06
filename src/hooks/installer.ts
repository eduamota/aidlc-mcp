import fs from "node:fs/promises";
import path from "node:path";
import { getWorkspaceDir } from "../config.js";

export interface InstallHooksOptions {
  target: "claude-code" | "cursor" | "git" | "all";
  workspaceDir?: string;
}

export interface InstallHooksResult {
  installed: string[];
  skipped: string[];
  instructions: string[];
}

/**
 * Installs client harness lifecycle hooks for Claude Code, Cursor, or Git.
 */
export async function installHooks(options: InstallHooksOptions): Promise<InstallHooksResult> {
  const ws = options.workspaceDir || getWorkspaceDir();
  const installed: string[] = [];
  const skipped: string[] = [];
  const instructions: string[] = [];

  const targets = options.target === "all" ? ["claude-code", "cursor", "git"] : [options.target];

  // 1. Claude Code Hooks
  if (targets.includes("claude-code")) {
    try {
      const claudeDir = path.join(ws, ".claude");
      await fs.mkdir(claudeDir, { recursive: true });

      const settingsPath = path.join(claudeDir, "settings.json");
      let settings: Record<string, any> = {};
      try {
        const raw = await fs.readFile(settingsPath, "utf-8");
        settings = JSON.parse(raw);
      } catch {}

      settings.hooks = settings.hooks || {};
      settings.hooks.SessionStart = [
        {
          command: "npx -y github:doitintl/aidlc-mcp hook session-start",
        },
      ];
      settings.hooks.PreToolUse = [
        {
          command: "npx -y github:doitintl/aidlc-mcp hook pre-tool",
        },
      ];
      settings.hooks.Stop = [
        {
          command: "npx -y github:doitintl/aidlc-mcp hook stop",
        },
      ];

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
      installed.push(".claude/settings.json (Claude Code Lifecycle Hooks)");
      instructions.push(
        "Claude Code hooks configured: SessionStart, PreToolUse, and Stop will automatically invoke AI-DLC guards."
      );
    } catch (err: any) {
      skipped.push(`Claude Code hooks failed: ${err.message}`);
    }
  }

  // 2. Cursor Workflow Rules
  if (targets.includes("cursor")) {
    try {
      const cursorRulesDir = path.join(ws, ".cursor", "rules");
      await fs.mkdir(cursorRulesDir, { recursive: true });

      const rulePath = path.join(cursorRulesDir, "aidlc-workflow.mdc");
      const ruleContent = `---
description: AI-DLC Lifecycle Guardrails and Socratic Workflow Protocol
globs: *
alwaysApply: true
---

# AI-DLC Workflow Guardrails

This workspace uses the AI-DLC Socratic MCP server (ai-dlc-mcp).

## Mandatory Protocols:
1. **Session Start**: At the start of every session, verify active stage via \`aidlc://state\` or call \`dlc_get_status\`.
2. **State Protection**: Never edit or mutate \`aidlc-state.md\` or \`audit/\` files directly. All lifecycle transitions must use \`dlc_approve_gate\`, \`dlc_submit_draft\`, or \`dlc_reopen_stage\`.
3. **Review Freeze**: Once a stage artifact passes independent review, it is frozen. If the user asks for revisions, call \`dlc_reopen_stage\` first.
4. **Plan Approval Fence**: Do not write production code until the implementation plan (delivery-planning / units-generation) is approved at the gate.
5. **Approval Gates (HARD STOP)**: When presenting an approval gate, end your turn immediately and wait for the user's explicit response.
`;

      await fs.writeFile(rulePath, ruleContent, "utf-8");
      installed.push(".cursor/rules/aidlc-workflow.mdc (Cursor AI-DLC Rules)");
      instructions.push("Cursor rules installed in `.cursor/rules/aidlc-workflow.mdc`.");
    } catch (err: any) {
      skipped.push(`Cursor rules failed: ${err.message}`);
    }
  }

  // 3. Git Pre-Commit Hook
  if (targets.includes("git")) {
    try {
      const gitHooksDir = path.join(ws, ".git", "hooks");
      const preCommitPath = path.join(gitHooksDir, "pre-commit");

      const script = `#!/bin/sh
# AI-DLC State Validation Pre-Commit Hook
if [ -f "aidlc-state.md" ] || [ -d "aidlc" ]; then
  npx -y github:doitintl/aidlc-mcp hook statusline > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "⚠️  [AI-DLC] Warning: Working with active AI-DLC workflow."
  fi
fi
exit 0
`;

      await fs.mkdir(gitHooksDir, { recursive: true });
      await fs.writeFile(preCommitPath, script, { mode: 0o755 });
      installed.push(".git/hooks/pre-commit (Git Workflow Hook)");
      instructions.push("Git pre-commit hook installed to `.git/hooks/pre-commit`.");
    } catch (err: any) {
      skipped.push(`Git hook skipped: ${err.message}`);
    }
  }

  return { installed, skipped, instructions };
}
