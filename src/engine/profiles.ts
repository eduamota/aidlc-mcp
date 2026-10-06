import { ScopeType, ProjectType, DepthLevel, TestStrategy, StageState } from "../types.js";
import { STAGE_DEFINITIONS } from "./socratic-rubric.js";
import { getScopeSpec, getAllScopeSpecs, detectScopeFromPrompt, ScopeSpec } from "../scopes/registry.js";

export { getScopeSpec, getAllScopeSpecs, detectScopeFromPrompt, ScopeSpec };

export interface ScopeDefinition {
  type: ScopeType;
  name: string;
  description: string;
  defaultDepth: DepthLevel;
  defaultTestStrategy: TestStrategy;
  stageIds: string[];
  spec?: ScopeSpec;
}

export const SCOPES: Record<ScopeType, ScopeDefinition> = {
  enterprise: {
    type: "enterprise",
    name: "Regulated Enterprise Feature",
    description: "Full audit trail, compliance review, and production-grade operations across all 33 stages.",
    defaultDepth: "comprehensive",
    defaultTestStrategy: "comprehensive",
    stageIds: [
      "intent-capture",
      "market-research",
      "feasibility-constraints",
      "scope-definition",
      "team-formation",
      "rough-mockups",
      "approval-handoff",
      "reverse-engineering",
      "practices-discovery",
      "requirements-analysis",
      "user-stories",
      "refined-mockups",
      "domain-design",
      "units-generation",
      "contract-design",
      "delivery-planning",
      "functional-design",
      "nfr-requirements",
      "nfr-design",
      "infrastructure-design",
      "code-generation",
      "build-and-test",
      "ci-pipeline",
      "deployment-pipeline",
      "environment-provisioning",
      "deployment-execution",
      "observability-setup",
      "incident-response",
      "performance-validation",
      "feedback-reflection",
    ],
  },

  feature: {
    type: "feature",
    name: "Standard Feature",
    description: "Complete full-lifecycle feature development with standard artifact detail and testing across all phases.",
    defaultDepth: "standard",
    defaultTestStrategy: "standard",
    stageIds: [
      "intent-capture",
      "market-research",
      "feasibility-constraints",
      "scope-definition",
      "team-formation",
      "rough-mockups",
      "approval-handoff",
      "reverse-engineering",
      "practices-discovery",
      "requirements-analysis",
      "user-stories",
      "refined-mockups",
      "domain-design",
      "units-generation",
      "contract-design",
      "delivery-planning",
      "functional-design",
      "nfr-requirements",
      "nfr-design",
      "infrastructure-design",
      "code-generation",
      "build-and-test",
      "ci-pipeline",
      "deployment-pipeline",
      "environment-provisioning",
      "deployment-execution",
      "observability-setup",
      "incident-response",
      "performance-validation",
      "feedback-reflection",
    ],
  },

  mvp: {
    type: "mvp",
    name: "Greenfield MVP",
    description: "Rapid minimum viable product. Skips late-stage operations but retains full design and construction.",
    defaultDepth: "standard",
    defaultTestStrategy: "standard",
    stageIds: [
      "intent-capture",
      "feasibility-constraints",
      "scope-definition",
      "rough-mockups",
      "reverse-engineering",
      "practices-discovery",
      "requirements-analysis",
      "user-stories",
      "refined-mockups",
      "domain-design",
      "units-generation",
      "contract-design",
      "delivery-planning",
      "functional-design",
      "nfr-requirements",
      "nfr-design",
      "infrastructure-design",
      "code-generation",
      "build-and-test",
      "ci-pipeline",
    ],
  },

  poc: {
    type: "poc",
    name: "Proof of Concept (PoC)",
    description: "Prove feasibility fast. Skips most Ideation and Inception stages, focusing strictly on getting to verified code.",
    defaultDepth: "minimal",
    defaultTestStrategy: "minimal",
    stageIds: [
      "intent-capture",
      "reverse-engineering",
      "requirements-analysis",
      "code-generation",
      "build-and-test",
    ],
  },

  bugfix: {
    type: "bugfix",
    name: "Bugfix & Root Cause Remediation",
    description: "Streamlined path from requirements analysis through code generation, test, and verified deployment.",
    defaultDepth: "minimal",
    defaultTestStrategy: "minimal",
    stageIds: [
      "reverse-engineering",
      "requirements-analysis",
      "code-generation",
      "build-and-test",
      "deployment-pipeline",
      "deployment-execution",
    ],
  },

  refactor: {
    type: "refactor",
    name: "Code Refactoring",
    description: "Clean up and restructure existing code without changing functionality, with verified deployment.",
    defaultDepth: "minimal",
    defaultTestStrategy: "minimal",
    stageIds: [
      "reverse-engineering",
      "requirements-analysis",
      "functional-design",
      "code-generation",
      "build-and-test",
      "deployment-pipeline",
      "deployment-execution",
    ],
  },

  infra: {
    type: "infra",
    name: "Infrastructure Change",
    description: "Focuses on cloud architecture, IaC, security, provisioning, and deployment pipelines.",
    defaultDepth: "standard",
    defaultTestStrategy: "standard",
    stageIds: [
      "practices-discovery",
      "requirements-analysis",
      "nfr-requirements",
      "nfr-design",
      "infrastructure-design",
      "ci-pipeline",
      "deployment-pipeline",
      "environment-provisioning",
      "deployment-execution",
      "observability-setup",
    ],
  },

  "security-patch": {
    type: "security-patch",
    name: "Security Vulnerability Patch",
    description: "Fast-track response to CVEs or security flaws through security-relevant stages to production.",
    defaultDepth: "minimal",
    defaultTestStrategy: "minimal",
    stageIds: [
      "reverse-engineering",
      "requirements-analysis",
      "nfr-requirements",
      "code-generation",
      "build-and-test",
      "deployment-pipeline",
      "deployment-execution",
    ],
  },

  classic: {
    type: "classic",
    name: "Classic V1 Lifecycle",
    description: "V1-style ceremony: full Inception and Construction with advisory reviews, skipping Ideation and Operation.",
    defaultDepth: "standard",
    defaultTestStrategy: "standard",
    stageIds: [
      "reverse-engineering",
      "practices-discovery",
      "requirements-analysis",
      "user-stories",
      "refined-mockups",
      "domain-design",
      "units-generation",
      "contract-design",
      "delivery-planning",
      "functional-design",
      "nfr-requirements",
      "nfr-design",
      "infrastructure-design",
      "code-generation",
      "build-and-test",
    ],
  },

  workshop: {
    type: "workshop",
    name: "Workshop / Training Lab",
    description: "Facilitated full Inception-through-Operation lifecycle with a lighter, teaching-oriented test strategy.",
    defaultDepth: "standard",
    defaultTestStrategy: "minimal",
    stageIds: [
      "reverse-engineering",
      "practices-discovery",
      "requirements-analysis",
      "user-stories",
      "refined-mockups",
      "domain-design",
      "units-generation",
      "contract-design",
      "delivery-planning",
      "functional-design",
      "nfr-requirements",
      "nfr-design",
      "infrastructure-design",
      "code-generation",
      "build-and-test",
      "ci-pipeline",
      "deployment-pipeline",
      "environment-provisioning",
      "deployment-execution",
      "observability-setup",
      "incident-response",
      "performance-validation",
      "feedback-reflection",
    ],
  },

  express: {
    type: "express",
    name: "Express Iteration",
    description: "Lightest path: requirements through code and test to conditional deploy, with no design pass or reviewers.",
    defaultDepth: "minimal",
    defaultTestStrategy: "minimal",
    stageIds: [
      "reverse-engineering",
      "requirements-analysis",
      "code-generation",
      "build-and-test",
      "deployment-pipeline",
      "deployment-execution",
      "observability-setup",
    ],
  },
};

