import { SocraticRubric, RubricEvaluationResult, RubricDimensionResult, StageDefinition } from "../types.js";

export const STAGE_DEFINITIONS: Record<string, StageDefinition> = {
  // --- IDEATION ---
  "intent-capture": {
    id: "intent-capture",
    number: "1.1",
    name: "Intent Capture & Scope Definition",
    phase: "ideation",
    description: "Capture user intent, core motivation, target beneficiaries, and define high-level boundaries.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "intent-brief.md",
    rubric: {
      stageId: "intent-capture",
      stageName: "Intent Capture & Scope Definition",
      persona: "aidlc-product-agent",
      dimensions: [
        {
          id: "problem_clarity",
          title: "Problem Statement & Motivation",
          description: "Clearly defines the pain point being resolved and who suffers without it.",
          probingQuestions: [
            "What specific pain point triggered this initiative, and who experiences it most acutely?",
            "What happens if this problem is not solved in this cycle?",
          ],
          heuristicKeywords: ["problem", "motivation", "pain point", "user", "need", "why"],
        },
        {
          id: "scope_boundaries",
          title: "Explicit Scope Boundaries & Non-Goals",
          description: "Articulates not just what will be built, but explicitly what is out of scope.",
          probingQuestions: [
            "What related features or capabilities are explicitly out of scope for this intent?",
            "Where does this intent stop, and where does future work begin?",
          ],
          heuristicKeywords: ["out of scope", "non-goals", "boundary", "limits", "exclusions"],
        },
        {
          id: "success_criteria",
          title: "Measurable Success Criteria",
          description: "Defines unambiguous criteria for declaring this intent complete and successful.",
          probingQuestions: [
            "By what observable criteria will we know this intent succeeded?",
            "How will the end user or calling system verify satisfaction?",
          ],
          heuristicKeywords: ["success criteria", "acceptance", "metric", "verification", "expected outcome"],
        },
      ],
    },
  },

  // --- INCEPTION ---
  "requirements-analysis": {
    id: "requirements-analysis",
    number: "2.1",
    name: "Requirements & User Stories",
    phase: "inception",
    description: "Deep dive into functional and non-functional requirements, user journeys, and edge cases.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "requirements.md",
    rubric: {
      stageId: "requirements-analysis",
      stageName: "Requirements & User Stories",
      persona: "aidlc-product-agent",
      dimensions: [
        {
          id: "functional_requirements",
          title: "Functional Completeness",
          description: "Every primary user journey and system behavior is specified with input/output expectations.",
          probingQuestions: [
            "What are the concrete inputs, triggers, and expected outputs for each capability?",
            "Are there hidden workflows or background actions required to satisfy these user stories?",
          ],
          heuristicKeywords: ["functional", "user story", "input", "output", "as a", "i want", "so that"],
        },
        {
          id: "edge_cases_and_limits",
          title: "Edge Cases & Boundary Conditions",
          description: "Identifies exceptional states, empty cases, maximum limits, and malformed inputs.",
          probingQuestions: [
            "What happens when inputs are empty, excessively large, duplicate, or malformed?",
            "What is the system's defined behavior at boundary limits (rate limits, quota exhaustion)?",
          ],
          heuristicKeywords: ["edge case", "boundary", "limits", "invalid", "empty", "error", "exception"],
        },
        {
          id: "non_functional_requirements",
          title: "Non-Functional Requirements (NFRs)",
          description: "Specifies latency, concurrency, data retention, durability, and availability expectations.",
          probingQuestions: [
            "What are the target latency and throughput expectations under peak load?",
            "What consistency or durability guarantees must this feature uphold?",
          ],
          heuristicKeywords: ["latency", "throughput", "concurrency", "performance", "availability", "nfr", "scale"],
        },
      ],
    },
  },

  "architecture-design": {
    id: "architecture-design",
    number: "2.2",
    name: "System & Architecture Design",
    phase: "inception",
    description: "Design system components, data schemas, communication protocols, and architectural trade-offs.",
    persona: "aidlc-architect-agent",
    defaultArtifactName: "architecture-design.md",
    rubric: {
      stageId: "architecture-design",
      stageName: "System & Architecture Design",
      persona: "aidlc-architect-agent",
      dimensions: [
        {
          id: "architectural_tradeoffs",
          title: "Architectural Trade-offs & Rejected Alternatives",
          description: "Documents the trade-offs considered and why competing architectural approaches were rejected.",
          probingQuestions: [
            "What alternative design approaches were considered, and on what grounds were they rejected?",
            "What trade-off are you accepting here (e.g., complexity vs flexibility, speed vs consistency)?",
          ],
          heuristicKeywords: ["trade-off", "alternatives", "decision", "rationale", "rejected", "pros", "cons"],
        },
        {
          id: "failure_modes",
          title: "Failure Modes & Blast Radius",
          description: "Identifies dependency failures, partial failures, circuit breaking, and mitigation plans.",
          probingQuestions: [
            "When downstream dependencies or resources fail or time out, how does the system degrade gracefully?",
            "What is the blast radius if this component crashes?",
          ],
          heuristicKeywords: ["failure mode", "timeout", "circuit breaker", "fallback", "degrade", "blast radius", "resilience"],
        },
        {
          id: "data_and_interfaces",
          title: "Data Contracts & Interface Invariants",
          description: "Clear data models, API contracts, protocols, and state transitions.",
          probingQuestions: [
            "What invariants must remain true across state changes?",
            "Are contracts (REST/gRPC/schema) idempotent and backwards compatible?",
          ],
          heuristicKeywords: ["schema", "interface", "contract", "data model", "idempotent", "invariants", "state"],
        },
      ],
    },
  },

  "threat-modeling": {
    id: "threat-modeling",
    number: "2.3",
    name: "Threat Modeling & Security Review",
    phase: "inception",
    description: "Evaluate attack surfaces, authorization/authentication boundaries, and sensitive data exposure.",
    persona: "aidlc-security-agent",
    defaultArtifactName: "threat-model.md",
    rubric: {
      stageId: "threat-modeling",
      stageName: "Threat Modeling & Security Review",
      persona: "aidlc-security-agent",
      dimensions: [
        {
          id: "trust_boundaries",
          title: "Trust Boundaries & Attack Surface",
          description: "Explicitly delineates trusted vs untrusted zones, network boundaries, and entry points.",
          probingQuestions: [
            "Where do untrusted inputs enter the system, and where are trust boundaries crossed?",
            "Could an authenticated user access unauthorized resources across tenants or entities?",
          ],
          heuristicKeywords: ["trust boundary", "attack surface", "authorization", "auth", "rbac", "tenant"],
        },
        {
          id: "data_protection",
          title: "Data Protection & Secret Hygiene",
          description: "Audit storage and transit encryption, secret management, and sensitive logging prevention.",
          probingQuestions: [
            "Are secrets, tokens, or PII ever exposed in logs, error payloads, or client responses?",
            "How is data secured both in transit and at rest?",
          ],
          heuristicKeywords: ["encryption", "secrets", "tokens", "pii", "credentials", "logging", "sanitization"],
        },
      ],
    },
  },

  // --- CONSTRUCTION ---
  "task-decomposition": {
    id: "task-decomposition",
    number: "3.1",
    name: "Implementation Plan & Task Decomposition",
    phase: "construction",
    description: "Deconstruct architecture into incremental, testable tasks with clear verification checkpoints.",
    persona: "aidlc-tech-lead",
    defaultArtifactName: "implementation-plan.md",
    rubric: {
      stageId: "task-decomposition",
      stageName: "Implementation Plan & Task Decomposition",
      persona: "aidlc-tech-lead",
      dimensions: [
        {
          id: "incremental_stages",
          title: "Incremental & Independent Tasks",
          description: "Tasks are sequenced in small, coherent chunks that compile and test independently.",
          probingQuestions: [
            "Can each subtask be implemented and verified in isolation?",
            "Is there a clear dependency DAG without circular blockers?",
          ],
          heuristicKeywords: ["step", "task", "phase", "order", "dependency", "incremental"],
        },
        {
          id: "verification_checkpoints",
          title: "Testability & Checkpoints",
          description: "Each step defines what automated test or command proves it is complete.",
          probingQuestions: [
            "What concrete command or test confirms each task is done before moving to the next?",
            "How do we prevent regressions during intermediate steps?",
          ],
          heuristicKeywords: ["test", "verification", "checkpoint", "validate", "command", "check"],
        },
      ],
    },
  },

  "code-generation": {
    id: "code-generation",
    number: "3.2",
    name: "Code Implementation",
    phase: "construction",
    description: "Execute the implementation tasks following clean code principles, typed contracts, and unit tests.",
    persona: "aidlc-software-engineer",
    defaultArtifactName: "construction-log.md",
    rubric: {
      stageId: "code-generation",
      stageName: "Code Implementation",
      persona: "aidlc-software-engineer",
      dimensions: [
        {
          id: "code_completeness",
          title: "Implementation Alignment with Design",
          description: "Code matches the architectural contracts without omitting edge cases or shortcuts.",
          probingQuestions: [
            "Does the code cover all edge cases documented in the inception phase?",
            "Are error handling paths genuinely implemented or stubbed with TODOs?",
          ],
          heuristicKeywords: ["implementation", "completed", "handling", "error", "files modified", "changes"],
        },
      ],
    },
  },

  // --- VERIFICATION ---
  "automated-testing": {
    id: "automated-testing",
    number: "4.1",
    name: "Automated Testing & Evals",
    phase: "verification",
    description: "Execute unit, integration, and property/eval tests to verify functional and regression safety.",
    persona: "aidlc-qa-agent",
    defaultArtifactName: "verification-report.md",
    rubric: {
      stageId: "automated-testing",
      stageName: "Automated Testing & Evals",
      persona: "aidlc-qa-agent",
      dimensions: [
        {
          id: "test_evidence",
          title: "Empirical Test Evidence",
          description: "Provides execution output, test pass counts, coverage metrics, and regression proofs.",
          probingQuestions: [
            "What are the concrete test execution results (passed/failed/skipped)?",
            "Did we test both the happy path and negative failure injection paths?",
          ],
          heuristicKeywords: ["test passed", "test results", "coverage", "integration", "unit test", "assertions", "failures 0"],
        },
      ],
    },
  },

  // --- OPERATION ---
  "operation-readiness": {
    id: "operation-readiness",
    number: "5.1",
    name: "Operational Readiness & Reflection",
    phase: "operation",
    description: "Prepare deployment notes, telemetry/observability guides, rollback procedures, and post-mortem review.",
    persona: "aidlc-devops-agent",
    defaultArtifactName: "operational-readiness.md",
    rubric: {
      stageId: "operation-readiness",
      stageName: "Operational Readiness & Reflection",
      persona: "aidlc-devops-agent",
      dimensions: [
        {
          id: "rollback_and_monitoring",
          title: "Rollback Strategy & Observability",
          description: "Defines metrics/alerts to monitor and steps to reverse changes if anomalies occur.",
          probingQuestions: [
            "If an issue emerges in production, what alert triggers and how do we roll back safely?",
            "Are metrics and traces in place to verify runtime health?",
          ],
          heuristicKeywords: ["rollback", "monitoring", "metrics", "alerts", "logging", "runbook", "deploy"],
        },
        {
          id: "reflection_and_learning",
          title: "Post-Mortem & Architecture Insights",
          description: "Captures learnings, future debt created, and recommendations for subsequent intents.",
          probingQuestions: [
            "What technical debt or deferred items were incurred during this delivery?",
            "What key architectural insights should inform the next intent?",
          ],
          heuristicKeywords: ["learnings", "debt", "future", "reflection", "improvements", "takeaways"],
        },
      ],
    },
  },
};

