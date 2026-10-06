/**
 * Official AI-DLC Scope Specifications generated from awslabs/aidlc-workflows/core/scopes/
 * Total scopes: 11
 */

import { ScopeType, DepthLevel, TestStrategy } from "../types.js";

export interface ScopeSpec {
  name: ScopeType;
  depth: DepthLevel;
  testStrategy: TestStrategy;
  keywords: string[];
  description: string;
  skeleton: "on" | "off";
  existingCode?: boolean;
  runner?: boolean;
  reviewCap?: "none" | "advisory" | "strict";
  guardPolicy: "off" | "strict" | "relaxed";
  sensors: "on" | "off";
  learnings: "on" | "off";
  summaryConfirmation: "on" | "off";
  planApproval: "on" | "off";
  collaborators: "on" | "off";
  markdown: string;
}

export const SCOPE_SPECS: Record<ScopeType, ScopeSpec> = {
  "infra": {
    "name": "infra",
    "depth": "standard",
    "testStrategy": "standard",
    "keywords": [
      "infrastructure",
      "deploy",
      "infra"
    ],
    "description": "Infrastructure changes",
    "skeleton": "on",
    "existingCode": false,
    "runner": false,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "on",
    "planApproval": "on",
    "collaborators": "off",
    "markdown": "---\nname: infra\ndepth: Standard\nkeywords:\n  - infrastructure\n  - deploy\n  - infra\ndescription: Infrastructure changes\nskeleton: on\nguard_policy: off\nsensors: on\nlearnings: on\nsummary_confirmation: on\nplan_approval: on\ncollaborators: off\n---\n\n# infra scope\n\nStandard depth for infrastructure changes. It is the one scope whose path\nleans on the back half of the graph: it skips ideation and the\napplication-code construction stages, and instead runs practices-discovery,\nthe NFR design pass, infrastructure-design, the CI pipeline, and the full\ndeployment + observability set in operation.\n\nGuard Policy defaults to off: provisioning and deployment inputs that move after approval are recorded and announced rather than reopening approval; plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\n## Why these stages, why skip those\n\nInfrastructure work is not about product features, so ideation,\nuser-stories, domain-design, units-generation, and code-generation\nare skipped. It is about how the system is provisioned and run, so the\noperation stages (deployment-pipeline, environment-provisioning,\ndeployment-execution, observability-setup) plus the NFR and\ninfrastructure design that feed them are EXECUTE. This is the only scope\nwhere `reverse-engineering` is SKIP — infra changes start from the\ndeployment topology, not the application source — and the only non-\nenterprise/feature scope that runs the operation phase.\n\n## Membership\n\nKeyword triggers: `infrastructure`, `deploy`, `infra`. Initialization,\npractices-discovery, requirements-analysis, the NFR + infrastructure\ndesign stages, ci-pipeline, and the deployment/provisioning/observability\noperation stages execute.\n"
  },
  "express": {
    "name": "express",
    "depth": "minimal",
    "testStrategy": "minimal",
    "keywords": [
      "express",
      "lightweight"
    ],
    "description": "Lightest run: requirements to deploy, no design pass, no reviewers",
    "skeleton": "off",
    "existingCode": false,
    "runner": true,
    "reviewCap": "none",
    "guardPolicy": "off",
    "sensors": "off",
    "learnings": "off",
    "summaryConfirmation": "off",
    "planApproval": "off",
    "collaborators": "off",
    "markdown": "---\nname: express\ndepth: Minimal\nkeywords:\n  - express\n  - lightweight\ndescription: \"Lightest run: requirements to deploy, no design pass, no reviewers\"\nskeleton: off\nrunner: true\nreview_cap: none\nguard_policy: off\nsensors: off\nlearnings: off\nsummary_confirmation: off\nplan_approval: off\ncollaborators: off\n---\n\n# express scope\n\n`express` answers the community request for a lightweight run. It follows a\nstraight line from requirements to code, test, and deploy without a design\npass or reviewer dispatch.\n\nGuard Policy defaults to off: changed inputs are recorded and announced rather than reopening approval; plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\nSensors, learnings, and summary confirmation are off too; override them per intent\nwith `/aidlc --sensors on|off`, `/aidlc --learnings on|off`, or\n`/aidlc --summary-confirmation on|off`.\n\nPlan approval is off as well: once the code plan is written you see one line\nnaming it and code generation starts. Say \"review the plan first\" to look at a\nplan before it is built, or type `/aidlc --plan-approval on` to be asked about\nevery plan.\n\n## Why these stages, why skip those\n\nRequirements Analysis establishes the contract, Code Generation implements\nit, Build and Test verifies it, and the Operation tail can deploy and observe\nthe result. Reviewers are disabled by `review_cap: none`. Minimal testing still\nrequires requirement-driven unit tests with a happy-path floor per component.\n\nThe swarm path is structurally unreachable because `express` skips Units\nGeneration, so no Unit DAG can exist. Reverse Engineering remains CONDITIONAL\nto provide brownfield understanding when existing code is present. The deploy\ntail is also CONDITIONAL and self-skips when there is nothing to deploy. Its\nstages use the approved requirements, workspace deployment configuration, build\nresults, and prior tail artifacts when full design producers are intentionally\nabsent.\n\n## Membership\n\nThe grid contains the three Initialization stages, Reverse Engineering,\nRequirements Analysis, Code Generation, Build and Test, Deployment Pipeline,\nDeployment Execution, and Observability Setup. Every other stage is SKIP.\n"
  },
  "bugfix": {
    "name": "bugfix",
    "depth": "minimal",
    "testStrategy": "minimal",
    "keywords": [
      "fix",
      "bug",
      "broken",
      "bugfix"
    ],
    "description": "Fix a specific bug",
    "skeleton": "off",
    "existingCode": true,
    "runner": true,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "off",
    "summaryConfirmation": "off",
    "planApproval": "on",
    "collaborators": "off",
    "markdown": "---\nname: bugfix\ndepth: Minimal\nkeywords:\n  - fix\n  - bug\n  - broken\n  - bugfix\ndescription: Fix a specific bug\nskeleton: off\nexisting_code: true\nrunner: true\nreview_cap: advisory\nguard_policy: off\nsensors: on\nlearnings: off\nsummary_confirmation: off\nplan_approval: on\ncollaborators: off\n---\n\n# bugfix scope\n\nMinimal depth for fixing one specific bug in an existing codebase. It\nskips ideation entirely (there is no new product to discover), runs\nreverse-engineering to understand the current code, pulls requirements for\nthe fix, then generates, tests, and deploys it.\n\nGuard Policy defaults to off: changed inputs are recorded and announced rather than reopening approval; plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\nLearnings and summary confirmation are off: no \"Anything to add for next\ntime?\" question after each stage, and no summary to confirm before an artifact\nis written. Sensors, every stage approval, and plan approval stay on. Turn\neither back on per intent with `/aidlc --learnings on` or\n`/aidlc --summary-confirmation on`. Collaborators are off, so each stage runs\nwith its lead agent only; `/aidlc --collaborators on` brings the support\nagents in.\n\n## Why these stages, why skip those\n\nA bug fix is incremental work on a known system. It needs to understand\nwhat exists (reverse-engineering), state what \"fixed\" means\n(requirements-analysis), and change-plus-verify (code-generation,\nbuild-and-test). It does not need market-research, user-stories,\ndomain-design, environment provisioning, or broader operational readiness,\nbut it retains deployment-pipeline and deployment-execution so the verified\nfix can ship. This scope is one of the three incremental scopes that skip the\nwalking-skeleton ceremony (alongside `refactor` and `security-patch`), since\nthere is nothing to bootstrap.\n\n## Membership\n\nKeyword triggers: `fix`, `bug`, `broken`, `bugfix` (word-boundary matched, so\n\"debug\" and \"fixture\" do not trigger it). Initialization,\nreverse-engineering, requirements-analysis, code-generation, build-and-test,\ndeployment-pipeline, and deployment-execution execute; the rest is SKIP.\n"
  },
  "classic": {
    "name": "classic",
    "depth": "standard",
    "testStrategy": "standard",
    "keywords": [],
    "description": "V1-style ceremony through Inception and Construction - the implicit default",
    "skeleton": "off",
    "existingCode": false,
    "runner": false,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "off",
    "planApproval": "on",
    "collaborators": "off",
    "markdown": "---\nname: classic\ndepth: Standard\nkeywords: []\ndescription: \"V1-style ceremony through Inception and Construction - the implicit default\"\nskeleton: off\nreview_cap: advisory\nguard_policy: off\nsensors: on\nlearnings: on\nsummary_confirmation: off\nplan_approval: on\ncollaborators: off\n---\n\n# classic scope\n\n`classic` is the implicit default scope - used when neither the user nor\n`AWS_AIDLC_DEFAULT_SCOPE` names one - and restores v1-style ceremony through\nInception and Construction, with one human approval per stage. Ideation is\nskipped and Operation remains a placeholder. Stage-declared execution modes\nare unchanged; collaborators are off, so each stage runs with its lead agent\nonly (`/aidlc --collaborators on` brings the support agents in).\n\nGuard Policy defaults to off: changed inputs are recorded and announced in one line, and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\nReviews are advisory: one pass per stage whose findings reach the human at\nthe approval gate, with no refute-and-repair loop; explicit autonomy keeps the\nsingle pre-merge review. Walking-skeleton ceremony and summary confirmation\nare off. Sensors run and the learnings ritual runs. Under off, Plan Approval,\nreview freeze, state transition, and reviewer read scope stand aside for\nundirected work and record a `GUARD_STOOD_ASIDE` row each time; the approval\nquestion is still asked by the conductor. Human-turn authority and audit remain\nin force.\n\nOverride ceremonies per intent with `/aidlc --sensors on|off`,\n`/aidlc --learnings on|off`, `/aidlc --summary-confirmation on|off`, and\n`/aidlc --collaborators on|off`. The global kill switches\n`AIDLC_DISABLE_SENSORS=1`, `AIDLC_DISABLE_LEARNINGS=1`,\n`AIDLC_DISABLE_SUMMARY_CONFIRMATION=1`, and `AIDLC_DISABLE_COLLABORATORS=1`\nforce their ceremony off even when the intent says on; they can also be\nrecorded with `aidlc config flags --bypass <NAME>`.\n\n## Why these stages, why skip those\n\nAI-DLC v1 had no Ideation phase, so `classic` skips all seven Ideation stages.\nIt keeps all Inception stages and the Construction stages through Build and\nTest. CI Pipeline and all seven Operation stages are skipped: customers bring\ntheir own CI and downstream, and Build and Test is the one integrated build\nacross every unit. Only eight stages are unconditional: the three Initialization stages,\nRequirements Analysis, Units Generation, Delivery Planning, Code Generation,\nand Build and Test. The remaining Inception and Construction work is\nCONDITIONAL and self-selects from project context, preserving v1's adaptive behavior.\n\nIts test strategy inherits Standard from its depth, so production testing\nexpectations remain in force. The separate `workshop` scope retains the\nteaching-oriented Minimal test override for existing workshop workflows.\n\n## Membership\n\nInitialization, every Inception stage, and the Construction stages through\nBuild and Test are in the grid: 18 of 33 stages. All seven Ideation stages,\nCI Pipeline, and all seven Operation stages are SKIP. The scope intentionally has no keywords; name it explicitly\nor use the implicit default.\n"
  },
  "feature": {
    "name": "feature",
    "depth": "standard",
    "testStrategy": "standard",
    "keywords": [],
    "description": "Full lifecycle for new features, practical depth",
    "skeleton": "on",
    "existingCode": false,
    "runner": true,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "on",
    "planApproval": "on",
    "collaborators": "off",
    "markdown": "---\nname: feature\ndepth: Standard\nkeywords: []\ndescription: Full lifecycle for new features, practical depth\nskeleton: on\nrunner: true\nguard_policy: off\nsensors: on\nlearnings: on\nsummary_confirmation: on\nplan_approval: on\ncollaborators: off\n---\n\n# feature scope\n\nThe full-lifecycle scope for new feature work at practical depth. Like\n`enterprise`, it runs every stage in the graph, but the stage bodies apply\nStandard rather than Comprehensive depth — lighter ceremony, the same\nend-to-end coverage from ideation through operation.\n\nGuard Policy defaults to off: changed inputs are recorded and announced, the run continues, and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\n## Why every stage\n\nA new feature still needs the full arc: understand the problem\n(ideation), design it (inception), build and test it (construction), and\noperate it (operation). `feature` keeps all of those so nothing silently\ndrops. The difference from `enterprise` is depth, expressed in the stage\nbodies and the org/team rule layers, not in which stages run.\n\n## Membership\n\n`feature` marks all 33 stages EXECUTE. It remains the implicit freeform fallback\nand is also available through `--scope feature` and the `/aidlc-feature` runner.\nThere are no keyword triggers of its own.\n"
  },
  "refactor": {
    "name": "refactor",
    "depth": "minimal",
    "testStrategy": "minimal",
    "keywords": [
      "refactor",
      "clean up",
      "simplify"
    ],
    "description": "Clean up existing code",
    "skeleton": "off",
    "existingCode": true,
    "runner": false,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "on",
    "planApproval": "on",
    "collaborators": "off",
    "markdown": "---\nname: refactor\ndepth: Minimal\nkeywords:\n  - refactor\n  - clean up\n  - simplify\ndescription: Clean up existing code\nskeleton: off\nexisting_code: true\nguard_policy: off\nsensors: on\nlearnings: on\nsummary_confirmation: on\nplan_approval: on\ncollaborators: off\n---\n\n# refactor scope\n\nMinimal depth for cleaning up existing code without changing behaviour.\nLike `bugfix` it skips ideation and most operations, but it adds back\nfunctional-design — a refactor reshapes structure, so the design of the\nbehaviour being preserved matters — and retains the deployment stages needed\nto ship the verified change.\n\nGuard Policy defaults to off: changed inputs are recorded and announced rather than reopening approval; plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\n## Why these stages, why skip those\n\nRefactoring is structure-preserving change on a known codebase. It runs\nreverse-engineering (understand what exists), requirements-analysis\n(pin down the behaviour to preserve), functional-design (the target\nshape), then code-generation and build-and-test (apply and verify the\nexisting suite stays green). It skips discovery, environment provisioning,\nand broader operational readiness because there is no new product or\ninfrastructure surface, while deployment-pipeline and deployment-execution\ncarry the verified refactor through the existing delivery path. One of the\nthree incremental scopes that skip the walking-skeleton ceremony.\n\n## Membership\n\nKeyword triggers: `refactor`, `clean up`, `simplify`. Initialization,\nreverse-engineering, requirements-analysis, functional-design,\ncode-generation, build-and-test, deployment-pipeline, and\ndeployment-execution execute; the rest is SKIP.\n"
  },
  "mvp": {
    "name": "mvp",
    "depth": "standard",
    "testStrategy": "standard",
    "keywords": [
      "mvp",
      "minimum viable"
    ],
    "description": "Skip operations, ship the core",
    "skeleton": "on",
    "existingCode": false,
    "runner": true,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "on",
    "planApproval": "on",
    "collaborators": "off",
    "markdown": "---\nname: mvp\ndepth: Standard\nkeywords:\n  - mvp\n  - minimum viable\ndescription: Skip operations, ship the core\nskeleton: on\nrunner: true\nguard_policy: off\nsensors: on\nlearnings: on\nsummary_confirmation: on\nplan_approval: on\ncollaborators: off\n---\n\n# mvp scope\n\nStandard depth, but trims the front and back of the workflow to ship the\ncore fast. Ideation runs a reduced ceremony (no market-research, no\nteam-formation, no approval-handoff) and the entire operation phase is\nskipped — an MVP proves the product, it does not yet carry production\noperations weight.\n\nGuard Policy defaults to off: changed inputs are recorded and announced, the run continues, and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\n## Why these stages, why skip those\n\nThe full inception and construction passes stay EXECUTE: an MVP is still\nreal software that needs design, code, and tests. What it skips is the\ndiscovery overhead that only pays off at scale (market-research,\nteam-formation) and the operation stages (deployment-pipeline,\nenvironment-provisioning, deployment-execution, observability-setup,\nincident-response, performance-validation, feedback-optimization), which\nbelong to a product past its first proof. Promote to `feature` or\n`enterprise` when the MVP graduates.\n\n## Membership\n\nKeyword triggers: `mvp`, `minimum viable`. Initialization, the reduced\nideation set, all of inception, and the build path of construction run;\noperation is skipped wholesale.\n"
  },
  "poc": {
    "name": "poc",
    "depth": "minimal",
    "testStrategy": "minimal",
    "keywords": [
      "proof of concept",
      "prototype",
      "poc",
      "spike"
    ],
    "description": "Prove feasibility fast",
    "skeleton": "on",
    "existingCode": false,
    "runner": false,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "on",
    "planApproval": "off",
    "collaborators": "off",
    "markdown": "---\nname: poc\ndepth: Minimal\nkeywords:\n  - proof of concept\n  - prototype\n  - poc\n  - spike\ndescription: Prove feasibility fast\nskeleton: on\nreview_cap: advisory\nguard_policy: off\nsensors: on\nlearnings: on\nsummary_confirmation: on\nplan_approval: off\ncollaborators: off\n---\n\n# poc scope\n\nMinimal depth aimed at proving feasibility fast. Almost everything except\nthe bare path to running code is skipped: capture the intent, reverse-\nengineer any existing code, pull the requirements, then generate and test.\nNo design ceremony, no operations, no delivery planning.\n\nGuard Policy defaults to off: changed inputs are recorded and announced, the spike keeps moving, and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\nPlan approval is off: once the code plan is written you see one line naming it\nand code generation starts. Say \"review the plan first\" to look at a plan before\nit is built, or type `/aidlc --plan-approval on` to be asked about every plan.\n\n## Why these stages, why skip those\n\nA proof of concept answers one question — \"can this work?\" — so it keeps\nonly the stages that get to an answer: intent-capture, reverse-engineering,\nrequirements-analysis, code-generation, build-and-test. The whole point is\nto discard the rest (domain-design, units-generation, nfr work, the\noperation phase) because a spike is throwaway. If the answer is yes,\nre-scope to `feature`/`mvp` and run the full arc on the real build.\n\n## Membership\n\nKeyword triggers: `proof of concept`, `prototype`, `poc`, `spike`.\nInitialization plus the thin feasibility path execute; everything else is\nSKIP.\n"
  },
  "security-patch": {
    "name": "security-patch",
    "depth": "minimal",
    "testStrategy": "minimal",
    "keywords": [
      "security",
      "CVE",
      "vulnerability",
      "patch"
    ],
    "description": "CVE response",
    "skeleton": "off",
    "existingCode": true,
    "runner": true,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "on",
    "planApproval": "on",
    "collaborators": "off",
    "markdown": "---\nname: security-patch\ndepth: Minimal\nkeywords:\n  - security\n  - CVE\n  - vulnerability\n  - patch\ndescription: CVE response\nskeleton: off\nexisting_code: true\nrunner: true\nguard_policy: off\nsensors: on\nlearnings: on\nsummary_confirmation: on\nplan_approval: on\ncollaborators: off\n---\n\n# security-patch scope\n\nMinimal depth for responding to a CVE or vulnerability fast. It threads a\nnarrow path: understand the code (reverse-engineering), state what the\npatch must do (requirements-analysis), capture the security constraint\n(nfr-requirements), fix and test (code-generation, build-and-test), then\nship through the deployment stages so the patch actually reaches\nproduction.\n\nGuard Policy defaults to off: a patch whose inputs move after approval is recorded and announced rather than approved again; plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work. Human presence stays up.\n\n## Why these stages, why skip those\n\nA security patch is urgent, incremental, and must deploy. It skips the\nwhole design ceremony (ideation, domain-design, units-generation,\nnfr-design, infrastructure-design) because the change is targeted. Like the\nother incremental scopes it keeps deployment-pipeline and\ndeployment-execution EXECUTE — a patch that never deploys does not close the\nvulnerability. Its distinctive stage is nfr-requirements, which records the\nsecurity constraint; requirements-analysis also runs so there is an auditable\nstatement of the vulnerability and its remediation criteria (the\n`requirements` artifact nfr-requirements and code-generation consume). One of\nthe three incremental scopes that skip the walking-skeleton ceremony.\n\n## Membership\n\nKeyword triggers: `security`, `CVE`, `vulnerability`, `patch`.\nInitialization, reverse-engineering, requirements-analysis,\nnfr-requirements, code-generation, build-and-test, deployment-pipeline,\nand deployment-execution execute; the rest is SKIP.\n"
  },
  "workshop": {
    "name": "workshop",
    "depth": "standard",
    "testStrategy": "minimal",
    "keywords": [
      "workshop",
      "lab",
      "training"
    ],
    "description": "Facilitated group session with mandatory gates",
    "skeleton": "on",
    "existingCode": false,
    "runner": false,
    "reviewCap": "advisory",
    "guardPolicy": "off",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "on",
    "planApproval": "on",
    "collaborators": "off",
    "markdown": "---\nname: workshop\ndepth: Standard\ntestStrategy: Minimal\nkeywords:\n  - workshop\n  - lab\n  - training\ndescription: Facilitated group session with mandatory gates\nskeleton: on\nreview_cap: advisory\nguard_policy: off\nsensors: on\nlearnings: on\nsummary_confirmation: on\nplan_approval: on\ncollaborators: off\n---\n\n# workshop scope\n\nStandard depth for a facilitated group session with mandatory gates, but\nwith a Minimal test strategy - the `testStrategy` override that keeps the\ntest floor light for a teaching context. It runs the inception,\nconstruction, and operation arc end to end (so participants see the whole\nlifecycle) while skipping the ideation discovery stages that a facilitator\nfront-loads by hand.\n\nGuard Policy defaults to off: moved inputs are reported once and plan approval, review freeze, state transition, and reviewer read scope are lowered for undirected work; human presence stays up, and a facilitator who wants approvals reopened and every fence up sets strict.\n\n## Why these stages, why skip those\n\nA workshop walks a group through the methodology, so it keeps the\nsubstantive build and operate stages visible: reverse-engineering,\npractices-discovery, the full inception design pass, construction, and the\noperation phase all run. It skips the early ideation ceremony\n(market-research, feasibility, scope-definition, team-formation,\nrough-mockups, approval-handoff) because the facilitator scopes the\nexercise up front rather than running those stages live. The\n`testStrategy: Minimal` override means tests are demonstrated, not held to\nthe production floor.\n\n## Membership\n\nKeyword triggers: `workshop`, `lab`, `training`. Initialization, the\ninception set, all of construction, and all of operation execute; the\nideation discovery stages are SKIP.\n"
  },
  "enterprise": {
    "name": "enterprise",
    "depth": "comprehensive",
    "testStrategy": "comprehensive",
    "keywords": [],
    "description": "Regulated enterprise feature, full audit trail",
    "skeleton": "on",
    "existingCode": false,
    "runner": false,
    "reviewCap": "strict",
    "guardPolicy": "strict",
    "sensors": "on",
    "learnings": "on",
    "summaryConfirmation": "on",
    "planApproval": "on",
    "collaborators": "on",
    "markdown": "---\nname: enterprise\ndepth: Comprehensive\nkeywords: []\ndescription: Regulated enterprise feature, full audit trail\nskeleton: on\nguard_policy: strict\nsensors: on\nlearnings: on\nsummary_confirmation: on\nplan_approval: on\ncollaborators: on\n---\n\n# enterprise scope\n\nComprehensive depth for regulated work that needs the full audit trail.\nEvery stage in the graph executes — no shortcuts. Ideation, inception,\nconstruction, and operation all run end to end, so the artifact chain\n(intent through deployment and feedback) is complete and traceable.\n\nGuard Policy defaults to strict: changed inputs reopen approval and no fences are lowered, because the audit trail is the point of this scope.\n\n## Why every stage\n\nEnterprise work carries compliance, security-review, and sign-off\nobligations that the skipped-stage scopes (`mvp`, `poc`, `bugfix`) are\nwilling to trade away for speed. Here the cost of an undocumented decision\nis higher than the cost of running the stage, so the scope keeps the whole\nspine: market-research and team-formation up front, the full design pass,\nand the operation stages (observability, incident-response,\nperformance-validation) on the back end.\n\n## Membership\n\n`enterprise` is the only scope that marks every one of the 33 stages\nEXECUTE. It is the reference column for the EXECUTE/SKIP grid — every other\nscope is a subset of this one. There are no keyword triggers; the scope is\nchosen deliberately, not inferred from a description.\n"
  }
};

export function getScopeSpec(scopeName: string): ScopeSpec | undefined {
  return SCOPE_SPECS[scopeName as ScopeType];
}

export function getAllScopeSpecs(): ScopeSpec[] {
  return Object.values(SCOPE_SPECS);
}

/**
 * Detects an appropriate scope from human prompt text based on official keyword triggers.
 */
export function detectScopeFromPrompt(text: string): ScopeType | undefined {
  if (!text) return undefined;

  // Order scopes to prioritize specific multi-word matches first (e.g. security-patch, poc, refactor, bugfix)
  const priorityOrder: ScopeType[] = [
    "security-patch",
    "poc",
    "bugfix",
    "refactor",
    "infra",
    "workshop",
    "express",
    "mvp",
    "enterprise",
    "feature",
    "classic",
  ];

  for (const scopeName of priorityOrder) {
    const spec = SCOPE_SPECS[scopeName];
    if (!spec || !spec.keywords || spec.keywords.length === 0) continue;

    for (const kw of spec.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp("\\b" + escaped + "\\b", "i");
      if (regex.test(text)) {
        return scopeName;
      }
    }
  }

  return undefined;
}
