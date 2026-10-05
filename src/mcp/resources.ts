import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";
import { loadActiveIntentState, getIntentDirPath } from "../utils/filesystem.js";
import { CONFIG } from "../config.js";
import { STAGE_DEFINITIONS } from "../engine/socratic-rubric.js";
import { SCOPES } from "../engine/profiles.js";
import { listKnowledgeDocuments } from "../utils/knowledge.js";
import {
  STAGE_PROTOCOL,
  REVIEWER_PROTOCOL,
  CONSTRUCTION_PROTOCOL,
  RECOVERY_PROTOCOL,
} from "../engine/protocols.js";

export function registerDlcResources(server: McpServer): void {
  // 1. aidlc://state -> aidlc-state.md
  server.registerResource(
    "aidlc-state",
    "aidlc://state",
    {
      title: "Current AI-DLC State",
      description: "Live aidlc-state.md roadmap and gate statuses for the currently active intent.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const activeState = await loadActiveIntentState();
      if (!activeState) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: "# AI-DLC State\nNo active intent. Initialize one with `dlc_init_intent`.",
            },
          ],
        };
      }

      const intentDir = getIntentDirPath(activeState.intentId);
      const stateMdPath = path.join(intentDir, CONFIG.STATE_FILE);

      try {
        const text = await fs.readFile(stateMdPath, "utf-8");
        return {
          contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
        };
      } catch {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `# AI-DLC State: ${activeState.intentId}\n(State file not yet created)`,
            },
          ],
        };
      }
    }
  );

  // 2. aidlc://active-intent -> JSON metadata
  server.registerResource(
    "aidlc-active-intent",
    "aidlc://active-intent",
    {
      title: "Active Intent Metadata",
      description: "Structured JSON metadata of the currently active intent.",
      mimeType: "application/json",
    },
    async (uri) => {
      const activeState = await loadActiveIntentState();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(activeState || { active: null }, null, 2),
          },
        ],
      };
    }
  );

  // 3. aidlc://rubrics -> Reference stage rubrics
  server.registerResource(
    "aidlc-rubrics",
    "aidlc://rubrics",
    {
      title: "AI-DLC Socratic Rubrics",
      description: "Complete catalog of stage rubrics, dimensions, and probing questions across all 33 stages.",
      mimeType: "application/json",
    },
    async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(STAGE_DEFINITIONS, null, 2),
          },
        ],
      };
    }
  );

  // 4. aidlc://scopes -> Scope Routing Matrix
  server.registerResource(
    "aidlc-scopes",
    "aidlc://scopes",
    {
      title: "AI-DLC Scope Routing Matrix",
      description: "Complete specification of the 11 AI-DLC scopes and their stage sequences.",
      mimeType: "application/json",
    },
    async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(SCOPES, null, 2),
          },
        ],
      };
    }
  );

  // 5. aidlc://knowledge -> Active Space Knowledge Documents
  server.registerResource(
    "aidlc-knowledge",
    "aidlc://knowledge",
    {
      title: "Knowledge Base Documents",
      description: "Listing of all team standards and reference documents in the active space.",
      mimeType: "application/json",
    },
    async (uri) => {
      const docs = await listKnowledgeDocuments();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(docs, null, 2),
          },
        ],
      };
    }
  );

  // 6. aidlc://protocols/stage-protocol -> Stage Voice & Gate Rules
  server.registerResource(
    "aidlc-protocol-stage",
    "aidlc://protocols/stage-protocol",
    {
      title: "AI-DLC Stage Protocol",
      description: "Voice contract, HARD STOP approval gate rules, and atomic stage ritual.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: STAGE_PROTOCOL }],
    })
  );

  // 7. aidlc://protocols/reviewer-protocol -> Reviewer Invocation (§12a)
  server.registerResource(
    "aidlc-protocol-reviewer",
    "aidlc://protocols/reviewer-protocol",
    {
      title: "AI-DLC Reviewer Protocol (§12a)",
      description: "Independent verification pass protocol and structured verdict rules.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: REVIEWER_PROTOCOL }],
    })
  );

  // 8. aidlc://protocols/construction-protocol -> Units of Work & Loopback
  server.registerResource(
    "aidlc-protocol-construction",
    "aidlc://protocols/construction-protocol",
    {
      title: "AI-DLC Construction Protocol",
      description: "Units of Work (UoW) DAG execution, Plan Approval fence, and build-and-test loopback.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: CONSTRUCTION_PROTOCOL }],
    })
  );

  // 9. aidlc://protocols/recovery-protocol -> Session Resume & Stage Reopening
  server.registerResource(
    "aidlc-protocol-recovery",
    "aidlc://protocols/recovery-protocol",
    {
      title: "AI-DLC Recovery Protocol",
      description: "Session resumption and stage reopening without data loss.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: RECOVERY_PROTOCOL }],
    })
  );
}