/**
 * Evaluates artifact content against a stage's Socratic rubric.
 */
export function evaluateRubric(stageId: string, content: string): RubricEvaluationResult {
  const stageDef = STAGE_DEFINITIONS[stageId];
  if (!stageDef) {
    return {
      stageId,
      satisfied: true,
      score: 1.0,
      dimensionResults: [],
      unresolvedProbes: [],
      feedback: `No formal rubric defined for stage '${stageId}'. Passed automatically.`,
    };
  }

  const rubric = stageDef.rubric;
  const lowerContent = content.toLowerCase();
  const dimensionResults: RubricDimensionResult[] = [];
  const unresolvedProbes: string[] = [];

  let satisfiedCount = 0;

  for (const dim of rubric.dimensions) {
    let satisfied = false;
    let notes = "";

    // Heuristic checking:
    // 1. Minimum content length threshold
    // 2. Keyword signals or heading matches
    if (content.trim().length < 80) {
      satisfied = false;
      notes = `Draft content is too brief (< 80 characters) to satisfy dimension '${dim.title}'.`;
    } else {
      const keywords = dim.heuristicKeywords || [];
      const matchCount = keywords.filter((kw) => lowerContent.includes(kw.toLowerCase())).length;

      // Also check if dimension title itself appears in headings
      const titleMentioned = lowerContent.includes(dim.title.toLowerCase()) || lowerContent.includes(dim.id.replace(/_/g, " "));

      if (titleMentioned || matchCount >= 2 || (keywords.length <= 2 && matchCount >= 1)) {
        satisfied = true;
        notes = `Dimension satisfactorily addressed (found key architectural signals: ${keywords.filter((kw) => lowerContent.includes(kw.toLowerCase())).join(", ")}).`;
      } else {
        satisfied = false;
        notes = `Missing explicit exploration of '${dim.title}'. Looked for signals related to: [${keywords.join(", ")}].`;
      }
    }

    if (satisfied) {
      satisfiedCount++;
    } else {
      unresolvedProbes.push(...dim.probingQuestions);
    }

    dimensionResults.push({
      dimensionId: dim.id,
      title: dim.title,
      satisfied,
      notes,
      suggestedProbes: satisfied ? [] : dim.probingQuestions,
    });
  }

  const score = rubric.dimensions.length > 0 ? satisfiedCount / rubric.dimensions.length : 1.0;
  const allSatisfied = satisfiedCount === rubric.dimensions.length;

  let feedback = "";
  if (allSatisfied) {
    feedback = `All ${rubric.dimensions.length} Socratic rubric dimensions for '${stageDef.name}' are satisfied. Ready for gate approval.`;
  } else {
    feedback = `Rubric criteria incomplete (${satisfiedCount}/${rubric.dimensions.length} dimensions satisfied). You must engage the user with the unresolved Socratic probes before gate approval.`;
  }

  return {
    stageId,
    satisfied: allSatisfied,
    score,
    dimensionResults,
    unresolvedProbes,
    feedback,
  };
}
