import { SocraticRubric, RubricEvaluationResult, RubricDimensionResult, StageDefinition } from "../types.js";

export const STAGE_DEFINITIONS: Record<string, StageDefinition> = {
  // ==========================================
  // PHASE 0: INITIALIZATION
  // ==========================================
  "workspace-scaffold": {
    id: "workspace-scaffold",
    number: "0.1",
    name: "Workspace Scaffold",
    phase: "initialization",
    description: "Initialize directory structure, ensure spaces, and prepare intent record directory.",
    persona: "aidlc-system",
    defaultArtifactName: "initialization-log.md",
    rubric: {
      stageId: "workspace-scaffold",
      stageName: "Workspace Scaffold",
      persona: "aidlc-system",
      dimensions: [
        {
          id: "dirs_ensured",
          title: "Directory Scaffolding",
          description: "Record directories and workspace paths exist and are writable.",
          probingQuestions: ["Are all workspace paths and intent directories verified?"],
          heuristicKeywords: ["scaffold", "directory", "initialized", "created"],
        },
      ],
    },
  },
  "workspace-detection": {
    id: "workspace-detection",
    number: "0.2",
    name: "Workspace Detection",
    phase: "initialization",
    description: "Scan the project to classify greenfield vs brownfield and discover manifest files.",
    persona: "aidlc-developer-agent",
    defaultArtifactName: "workspace-detection.md",
    rubric: {
      stageId: "workspace-detection",
      stageName: "Workspace Detection",
      persona: "aidlc-developer-agent",
      dimensions: [
        {
          id: "classification",
          title: "Project Classification",
          description: "Detects runtimes, frameworks, and identifies greenfield vs brownfield.",
          probingQuestions: ["Is the project greenfield or brownfield, and what runtimes exist?"],
          heuristicKeywords: ["greenfield", "brownfield", "runtime", "detection", "manifest"],
        },
      ],
    },
  },
  "state-initialization": {
    id: "state-initialization",
    number: "0.3",
    name: "State Initialization",
    phase: "initialization",
    description: "Initialize aidlc-state.md with scope, depth level, and test strategy.",
    persona: "aidlc-system",
    defaultArtifactName: "state-plan.md",
    rubric: {
      stageId: "state-initialization",
      stageName: "State Initialization",
      persona: "aidlc-system",
      dimensions: [
        {
          id: "state_plan",
          title: "Lifecycle State Plan",
          description: "Confirmed scope, depth level, and full stage sequence.",
          probingQuestions: ["Are scope, depth, and test strategy confirmed?"],
          heuristicKeywords: ["scope", "depth", "strategy", "state", "roadmap"],
        },
      ],
    },
  },

  // ==========================================
  // PHASE 1: IDEATION
  // ==========================================
  "intent-capture": {
    id: "intent-capture",
    number: "1.1",
    name: "Intent Capture & Framing",
    phase: "ideation",
    description: "Capture user intent, core motivation, target beneficiaries, and define high-level boundaries.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "intent-brief.md",
    rubric: {
      stageId: "intent-capture",
      stageName: "Intent Capture & Framing",
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
  "market-research": {
    id: "market-research",
    number: "1.2",
    name: "Market Research & Competitive Analysis",
    phase: "ideation",
    description: "Investigate market landscape, competitor patterns, and benchmark solutions.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "market-research.md",
    rubric: {
      stageId: "market-research",
      stageName: "Market Research & Competitive Analysis",
      persona: "aidlc-product-agent",
      dimensions: [
        {
          id: "competitor_analysis",
          title: "Industry & Competitor Benchmarks",
          description: "Compares current intent against existing industry solutions and best practices.",
          probingQuestions: [
            "How do similar products or open-source solutions solve this problem?",
            "What differentiators or unique constraints define our approach?",
          ],
          heuristicKeywords: ["market", "competitor", "benchmark", "industry", "landscape"],
        },
      ],
    },
  },
  "feasibility-constraints": {
    id: "feasibility-constraints",
    number: "1.3",
    name: "Feasibility & Technical Constraints",
    phase: "ideation",
    description: "Evaluate technical feasibility, resource constraints, cost projections, and platform limitations.",
    persona: "aidlc-architect-agent",
    defaultArtifactName: "feasibility-assessment.md",
    rubric: {
      stageId: "feasibility-constraints",
      stageName: "Feasibility & Technical Constraints",
      persona: "aidlc-architect-agent",
      dimensions: [
        {
          id: "tech_feasibility",
          title: "Technical Feasibility & Cost / Resource Constraints",
          description: "Assesses computational, storage, budget, and platform constraints.",
          probingQuestions: [
            "What hard infrastructure, licensing, or rate-limit constraints bound this project?",
            "Is the proposed solution technically viable within existing resource budgets?",
          ],
          heuristicKeywords: ["feasibility", "cost", "budget", "constraints", "limitations"],
        },
      ],
    },
  },
  "scope-definition": {
    id: "scope-definition",
    number: "1.4",
    name: "Scope & Boundary Definition",
    phase: "ideation",
    description: "Establish strict feature boundaries, delivery milestones, and phased release cuts.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "scope-definition.md",
    rubric: {
      stageId: "scope-definition",
      stageName: "Scope & Boundary Definition",
      persona: "aidlc-product-agent",
      dimensions: [
        {
          id: "boundary_spec",
          title: "Milestone & Cut Boundaries",
          description: "Distinguishes P0 must-haves from P1/P2 deferred backlog items.",
          probingQuestions: [
            "What is strictly required for the initial cut vs subsequent releases?",
            "What triggers a scope freeze or escalation?",
          ],
          heuristicKeywords: ["p0", "milestones", "release cut", "scope", "priority"],
        },
      ],
    },
  },
  "team-formation": {
    id: "team-formation",
    number: "1.5",
    name: "Team & Persona Formation",
    phase: "ideation",
    description: "Determine domain expert agents, stakeholder roles, and reviewer distribution for the lifecycle.",
    persona: "aidlc-coach-agent",
    defaultArtifactName: "team-formation.md",
    rubric: {
      stageId: "team-formation",
      stageName: "Team & Persona Formation",
      persona: "aidlc-coach-agent",
      dimensions: [
        {
          id: "stakeholder_roles",
          title: "Agent & Stakeholder Allocation",
          description: "Specifies lead personas and reviewer responsibilities across stages.",
          probingQuestions: ["Which domain experts will lead design, security, and verification stages?"],
          heuristicKeywords: ["team", "roles", "personas", "responsibilities", "stakeholders"],
        },
      ],
    },
  },
  "rough-mockups": {
    id: "rough-mockups",
    number: "1.6",
    name: "Rough Mockups & User Flows",
    phase: "ideation",
    description: "Produce early visual mockups, CLI ergonomics, or sequence flowcharts.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "rough-mockups.md",
    rubric: {
      stageId: "rough-mockups",
      stageName: "Rough Mockups & User Flows",
      persona: "aidlc-product-agent",
      dimensions: [
        {
          id: "user_flow",
          title: "User Flow & Interface Concepts",
          description: "Maps high-level user navigation, interaction steps, or CLI command layout.",
          probingQuestions: ["What does the end-to-end user interaction sequence look like?"],
          heuristicKeywords: ["flow", "mockup", "ui", "cli", "sequence", "interaction"],
        },
      ],
    },
  },
  "approval-handoff": {
    id: "approval-handoff",
    number: "1.7",
    name: "Approval & Inception Handoff",
    phase: "ideation",
    description: "Formal sign-off on ideation artifacts and authorization to begin formal inception engineering.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "ideation-handoff.md",
    rubric: {
      stageId: "approval-handoff",
      stageName: "Approval & Inception Handoff",
      persona: "aidlc-product-agent",
      dimensions: [
        {
          id: "handoff_signoff",
          title: "Handoff Readiness Sign-off",
          description: "Validates all ideation inputs are signed off before inception.",
          probingQuestions: ["Have business and technical stakeholders approved transition to Inception?"],
          heuristicKeywords: ["handoff", "approval", "sign-off", "authorized", "ready"],
        },
      ],
    },
  },

  // ==========================================
  // PHASE 2: INCEPTION
  // ==========================================
  "reverse-engineering": {
    id: "reverse-engineering",
    number: "2.1",
    name: "Brownfield Reverse Engineering",
    phase: "inception",
    description: "Systematic code discovery and documentation of existing architecture, dependencies, data models, and entry points.",
    persona: "aidlc-developer-agent",
    defaultArtifactName: "reverse-engineering.md",
    rubric: {
      stageId: "reverse-engineering",
      stageName: "Brownfield Reverse Engineering",
      persona: "aidlc-developer-agent",
      dimensions: [
        {
          id: "tech_stack_and_dependencies",
          title: "Tech Stack & Runtime Environment",
          description: "Documents languages, runtimes, package managers, and primary dependencies in the codebase.",
          probingQuestions: ["What runtime environments, frameworks, and core dependencies are present in the repository?"],
          heuristicKeywords: ["tech stack", "runtime", "dependencies", "framework", "package", "version"],
        },
        {
          id: "components_and_layout",
          title: "Component & Directory Layout",
          description: "Documents folder organization, key modules, entry points, and structural patterns.",
          probingQuestions: ["What is the directory organization and where do core modules live?"],
          heuristicKeywords: ["directory", "layout", "components", "structure", "entry point", "modules"],
        },
        {
          id: "data_contracts_and_apis",
          title: "Data Models & API Contracts",
          description: "Catalogs existing data schemas, database models, DTOs, and exposed endpoints/interfaces.",
          probingQuestions: ["What data schemas, database tables, or entities currently exist?"],
          heuristicKeywords: ["data model", "schema", "api", "endpoints", "contracts", "routes", "entities"],
        },
        {
          id: "conventions_and_constraints",
          title: "Conventions & Legacy Constraints",
          description: "Notes architectural conventions, legacy patterns, and technical constraints to respect.",
          probingQuestions: ["What existing coding conventions or architectural patterns must be preserved?"],
          heuristicKeywords: ["conventions", "constraints", "legacy", "debt", "patterns", "assumptions"],
        },
      ],
    },
  },
  "practices-discovery": {
    id: "practices-discovery",
    number: "2.2",
    name: "Practices & Conventions Discovery",
    phase: "inception",
    description: "Discover team coding standards, lint rules, test frameworks, and CI/CD conventions.",
    persona: "aidlc-developer-agent",
    defaultArtifactName: "practices-discovery.md",
    rubric: {
      stageId: "practices-discovery",
      stageName: "Practices & Conventions Discovery",
      persona: "aidlc-developer-agent",
      dimensions: [
        {
          id: "conventions_audit",
          title: "Team Standards & Formatting",
          description: "Documents existing linters, formatters, typecheckers, and Git workflows.",
          probingQuestions: ["What linters, formatting tools, and test runners are configured in the repo?"],
          heuristicKeywords: ["lint", "prettier", "standards", "conventions", "practices"],
        },
      ],
    },
  },
  "requirements-analysis": {
    id: "requirements-analysis",
    number: "2.3",
    name: "Requirements Analysis",
    phase: "inception",
    description: "Deep dive into functional and non-functional requirements, user journeys, and edge cases.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "requirements.md",
    rubric: {
      stageId: "requirements-analysis",
      stageName: "Requirements Analysis",
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
  "user-stories": {
    id: "user-stories",
    number: "2.4",
    name: "Detailed User Stories & Scenarios",
    phase: "inception",
    description: "Gherkin-style user stories with Given/When/Then acceptance criteria.",
    persona: "aidlc-product-agent",
    defaultArtifactName: "user-stories.md",
    rubric: {
      stageId: "user-stories",
      stageName: "Detailed User Stories & Scenarios",
      persona: "aidlc-product-agent",
      dimensions: [
        {
          id: "acceptance_criteria",
          title: "Given/When/Then Acceptance Scenarios",
          description: "Rigorous behavioral specifications for automated verification.",
          probingQuestions: ["Does each user story define explicit Given/When/Then acceptance scenarios?"],
          heuristicKeywords: ["given", "when", "then", "scenario", "acceptance criteria"],
        },
      ],
    },
  },
  "refined-mockups": {
    id: "refined-mockups",
    number: "2.5",
    name: "Refined Mockups & Screen Specifications",
    phase: "inception",
    description: "Detailed wireframes, screen states, and responsive layouts.",
    persona: "aidlc-developer-agent",
    defaultArtifactName: "refined-mockups.md",
    rubric: {
      stageId: "refined-mockups",
      stageName: "Refined Mockups & Screen Specifications",
      persona: "aidlc-developer-agent",
      dimensions: [
        {
          id: "ui_states",
          title: "UI States & Error Presentations",
          description: "Details loading, empty, success, and validation error states.",
          probingQuestions: ["Are all error and loading states visually defined?"],
          heuristicKeywords: ["mockup", "screen", "wireframe", "empty state", "loading"],
        },
      ],
    },
  },
  "domain-design": {
    id: "domain-design",
    number: "2.6",
    name: "Domain Model & System Architecture",
    phase: "inception",
    description: "Entity relationship models, aggregates, domain events, and bounded contexts.",
    persona: "aidlc-architect-agent",
    defaultArtifactName: "domain-design.md",
    rubric: {
      stageId: "domain-design",
      stageName: "Domain Model & System Architecture",
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
      ],
    },
  },
  "units-generation": {
    id: "units-generation",
    number: "2.7",
    name: "Units of Work Generation",
    phase: "inception",
    description: "Generate atomic Units of Work (UoW) organized as a dependency DAG for construction.",
    persona: "aidlc-tech-lead",
    defaultArtifactName: "units-of-work.md",
    rubric: {
      stageId: "units-generation",
      stageName: "Units of Work Generation",
      persona: "aidlc-tech-lead",
      dimensions: [
        {
          id: "unit_dag",
          title: "Unit of Work DAG & Dependencies",
          description: "Specifies independent units with clear inputs, outputs, and dependency edges.",
          probingQuestions: ["Can each unit be built and verified independently in the DAG?"],
          heuristicKeywords: ["unit of work", "dag", "dependencies", "atomic", "parallel"],
        },
      ],
    },
  },
  "contract-design": {
    id: "contract-design",
    number: "2.8",
    name: "Contract & Interface Design",
    phase: "inception",
    description: "Rigorous API contracts (OpenAPI/Protobuf), schemas, and protocol invariants.",
    persona: "aidlc-architect-agent",
    defaultArtifactName: "contract-design.md",
    rubric: {
      stageId: "contract-design",
      stageName: "Contract & Interface Design",
      persona: "aidlc-architect-agent",
      dimensions: [
        {
          id: "api_contracts",
          title: "API Specifications & Schema Invariants",
          description: "Explicit OpenAPI/JSON-Schema or Protobuf contracts with backward compatibility.",
          probingQuestions: ["Are all request/response schemas strictly typed and backwards compatible?"],
          heuristicKeywords: ["contract", "schema", "openapi", "protobuf", "interface", "payload"],
        },
      ],
    },
  },
  "delivery-planning": {
    id: "delivery-planning",
    number: "2.9",
    name: "Delivery Planning & Risk Assessment",
    phase: "inception",
    description: "Plan construction timeline, risk mitigations, test fixtures, and gating checkpoints.",
    persona: "aidlc-tech-lead",
    defaultArtifactName: "delivery-plan.md",
    rubric: {
      stageId: "delivery-planning",
      stageName: "Delivery Planning & Risk Assessment",
      persona: "aidlc-tech-lead",
      dimensions: [
        {
          id: "risk_mitigation",
          title: "Delivery Risks & Contingencies",
          description: "Identifies technical risks and mitigation fallbacks.",
          probingQuestions: ["What is the highest-risk construction item, and how is it mitigated?"],
          heuristicKeywords: ["risk", "mitigation", "timeline", "milestone", "delivery"],
        },
      ],
    },
  },

  // ==========================================
  // PHASE 3: CONSTRUCTION
  // ==========================================
  "functional-design": {
    id: "functional-design",
    number: "3.1",
    name: "Functional Design",
    phase: "construction",
    description: "Detailed class/module design, internal data flows, and state machines for each unit.",
    persona: "aidlc-developer-agent",
    defaultArtifactName: "functional-design.md",
    rubric: {
      stageId: "functional-design",
      stageName: "Functional Design",
      persona: "aidlc-developer-agent",
      dimensions: [
        {
          id: "internal_flows",
          title: "Internal Class & Function Architecture",
          description: "Defines class responsibilities, interfaces, and state handling.",
          probingQuestions: ["How do internal functions divide responsibility and maintain state purity?"],
          heuristicKeywords: ["functional design", "module", "class", "state machine", "flow"],
        },
      ],
    },
  },
  "nfr-requirements": {
    id: "nfr-requirements",
    number: "3.2",
    name: "NFR & Security Requirements",
    phase: "construction",
    description: "Detailed security specifications, RBAC rules, audit logging, and latency budgets.",
    persona: "aidlc-devsecops-agent",
    defaultArtifactName: "nfr-requirements.md",
    rubric: {
      stageId: "nfr-requirements",
      stageName: "NFR & Security Requirements",
      persona: "aidlc-devsecops-agent",
      dimensions: [
        {
          id: "security_and_audit",
          title: "Security, RBAC, and Audit Logging",
          description: "Explicit trust boundaries, authorization rules, and non-repudiation audit trails.",
          probingQuestions: ["What authorization checks and audit log events must be recorded?"],
          heuristicKeywords: ["security", "audit", "rbac", "authorization", "nfr", "compliance"],
        },
      ],
    },
  },
  "nfr-design": {
    id: "nfr-design",
    number: "3.3",
    name: "NFR & Resilience Design",
    phase: "construction",
    description: "Design rate limiters, retries, exponential backoffs, and caching strategies.",
    persona: "aidlc-architect-agent",
    defaultArtifactName: "nfr-design.md",
    rubric: {
      stageId: "nfr-design",
      stageName: "NFR & Resilience Design",
      persona: "aidlc-architect-agent",
      dimensions: [
        {
          id: "resilience_patterns",
          title: "Retries, Backoffs, and Circuit Breakers",
          description: "Resilience patterns to prevent cascading failures under heavy load.",
          probingQuestions: ["What retry limits, timeouts, and fallback mechanisms protect dependencies?"],
          heuristicKeywords: ["retry", "backoff", "resilience", "circuit breaker", "cache", "rate limit"],
        },
      ],
    },
  },
  "infrastructure-design": {
    id: "infrastructure-design",
    number: "3.4",
    name: "Infrastructure & Deployment Design",
    phase: "construction",
    description: "Terraform/CDK specifications, container definitions, and cloud resource sizing.",
    persona: "aidlc-infra-agent",
    defaultArtifactName: "infrastructure-design.md",
    rubric: {
      stageId: "infrastructure-design",
      stageName: "Infrastructure & Deployment Design",
      persona: "aidlc-infra-agent",
      dimensions: [
        {
          id: "infra_specs",
          title: "Cloud Resources & IaC Definitions",
          description: "Defines network VPCs, compute specs, storage tiers, and IAM roles.",
          probingQuestions: ["What cloud resources and IAM policies are defined in IaC?"],
          heuristicKeywords: ["infrastructure", "iac", "terraform", "cdk", "container", "iam", "cloud"],
        },
      ],
    },
  },
  "code-generation": {
    id: "code-generation",
    number: "3.5",
    name: "Code Generation & Implementation",
    phase: "construction",
    description: "Implement code tasks following clean code principles, SOLID patterns, and typing.",
    persona: "aidlc-developer-agent",
    defaultArtifactName: "construction-log.md",
    rubric: {
      stageId: "code-generation",
      stageName: "Code Generation & Implementation",
      persona: "aidlc-developer-agent",
      dimensions: [
        {
          id: "implementation_quality",
          title: "Code Alignment with Contract",
          description: "Code accurately satisfies design and interface contracts with genuine error handling.",
          probingQuestions: [
            "Does the code cover all edge cases documented in inception?",
            "Are error handling paths implemented without empty catches?",
          ],
          heuristicKeywords: ["implementation", "completed", "handling", "files modified", "changes"],
        },
      ],
    },
  },
  "build-and-test": {
    id: "build-and-test",
    number: "3.6",
    name: "Build and Automated Testing",
    phase: "construction",
    description: "Execute compiler, linters, unit tests, and integration test suites.",
    persona: "aidlc-quality-agent",
    defaultArtifactName: "test-results.md",
    rubric: {
      stageId: "build-and-test",
      stageName: "Build and Automated Testing",
      persona: "aidlc-quality-agent",
      dimensions: [
        {
          id: "test_verification",
          title: "Pass Counts & Coverage Metrics",
          description: "Shows zero test failures and satisfactory code coverage.",
          probingQuestions: ["Did all unit and integration test assertions pass without regressions?"],
          heuristicKeywords: ["test passed", "test results", "assertions", "coverage", "passed"],
        },
      ],
    },
  },
  "ci-pipeline": {
    id: "ci-pipeline",
    number: "3.7",
    name: "CI Pipeline Setup",
    phase: "construction",
    description: "Configure GitHub Actions / GitLab CI pipeline with automated security scanning and testing.",
    persona: "aidlc-devsecops-agent",
    defaultArtifactName: "ci-pipeline.md",
    rubric: {
      stageId: "ci-pipeline",
      stageName: "CI Pipeline Setup",
      persona: "aidlc-devsecops-agent",
      dimensions: [
        {
          id: "ci_automation",
          title: "Automated Build, Test & Lint Gates",
          description: "Configures CI workflows with blocking verification checks.",
          probingQuestions: ["Does the CI workflow run tests, linter, and security scans on PRs?"],
          heuristicKeywords: ["ci", "pipeline", "github actions", "workflow", "automated"],
        },
      ],
    },
  },

  // ==========================================
  // PHASE 4: OPERATION
  // ==========================================
  "deployment-pipeline": {
    id: "deployment-pipeline",
    number: "4.1",
    name: "Deployment Pipeline (CD)",
    phase: "operation",
    description: "Configure continuous delivery pipeline with canary or blue/green progression.",
    persona: "aidlc-devsecops-agent",
    defaultArtifactName: "deployment-pipeline.md",
    rubric: {
      stageId: "deployment-pipeline",
      stageName: "Deployment Pipeline (CD)",
      persona: "aidlc-devsecops-agent",
      dimensions: [
        {
          id: "cd_strategy",
          title: "Release Strategy & Canary Deployments",
          description: "Defines staged rollout, canary thresholds, and automated health checks.",
          probingQuestions: ["What canary or blue/green progression protects production rollouts?"],
          heuristicKeywords: ["deployment pipeline", "cd", "canary", "blue green", "rollout"],
        },
      ],
    },
  },
  "environment-provisioning": {
    id: "environment-provisioning",
    number: "4.2",
    name: "Environment Provisioning",
    phase: "operation",
    description: "Provision staging/production cloud infrastructure, databases, and network gateways.",
    persona: "aidlc-infra-agent",
    defaultArtifactName: "environment-provisioning.md",
    rubric: {
      stageId: "environment-provisioning",
      stageName: "Environment Provisioning",
      persona: "aidlc-infra-agent",
      dimensions: [
        {
          id: "environment_ready",
          title: "Target Environment Verification",
          description: "Ensures environment is provisioned, secured, and ready for workload execution.",
          probingQuestions: ["Are DNS, SSL certificates, VPC subnets, and database instances ready?"],
          heuristicKeywords: ["provisioning", "environment", "staging", "production", "infrastructure"],
        },
      ],
    },
  },
  "deployment-execution": {
    id: "deployment-execution",
    number: "4.3",
    name: "Deployment Execution",
    phase: "operation",
    description: "Execute deployment, run database migrations, and perform smoke test verification.",
    persona: "aidlc-devsecops-agent",
    defaultArtifactName: "deployment-execution.md",
    rubric: {
      stageId: "deployment-execution",
      stageName: "Deployment Execution",
      persona: "aidlc-devsecops-agent",
      dimensions: [
        {
          id: "deployment_verification",
          title: "Live Smoke Tests & Migration Health",
          description: "Validates application is serving live traffic cleanly post-deployment.",
          probingQuestions: ["Did database migrations run cleanly and do healthcheck endpoints return 200?"],
          heuristicKeywords: ["deployed", "smoke test", "migration", "health check", "live"],
        },
      ],
    },
  },
  "observability-setup": {
    id: "observability-setup",
    number: "4.4",
    name: "Observability & Telemetry Setup",
    phase: "operation",
    description: "Configure distributed tracing, Prometheus metrics, CloudWatch alarms, and Datadog dashboards.",
    persona: "aidlc-observability-agent",
    defaultArtifactName: "observability-setup.md",
    rubric: {
      stageId: "observability-setup",
      stageName: "Observability & Telemetry Setup",
      persona: "aidlc-observability-agent",
      dimensions: [
        {
          id: "telemetry_and_alarms",
          title: "SLOs, Dashboards, and Alarms",
          description: "Defines P99 latency alerts, error rate thresholds, and dashboard links.",
          probingQuestions: ["What latency, CPU, and error rate thresholds trigger on-call pages?"],
          heuristicKeywords: ["observability", "metrics", "alarms", "dashboards", "telemetry", "tracing"],
        },
      ],
    },
  },
  "incident-response": {
    id: "incident-response",
    number: "4.5",
    name: "Incident Response & Runbooks",
    phase: "operation",
    description: "Author emergency runbooks, rollback procedures, and on-call escalation policies.",
    persona: "aidlc-observability-agent",
    defaultArtifactName: "incident-runbook.md",
    rubric: {
      stageId: "incident-response",
      stageName: "Incident Response & Runbooks",
      persona: "aidlc-observability-agent",
      dimensions: [
        {
          id: "rollback_procedures",
          title: "Emergency Rollback & Triage Runbook",
          description: "Step-by-step procedures to revert deployments and isolate compromised systems.",
          probingQuestions: ["How does an on-call engineer roll back changes in under 5 minutes?"],
          heuristicKeywords: ["runbook", "rollback", "incident", "escalation", "emergency"],
        },
      ],
    },
  },
  "performance-validation": {
    id: "performance-validation",
    number: "4.6",
    name: "Performance & Load Validation",
    phase: "operation",
    description: "Execute stress tests, soak tests, and load profiling under simulated production spikes.",
    persona: "aidlc-quality-agent",
    defaultArtifactName: "performance-report.md",
    rubric: {
      stageId: "performance-validation",
      stageName: "Performance & Load Validation",
      persona: "aidlc-quality-agent",
      dimensions: [
        {
          id: "load_benchmarks",
          title: "Stress Testing & Concurrency Limits",
          description: "Empirical proof of system stability under high throughput.",
          probingQuestions: ["Did the system sustain required RPS without memory leaks or connection pool exhaustion?"],
          heuristicKeywords: ["load test", "rps", "stress test", "concurrency", "performance", "throughput"],
        },
      ],
    },
  },
  "feedback-reflection": {
    id: "feedback-reflection",
    number: "4.7",
    name: "Feedback & Post-Mortem Reflection",
    phase: "operation",
    description: "Capture architectural learnings, tech debt items, and continuous improvement rituals.",
    persona: "aidlc-coach-agent",
    defaultArtifactName: "post-mortem-reflection.md",
    rubric: {
      stageId: "feedback-reflection",
      stageName: "Feedback & Post-Mortem Reflection",
      persona: "aidlc-coach-agent",
      dimensions: [
        {
          id: "reflection_and_learning",
          title: "Architectural Retrospective & Learnings",
          description: "Documents technical debt created, unexpected obstacles, and lessons learned.",
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

    if (content.trim().length < 60) {
      satisfied = false;
      notes = `Draft content is too brief (< 60 characters) to satisfy dimension '${dim.title}'.`;
    } else {
      const keywords = dim.heuristicKeywords || [];
      const matchCount = keywords.filter((kw) => lowerContent.includes(kw.toLowerCase())).length;
      const titleMentioned =
        lowerContent.includes(dim.title.toLowerCase()) || lowerContent.includes(dim.id.replace(/_/g, " "));

      if (titleMentioned || matchCount >= 2 || (keywords.length <= 2 && matchCount >= 1)) {
        satisfied = true;
        notes = `Dimension addressed (matched key signals: ${keywords.filter((kw) => lowerContent.includes(kw.toLowerCase())).join(", ")}).`;
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
