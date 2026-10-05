import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { STAGE_DEFINITIONS } from "../engine/socratic-rubric.js";
import { PROFILES } from "../engine/profiles.js";

export function registerDlcPrompts(server: McpServer): void {
  // 1. aidlc_start
  server.registerPrompt(
    "aidlc_start",
    {
      title: "Start AI-DLC Workflow",
      description: "Initialize and kick off an AI-DLC workflow with Socratic inquiry and profile selection.",
      argsSchema: {
        intent: z.string().describe("What you want to build or achieve (e.g. 'Build REST API for inventory management')"),
        profile: z
          .enum(["feature", "mvp", "bugfix", "express"])
          .optional()
          .describe("Workflow profile: feature (all phases), mvp (rapid prototype), bugfix, or express"),
      },
    },
    async ({ intent, profile }) => {
      const selectedProfile = profile || "feature";
      const profileDef = PROFILES[selectedProfile];

      const text = [
        `You are the AI-DLC Orchestrator with an embedded Socratic inquiry engine.`,
        `The user wants to accomplish: "${intent}".`,
        `Selected Profile: "${selectedProfile}" (${profileDef.name}).`,
        "",
        `Your governing operating principles:`,
        `1. "You decide, AI executes." Every material decision goes through an approval gate.`,
        `2. Do not skip straight to code. First call \`dlc_init_intent\` with a concise label and description.`,
        `3. Follow the Socratic method: Ask targeted, probing questions that force clarity on constraints, non-goals, failure modes, and edge cases.`,
        `4. Formulate the stage artifact only after probing the user.`,
        `5. Submit drafts via \`dlc_submit_draft\`. If the Socratic rubric is incomplete, continue the inquiry until all dimensions pass.`,
        `6. Always require explicit human approval before calling \`dlc_approve_gate\`.`,
        "",
        `Begin by calling \`dlc_init_intent\` and initiating the Socratic interview for Stage 1.1!`,
      ].join("\n");

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text },
          },
        ],
      };
    }
  );

  // 2. socratic_stage_inquiry
  server.registerPrompt(
    "socratic_stage_inquiry",
    {
      title: "Socratic Stage Inquiry",
      description: "Load the Socratic questioning protocol and rubric dimensions for the current or specified stage.",
      argsSchema: {
        stageId: z.string().describe("Stage ID (e.g. 'intent-capture', 'requirements-analysis', 'architecture-design')"),
      },
    },
    async ({ stageId }) => {
      const stageDef = STAGE_DEFINITIONS[stageId];
      if (!stageDef) {
        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text: `Unknown stage ID '${stageId}'. Check valid stages using dlc_get_status.` },
            },
          ],
        };
      }

      const rubric = stageDef.rubric;
      const text = [
        `# Socratic Protocol for Stage ${stageDef.number}: ${stageDef.name}`,
        `Role: **${stageDef.persona}**`,
        `Phase: \`${stageDef.phase}\``,
        `Stage Objective: ${stageDef.description}`,
        "",
        "## Socratic Rubric Dimensions to Satisfy:",
        ...rubric.dimensions.map((dim, idx) => {
          return [
            `### ${idx + 1}. ${dim.title}`,
            `*Goal*: ${dim.description}`,
            `*Core Probes to Ask*:`,
            ...dim.probingQuestions.map((q) => `  - ${q}`),
          ].join("\n");
        }),
        "",
        "## Execution Instructions:",
        "1. Adopt the designated persona.",
        "2. Interrogate the user on these dimensions. Do not accept vague or generic answers.",
        "3. Synthesize the findings into a comprehensive draft markdown document.",
        "4. Call `dlc_submit_draft` to evaluate rubric satisfaction.",
        "5. If dimensions remain unsatisfied, continue the Socratic dialogue until resolved.",
        "6. Ask the user for explicit sign-off, then call `dlc_approve_gate`.",
      ].join("\n");

      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text },
          },
        ],
      };
    }
  );

  // 3. Domain Expert Personas
  const personas = [
    {
      name: "persona_product_agent",
      title: "aidlc-product-agent Persona",
      role: "Lead Product Strategist & Requirements Engineer",
      focus: "Customer empathy, value proposition, boundary scoping, user stories, and acceptance criteria.",
    },
    {
      name: "persona_architect_agent",
      title: "aidlc-architect-agent Persona",
      role: "Principal Systems Architect",
      focus: "Trade-offs, rejected alternatives, failure blast radiuses, data schemas, invariants, and scalability boundaries.",
    },
    {
      name: "persona_security_agent",
      title: "aidlc-security-agent Persona",
      role: "Staff Security Architect",
      focus: "Trust boundaries, threat modeling, attack surfaces, PII/secret protection, and defense in depth.",
    },
    {
      name: "persona_qa_agent",
      title: "aidlc-qa-agent Persona",
      role: "Lead Quality & Test Engineer",
      focus: "Property-based testing, boundary conditions, edge case coverage, and empirical test evidence.",
    },
    {
      name: "persona_devops_agent",
      title: "aidlc-devops-agent Persona",
      role: "Site Reliability & Operations Lead",
      focus: "Deployment risk, observability metrics/SLOs, rollback strategies, and architectural post-mortems.",
    },
  ];

  for (const p of personas) {
    server.registerPrompt(
      p.name,
      {
        title: p.title,
        description: `Adopt the ${p.role} persona for AI-DLC Socratic questioning.`,
      },
      async () => {
        const text = [
          `You are the **${p.role}** in the AI-DLC framework.`,
          `Your core focus is: ${p.focus}.`,
          "",
          `Your posture is rigorously Socratic:`,
          `- Never rubber-stamp user assumptions.`,
          `- Probe edge cases, scale limits, and potential failure points.`,
          `- Seek concrete facts and verifiable criteria.`,
          `- Ensure every finding is documented in the stage artifact before advancing the gate.`,
        ].join("\n");

        return {
          messages: [
            {
              role: "user",
              content: { type: "text", text },
            },
          ],
        };
      }
    );
  }
}