// Attach official ScopeSpec to each scope definition
for (const [key, scope] of Object.entries(SCOPES)) {
  scope.spec = getScopeSpec(key);
}

// Backward-compatibility alias
export const PROFILES = SCOPES;

/**
 * Initializes the list of StageState objects for a given scope and project type.
 * Greenfield projects skip reverse-engineering automatically.
 */
export function createStagesForScope(
  scopeType: ScopeType,
  projectType: ProjectType = "greenfield"
): StageState[] {
  const scopeDef = SCOPES[scopeType] || SCOPES.feature;
  let stageIds = [...scopeDef.stageIds];

  // If greenfield, remove reverse-engineering since there is no existing code to scan
  if (projectType === "greenfield") {
    stageIds = stageIds.filter((id) => id !== "reverse-engineering");
  } else if (projectType === "brownfield" && !stageIds.includes("reverse-engineering")) {
    const reqIndex = stageIds.indexOf("requirements-analysis");
    if (reqIndex !== -1) {
      stageIds.splice(reqIndex, 0, "reverse-engineering");
    } else {
      stageIds.unshift("reverse-engineering");
    }
  }

  return stageIds.map((stageId, index) => {
    const def = STAGE_DEFINITIONS[stageId];
    if (!def) {
      throw new Error(`Unknown stage ID: ${stageId}`);
    }
    return {
      id: def.id,
      number: def.number,
      name: def.name,
      phase: def.phase,
      status: index === 0 ? "in_progress" : "pending",
      unresolvedProbes: def.rubric.dimensions.flatMap((d) => d.probingQuestions),
    };
  });
}

// Backward-compatibility alias
export const createStagesForProfile = createStagesForScope;
