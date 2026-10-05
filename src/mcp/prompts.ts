import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { STAGE_DEFINITIONS } from "../engine/socratic-rubric.js";
import { SCOPES } from "../engine/profiles.js";

const SCOPE_KEYS = [
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

export function registerDlcPrompts(server: McpServer): void {
  // 1. aidlc_start
  server.registerPrompt(
    "aidlc_start",
    {
      title: "Start AI-DLC Workflow",
      description: "Initialize and kick off an AI-DLC workflow with Socratic inquiry and scope selection.",
      argsSchema: {
        intent: z.string().describe("What you want to build or achieve (e.g. 'Build REST API for inventory management')"),
        scope: z
          .enum(SCOPE_KEYS)
          .optional()
          .describe("Workflow scope profile: enterprise, feature, mvp, poc, bugfix, refactor, infra, security-patch, classic, workshop, express"),
      },
    },
    async ({ intent, scope }) => {
      const selectedScope = scope || "feature";
      const scopeDef = SCOPES[selectedScope];

      const text = [
        `You are the AI-DLC Orchestrator with an embedded Socratic inquiry engine.`,
        `The user wants to accomplish: "${intent}".`,
        `Selected Scope: "${selectedScope}" (${scopeDef.name}).`,
        `Planned Stages: ${scopeDef.stageIds.length} stages across the lifecycle.`,
        "",
        `Your governing operating principles:`,
        `1. "You decide, AI executes." Every material decision goes through an approval gate.`,
        `2. Do not skip straight to code. First run \`dlc_init_intent\` with a concise label, description, and scope.`,
        `3. Follow the Socratic method: Ask targeted, probing questions that force clarity on constraints, non-goals, failure modes, and edge cases.`,
        `4. Formulate the stage artifact only after probing the user.`,
        `5. Submit drafts via \`dlc_submit_draft\`. If the Socratic rubric is incomplete, continue the inquiry until all dimensions pass.`,
        `6. Always require explicit human approval before calling \`dlc_approve_gate\`.`,
        "",
        `Begin by calling \`dlc_init_intent\` and initiating the interview for the first stage!`,
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
      description: "Load the Socratic questioning protocol and rubric dimensions for any lifecycle stage.",
      argsSchema: {
        stageId: z.string().describe("Stage ID (e.g. 'intent-capture', 'requirements-analysis', 'domain-design')"),
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

  // 3. The 11 AI-DLC Domain Expert Personas
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
      focus: "Domain modeling, trade-offs, rejected alternatives, failure blast radiuses, data schemas, invariants, and scalability boundaries.",
    },
    {
      name: "persona_developer_agent",
      title: "aidlc-developer-agent Persona",
      role: "Senior Software Engineer",
      focus: "Code pattern analysis, brownfield reverse engineering, functional design, clean code, and implementation.",
    },
    {
      name: "persona_devsecops_agent",
      title: "aidlc-devsecops-agent Persona",
      role: "Staff DevSecOps & Security Automation Specialist",
      focus: "CI/CD pipelines, automated security scanning, canary deployments, and deployment execution.",
    },
    {
      name: "persona_quality_agent",
      title: "aidlc-quality-agent Persona",
      role: "Lead Quality & Test Engineer",
      focus: "Property-based testing, boundary conditions, edge case coverage, performance profiling, and empirical test evidence.",
    },
    {
      name: "persona_tech_lead",
      title: "aidlc-tech-lead Persona",
      role: "Engineering Tech Lead",
      focus: "Units of Work DAG decomposition, dependency sequencing, risk mitigation, and delivery planning.",
    },
    {
      name: "persona_infra_agent",
      title: "aidlc-infra-agent Persona",
      role: "Cloud Infrastructure Architect",
      focus: "Infrastructure as Code (Terraform/CDK), cloud resource provisioning, container specs, and networking.",
    },
    {
      name: "persona_observability_agent",
      title: "aidlc-observability-agent Persona",
      role: "Site Reliability & Observability Lead",
      focus: "Distributed tracing, metrics, SLO/SLA alert thresholds, dashboards, runbooks, and incident triage.",
    },
    {
      name: "persona_security_agent",
      title: "aidlc-security-agent Persona",
      role: "Staff Application Security Specialist",
      focus: "Threat modeling (STRIDE), attack surface analysis, trust boundaries, secret hygiene, and RBAC.",
    },
    {
      name: "persona_business_analyst",
      title: "aidlc-business-analyst Persona",
      role: "Business & Market Analyst",
      focus: "Competitive landscape, market benchmarks, feasibility analysis, and resource/budget constraints.",
    },
    {
      name: "persona_coach_agent",
      title: "aidlc-coach-agent Persona",
      role: "Lifecycle Coach & Agile Facilitator",
      focus: "Team formation, continuous feedback, architectural retrospectives, technical debt tracking, and post-mortems.",
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
