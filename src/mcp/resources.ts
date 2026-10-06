import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";
import { loadActiveIntentState, getIntentDirPath } from "../utils/filesystem.js";
import { CONFIG } from "../config.js";
import { STAGE_DEFINITIONS } from "../engine/socratic-rubric.js";
import { SCOPES, getAllScopeSpecs, getScopeSpec } from "../engine/profiles.js";
import { listKnowledgeDocuments } from "../utils/knowledge.js";
import {
  STAGE_PROTOCOL,
  REVIEWER_PROTOCOL,
  CONSTRUCTION_PROTOCOL,
  RECOVERY_PROTOCOL,
} from "../engine/protocols.js";
import { getAllStageSpecs } from "../stages/registry.js";
import { getAllCoreKnowledgeDocs } from "../knowledge/registry.js";
import { readAuditTrail } from "../engine/audit.js";
import { resolveActiveMemory, readMemoryLayer } from "../utils/memory.js";
import { getAllSensorSpecs, getSensorSpec } from "../sensors/registry.js";
import { getAllSkillSpecs, getSkillSpec } from "../skills/registry.js";
import {
  computeSessionCost,
  generateSessionReplay,
  generateOutcomesPack,
} from "../engine/skills.js";

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

  // 10. aidlc://stages/catalog -> All official stage specifications catalog
  server.registerResource(
    "aidlc-stages-catalog",
    "aidlc://stages/catalog",
    {
      title: "AI-DLC Official Stage Specifications Catalog",
      description: "Listing and metadata for all 33 official AI-DLC stages from core/aidlc-common/stages/.",
      mimeType: "application/json",
    },
    async (uri) => {
      const all = getAllStageSpecs().map((s) => ({
        slug: s.slug,
        name: s.name,
        phase: s.phase,
        execution: s.execution,
        condition: s.condition,
        lead_agent: s.lead_agent,
        reviewer: s.reviewer,
        produces: s.produces,
        consumes: s.consumes,
        scopes: s.scopes,
        resourceUri: `aidlc://stages/${s.slug}`,
      }));
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(all, null, 2) }],
      };
    }
  );

  // 11. Individual stage resources aidlc://stages/{slug}
  for (const spec of getAllStageSpecs()) {
    server.registerResource(
      `aidlc-stage-${spec.slug}`,
      `aidlc://stages/${spec.slug}`,
      {
        title: `Stage Specification: ${spec.name}`,
        description: `Official step-by-step execution guide and contracts for ${spec.name} (${spec.slug}).`,
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: spec.markdown }],
      })
    );
  }

  // 12. aidlc://audit -> Audit trail event stream
  server.registerResource(
    "aidlc-audit-trail",
    "aidlc://audit",
    {
      title: "AI-DLC Audit Trail",
      description: "Structured JSON stream of recent lifecycle audit events.",
      mimeType: "application/json",
    },
    async (uri) => {
      const events = await readAuditTrail();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(events, null, 2),
          },
        ],
      };
    }
  );

  // 13. Core Knowledge Base Playbooks & Standards
  for (const doc of getAllCoreKnowledgeDocs()) {
    server.registerResource(
      `aidlc-knowledge-${doc.id}`,
      `aidlc://knowledge/${doc.relativePath}`,
      {
        title: `${doc.title} (${doc.category === "shared" ? "Shared Standard" : doc.agent || "Agent Playbook"})`,
        description: `${doc.title} - Official AI-DLC Knowledge Guide.`,
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: doc.content }],
      })
    );
  }

  // 14. aidlc://memory/active -> Dynamic composite memory
  server.registerResource(
    "aidlc-memory-active",
    "aidlc://memory/active",
    {
      title: "Active Layered Memory",
      description: "Resolved AI-DLC memory combining org, team, project, and current phase guardrails.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const activeState = await loadActiveIntentState();
      let currentPhase: any = undefined;
      if (activeState) {
        const cur = activeState.stages[activeState.currentStageIndex];
        if (cur && ["ideation", "inception", "construction", "operation"].includes(cur.phase)) {
          currentPhase = cur.phase;
        }
      }
      const mem = await resolveActiveMemory({ phase: currentPhase });
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: mem.combinedText }],
      };
    }
  );

  // 15. Standard memory layers: org, team, project, learnings
  const standardLayers = [
    { name: "org", title: "Organization Defaults (org.md)", desc: "Org-level development practices, trunk-based defaults, and testing floors." },
    { name: "team", title: "Team Affirmed Practices (team.md)", desc: "Team-level affirmed practices discovered in Stage 2.9 practices-discovery." },
    { name: "project", title: "Project Local Rules (project.md)", desc: "Project-specific local overrides, patterns, and constraints." },
    { name: "learnings", title: "Learnings & Corrections Diary (learnings.md)", desc: "Append-only diary of human corrections and discovered rules." },
  ];

  for (const layer of standardLayers) {
    server.registerResource(
      `aidlc-memory-${layer.name}`,
      `aidlc://memory/${layer.name}`,
      {
        title: layer.title,
        description: layer.desc,
        mimeType: "text/markdown",
      },
      async (uri) => {
        const text = await readMemoryLayer(layer.name);
        return {
          contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
        };
      }
    );
  }

  // 16. Phase guardrails: aidlc://memory/phases/{phase}
  const memoryPhases = [
    { phase: "ideation", title: "Ideation Phase Guardrails", desc: "Guardrails for problem definition, evidence, and scope discipline." },
    { phase: "inception", title: "Inception Phase Guardrails", desc: "Guardrails for requirements testability, ADR trade-offs, and BDD stories." },
    { phase: "construction", title: "Construction Phase Guardrails", desc: "Guardrails for code completeness, error handling, and testing standards." },
    { phase: "operation", title: "Operation Phase Guardrails", desc: "Guardrails for infra safety, rollback procedures, SLOs, and incident response." },
  ];

  for (const p of memoryPhases) {
    server.registerResource(
      `aidlc-memory-phase-${p.phase}`,
      `aidlc://memory/phases/${p.phase}`,
      {
        title: p.title,
        description: p.desc,
        mimeType: "text/markdown",
      },
      async (uri) => {
        const text = await readMemoryLayer(`phases/${p.phase}`);
        return {
          contents: [{ uri: uri.href, mimeType: "text/markdown", text }],
        };
      }
    );
  }

  // 17. aidlc://scopes/catalog -> JSON Catalog of all 11 scopes
  server.registerResource(
    "aidlc-scopes-catalog",
    "aidlc://scopes/catalog",
    {
      title: "AI-DLC Scope Catalog",
      description: "Structured JSON metadata of all 11 AI-DLC scopes, policies, keyword triggers, and defaults.",
      mimeType: "application/json",
    },
    async (uri) => {
      const all = getAllScopeSpecs().map((s) => ({
        name: s.name,
        depth: s.depth,
        testStrategy: s.testStrategy,
        description: s.description,
        skeleton: s.skeleton,
        guardPolicy: s.guardPolicy,
        reviewCap: s.reviewCap || "advisory",
        sensors: s.sensors,
        learnings: s.learnings,
        summaryConfirmation: s.summaryConfirmation,
        planApproval: s.planApproval,
        collaborators: s.collaborators,
        keywords: s.keywords,
        resourceUri: `aidlc://scopes/${s.name}`,
      }));
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(all, null, 2) }],
      };
    }
  );

  // 18. Individual scope resources aidlc://scopes/{scope}
  for (const spec of getAllScopeSpecs()) {
    server.registerResource(
      `aidlc-scope-${spec.name}`,
      `aidlc://scopes/${spec.name}`,
      {
        title: `Scope Specification: ${spec.name}`,
        description: `Official AI-DLC scope specification, policies, and rationale for ${spec.name}.`,
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: spec.markdown }],
      })
    );
  }

  // 19. aidlc://sensors/catalog -> JSON Catalog of all 6 sensors
  server.registerResource(
    "aidlc-sensors-catalog",
    "aidlc://sensors/catalog",
    {
      title: "AI-DLC Sensors Catalog",
      description: "Structured JSON metadata of all 6 deterministic AI-DLC verification sensors.",
      mimeType: "application/json",
    },
    async (uri) => {
      const all = getAllSensorSpecs().map((s) => ({
        id: s.id,
        category: s.category,
        defaultSeverity: s.defaultSeverity,
        fireOn: s.fireOn,
        description: s.description,
        matches: s.matches,
        timeoutSeconds: s.timeoutSeconds,
        resourceUri: `aidlc://sensors/${s.id}`,
      }));
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(all, null, 2) }],
      };
    }
  );

  // 20. Individual sensor resources aidlc://sensors/{id}
  for (const spec of getAllSensorSpecs()) {
    server.registerResource(
      `aidlc-sensor-${spec.id}`,
      `aidlc://sensors/${spec.id}`,
      {
        title: `Sensor Specification: ${spec.id}`,
        description: `Official specification and contract schema for AI-DLC ${spec.id} sensor.`,
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: spec.markdown }],
      })
    );
  }

  // 21. aidlc://skills/catalog -> Catalog of all 4 AI-DLC skills
  server.registerResource(
    "aidlc-skills-catalog",
    "aidlc://skills/catalog",
    {
      title: "AI-DLC Skills Catalog",
      description: "Structured JSON metadata of all AI-DLC skills, argument hints, and invocation contracts.",
      mimeType: "application/json",
    },
    async (uri) => {
      const all = getAllSkillSpecs().map((s) => ({
        name: s.name,
        description: s.description,
        argumentHint: s.argumentHint,
        userInvocable: s.userInvocable,
        classification: s.classification,
        resourceUri: `aidlc://skills/${s.name}`,
      }));
      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(all, null, 2) }],
      };
    }
  );

  // 22. Individual skill resources aidlc://skills/{name}
  for (const spec of getAllSkillSpecs()) {
    server.registerResource(
      `aidlc-skill-${spec.name}`,
      `aidlc://skills/${spec.name}`,
      {
        title: `Skill Specification: ${spec.name}`,
        description: `Official SKILL.md specification and instructions for ${spec.name}.`,
        mimeType: "text/markdown",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: spec.markdown }],
      })
    );
  }

  // 23. aidlc://outcomes -> Dynamic OUTCOMES.md Handover Pack
  server.registerResource(
    "aidlc-outcomes",
    "aidlc://outcomes",
    {
      title: "Active Intent Outcomes Pack",
      description: "Comprehensive handover report (OUTCOMES.md) generated deterministically for the active intent.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      try {
        const { content } = await generateOutcomesPack({ writeToFile: false });
        return {
          contents: [{ uri: uri.href, mimeType: "text/markdown", text: content }],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `# AI-DLC Outcomes Pack\nUnable to generate outcomes pack: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // 24. aidlc://session-replay -> Dynamic Narrative Session Replay
  server.registerResource(
    "aidlc-session-replay",
    "aidlc://session-replay",
    {
      title: "Active Intent Session Replay",
      description: "Structured session replay narrative generated from audit shards and artifacts.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      try {
        const replay = await generateSessionReplay();
        return {
          contents: [{ uri: uri.href, mimeType: "text/markdown", text: replay }],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/markdown",
              text: `# AI-DLC Session Replay\nUnable to generate session replay: ${err.message}`,
            },
          ],
        };
      }
    }
  );

  // 25. aidlc://session-cost -> Dynamic Deterministic Session Cost Report
  server.registerResource(
    "aidlc-session-cost",
    "aidlc://session-cost",
    {
      title: "Active Intent Session Cost",
      description: "Deterministic runtime summary and cost metrics for the active intent.",
      mimeType: "application/json",
    },
    async (uri) => {
      try {
        const cost = await computeSessionCost();
        return {
          contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(cost, null, 2) }],
        };
      } catch (err: any) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: err.message }, null, 2),
            },
          ],
        };
      }
    }
  );
}

