# AI-DLC Socratic MCP Server

A comprehensive [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server implementing the complete **AI-Driven Life Cycle (AI-DLC)** methodology (matching [AWS AI-DLC](https://github.com/awslabs/aidlc-workflows)) with an embedded **Socratic Elicitation & Review Engine**.

It equips AI coding assistants (Claude Code, Cursor, Codex CLI, Antigravity, Kiro) with structured lifecycle steering, 11 workflow scopes, 33 lifecycle stages, 11 domain personas, a two-tier knowledge base, and explicit approval gates (*"You decide, AI executes"*).

---

## 🌟 Comprehensive Features

1. **Complete 33-Stage Lifecycle Grid**:
   - **Phase 0: Initialization**: Scaffolding, greenfield/brownfield detection, state initialization.
   - **Phase 1: Ideation**: Intent framing, market research, feasibility, scoping, mockups, handoff.
   - **Phase 2: Inception**: Reverse engineering, practices discovery, requirements analysis, user stories, domain architecture, units of work DAG, contracts, delivery planning.
   - **Phase 3: Construction**: Functional design, NFR security specs, resilience architecture, IaC design, clean code generation, build & automated tests, CI pipeline.
   - **Phase 4: Operation / Verification**: CD pipeline, environment provisioning, deployment execution, observability & alarms, incident runbooks, load testing, architectural reflection.

2. **The 11 Core Scopes & Routing Matrix**:
   | Scope | Stages | Default Depth | Default Test Strategy | Description |
   |---|---|---|---|---|
   | `enterprise` | 30 | Comprehensive | Comprehensive | Regulated enterprise feature with full audit trail |
   | `feature` | 30 | Standard | Standard | Full lifecycle for new features |
   | `mvp` | 20 | Standard | Standard | Greenfield prototype, skipping late operations |
   | `poc` | 5 | Minimal | Minimal | Prove feasibility fast |
   | `bugfix` | 6 | Minimal | Minimal | Surgical fix, verification, and deploy |
   | `refactor` | 7 | Minimal | Minimal | Restructure existing code with verified deploy |
   | `infra` | 10 | Standard | Standard | IaC, provisioning, security, and telemetry |
   | `security-patch`| 7 | Minimal | Minimal | Rapid CVE response |
   | `classic` | 15 | Standard | Standard | V1 Inception + Construction with advisory reviews |
   | `workshop` | 23 | Standard | Minimal | Facilitated training lifecycle |
   | `express` | 7 | Minimal | Minimal | Streamlined requirements to deployment |

3. **Two-Tier Knowledge Base (`aidlc/spaces/default/knowledge/`)**:
   - **Tier 1 (Methodology)**: Preloaded rubrics and persona protocols.
   - **Tier 2 (Team Knowledge)**: Curated team coding standards, architecture principles, and intent documents (PRDs, vision briefs).

4. **Embedded Socratic Rubric Engine**:
   - Probes non-goals, architectural trade-offs, failure blast radiuses, concurrency limits, and security trust boundaries.
   - Requires rubric satisfaction before allowing gate approvals.

5. **Diagnostic Doctor (`dlc_doctor`)**:
   - Health check verifying Node.js runtime, Git repository, filesystem write permissions, active space, and intent state.

6. **Three-Tier Layered Memory Subsystem (`aidlc/spaces/default/memory/`)**:
   - **Hierarchy**: `org.md` (org trunk-based development & testing defaults) -> `team.md` (affirmed team practices from Stage 2.9 `practices-discovery`) -> `project.md` (repo-local constraints).
   - **Phase Guardrails**: `phases/{ideation,inception,construction,operation}.md` loaded dynamically based on active intent phase.
   - **Self-Learning Diary**: `learnings.md` records runtime human corrections and architectural discoveries with exact citations (`- [memory:M<n>] aidlc/spaces/<space>/memory/<layer>.md#<heading>`).

7. **Deterministic Verification Sensors (`core/sensors/`)**:
   - **`claim-sources`**: Verifies Intent Capture deliverables carry valid inline provenance citations (`[desc]`, `[scope]`, `[Q<n>]`, `[memory:...]`, `[assumption]`).
   - **`required-sections`**: Enforces H2 heading count floors, validates template overrides, and inspects Unit of Work DAG YAML blocks for cycle-free topological sort.
   - **`traceability`**: Validates `traceability.json` matrix and ensures zero unaddressed gaps or orphans.
   - **`upstream-coverage`**: Checks that stage deliverables cite all declared consumed artifacts.
   - **`type-check` & `linter`**: Runs automated compiler type-checking and lint rule enforcement on generated code.

---

## 🚀 Quick Start

### Option A: Direct from GitHub URL (No Cloning Required!)

You can run this MCP server directly from GitHub without cloning or manual building:

#### 1. Claude Code CLI
```bash
claude mcp add aidlc -- npx -y github:doitintl/aidlc-mcp
```

#### 2. Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "aidlc": {
      "command": "npx",
      "args": ["-y", "github:doitintl/aidlc-mcp"]
    }
  }
}
```

#### 3. Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "aidlc": {
      "command": "npx",
      "args": ["-y", "github:doitintl/aidlc-mcp"]
    }
  }
}
```

---

### Option B: Local Clone & Build

```bash
git clone git@github.com:doitintl/aidlc-mcp.git
cd aidlc-mcp
npm install
npm run build
```
Then point your MCP client to `node /path/to/aidlc-mcp/dist/index.js`.

---

## 💡 How to Use This MCP

AI-DLC follows the core rule: **"You decide, AI executes."** The assistant acts as a multidisciplinary software engineering team guided by personas and Socratic rubrics, but you remain in the driver's seat at every approval gate.

### The 6-Step Workflow Lifecycle

```
[1. Kickoff & Scope Detection] ──► [2. Socratic Elicitation] ──► [3. Sensor & Review Verification]
                                                                                │
[6. Handover (OUTCOMES.md)]   ◄── [5. Construction & Tests]   ◄── [4. Human Gate Approval]
```

1. **Diagnostics & Kickoff (`dlc_doctor`, `dlc_init_intent`)**:
   - Run diagnostics to confirm Git, Node.js, and permissions.
   - Describe what you want to build. AI-DLC detects one of the 11 adaptive scopes (`feature`, `mvp`, `bugfix`, `infra`, `express`, etc.) or you specify one explicitly.
   - Creates the workflow record under `aidlc/spaces/default/intents/<intent>/` and tracks live progress in `aidlc-state.md`.

2. **Socratic Elicitation & Drafting (`dlc_check_rubric`, `dlc_submit_draft`)**:
   - In each stage, the assistant assumes a specialized domain persona (Product Strategist, Systems Architect, DevSecOps Specialist, etc.).
   - The assistant asks probing questions about non-goals, failure modes, scalability limits, and security trust boundaries.
   - Deliverables are tested against Socratic rubrics before saving.

3. **Deterministic Verification & Review (`dlc_run_sensors`, `dlc_request_review`)**:
   - Before human review, deterministic sensors enforce citation provenance (`claim-sources`), required headings (`required-sections`), DAG validity, and upstream coverage.
   - An independent reviewer pass (§12a) checks completeness and compliance with team standards.

4. **Human Gate Approval (`dlc_approve_gate`)**:
   - The assistant encounters a **HARD STOP** at each gate.
   - You inspect the deliverable and either approve it to advance to the next stage, or request changes.
   - If previous work needs updating, `dlc_reopen_stage` reopens prior checkpoints without losing files.

5. **Construction Phase & Code Generation**:
   - The Tech Lead decomposes deliverables into a cycle-free DAG of **Units of Work (UoW)**.
   - **Plan Approval Guard**: Implementation code generation (`code-generation`) is hard-locked until you approve the implementation plan.
   - The agent implements units sequentially, running compilers, linters, and unit tests.

6. **Closeout, Replay & Handover (`dlc_session_cost`, `dlc_session_replay`, `dlc_outcomes_pack`)**:
   - Inspect deterministic execution duration, stage outcomes, and sensor counts.
   - Generate a narrative timeline replay for asynchronous stakeholder review.
   - Produce a production-ready `OUTCOMES.md` handover document at the workspace root.

---

## 💬 Sample Prompts

Copy and paste these prompts directly into your AI coding assistant (Claude Code, Cursor, Claude Desktop, Antigravity) to trigger structured AI-DLC workflows.

### 1. Workflow Kickoff & Scope Auto-Detection
> *"Let's start an AI-DLC workflow for our project. First run `dlc_doctor` to verify the workspace health. Then initialize an intent to build a resilient payment webhook ingestion service with idempotency keys and signature validation. Select the appropriate workflow scope."*

> *(For a rapid bugfix)*:
> *"We have an urgent bug: 'Stripe webhook replay attacks bypassing signature timestamps'. Initialize a surgical AI-DLC bugfix intent and begin Stage 1.1 Intent Capture."*

> *(For a prototype spike)*:
> *"I want to quickly test feasibility for vector search with pgvector on PostgreSQL. Initialize an AI-DLC workflow with the `poc` scope so we can evaluate this with minimal ceremony."*

---

### 2. Socratic Stage Inquiry & Rubric Probing
> *"Adopt the Principal Systems Architect persona (`persona_architect_agent`) for Stage 2.5 (Domain Design). Before generating any diagrams, conduct a Socratic inquiry: probe me on our consistency model, failure blast radius, partition key trade-offs, and trust boundaries. Test our draft with `dlc_check_rubric` before submitting."*

---

### 3. Practices Discovery & Memory Layering
> *"Scan our repository and discover our coding conventions. Inspect our testing frameworks, linters, and TypeScript settings. Record these affirmed standards into `team.md` using `dlc_memory_update` under the appropriate headings."*

> *"Record a new learning from this session: 'We prefer distributed tracing via OpenTelemetry over custom middleware logging'. Log this with `dlc_memory_record_learning`."*

---

### 4. Deterministic Sensors Verification
> *"Run the deterministic verification sensors on our current stage artifact with `dlc_run_sensors`. Check that all claims carry provenance citations (`[desc]`, `[scope]`, `[memory:...]`), all required template sections exist, and that upstream deliverables from Stage 2.3 are fully covered."*

---

### 5. Independent Reviewer Pass
> *"Before we proceed to human sign-off, dispatch an independent reviewer pass using `dlc_request_review`. Evaluate our domain architecture artifact against security, observability, and testability. Output a structured verdict with any blocking issues or advisory notes."*

---

### 6. Human Gate Approval
> *"I have reviewed the architecture artifact, the sensor report, and the reviewer feedback. Everything looks solid. Approve the current stage gate with the note: 'Approved architecture with Redis caching fallbacks' and advance the state machine to the next stage."*

---

### 7. Construction Units of Work (UoW) & Plan Approval
> *"As the Engineering Tech Lead (`persona_tech_lead`), decompose our functional design into a cycle-free Units of Work DAG. List each unit, its dependencies, and target files. Await my explicit Plan Approval before writing any implementation code."*

---

### 8. Session Metrics, Replay & Handover Pack
> *(View session cost and progress)*:
> *"Run `dlc_session_cost` and give me a breakdown of our workflow duration, approved stages by phase, sensor firings, and memory entries."*

> *(Generate executive narrative replay)*:
> *"Print a session narrative replay using `dlc_session_replay` summarizing all key decisions, trade-offs, and milestones for async review."*

> *(Generate closeout handover pack)*:
> *"We have finished implementation and all tests pass. Run `dlc_outcomes_pack` with `writeToFile: true` to generate our comprehensive `OUTCOMES.md` handover report at the workspace root."*

---

### 9. Recovery & Stage Reopening
> *"We discovered a new compliance requirement that affects our initial scope. Use `dlc_reopen_stage` to reopen Stage 2.3 (Requirements Analysis) under the Recovery Protocol without discarding our existing files."*

---

## 🛠️ MCP Primitives

### Tools
| Tool | Description |
|---|---|
| `dlc_doctor` | Run comprehensive environment and workspace health diagnostics. |
| `dlc_init_intent` | Initialize an intent with scope (11 scopes), depth, test strategy, and project type. |
| `dlc_get_status` | Retrieve active intent progress, stage state, and unresolved Socratic probes. |
| `dlc_get_scope_matrix` | View the 11-scope routing matrix comparing stage counts and defaults. |
| `dlc_switch_intent` | Switch workspace active intent. |
| `dlc_scan_workspace` | Scan workspace for brownfield reverse engineering & generate baseline docs. |
| `dlc_knowledge_add` | Add PRDs, vision docs, or team standards to the knowledge base. |
| `dlc_knowledge_list` | List all available knowledge base documents in the active space. |
| `dlc_knowledge_read` | Read the full content of a knowledge document into agent context. |
| `dlc_check_rubric` | Test draft content against a stage's Socratic rubric without saving to disk. |
| `dlc_submit_draft` | Save stage artifact markdown and evaluate rubric satisfaction. |
| `dlc_approve_gate` | Confirm human sign-off and advance the state machine to the next stage. |
| `dlc_list_intents` | List all tracked intents in the workspace. |
| `dlc_get_setup_requirements` | Retrieve system prerequisites, environment setup, and client configs. |
| `dlc_log_decision` | Log non-gate architectural & technical trade-offs into `decisions.json` (§2). |
| `dlc_request_review` | Dispatch independent reviewer verification pass (§12a) with structured verdicts. |
| `dlc_reopen_stage` | Reopen a previous stage back to `in_progress` (Recovery Protocol), preserving files. |
| `dlc_get_stage_spec` | Retrieve official execution steps, YAML frontmatter, and sensor rules for any stage. |
| `dlc_get_audit_trail` | Inspect the append-only audit trail and lifecycle event log (`audit/audit.jsonl`). |
| `dlc_install_hooks` | Install client lifecycle hooks into Claude Code, Cursor, or Git. |
| `dlc_run_hook` | Manually execute a lifecycle hook event (`session-start`, `pre-tool`, `stop`, `statusline`). |
| `dlc_memory_get` | Query layered memory rules (`org`, `team`, `project`, `phases/*`) or resolve composite active memory. |
| `dlc_memory_update` | Affirm or update team-wide or project-local rules under specific H2 headings (`team.md`, `project.md`). |
| `dlc_memory_record_learning` | Record runtime human corrections and architectural discoveries to `learnings.md`. |
| `dlc_get_scope_spec` | Retrieve the official specification, execution policies, frontmatter, and rationale for any scope. |
| `dlc_run_sensors` | Execute deterministic AI-DLC sensors (claim-sources, required-sections, traceability, upstream-coverage). |
| `dlc_get_sensor_spec` | Retrieve official contracts, trigger events, and failure modes for any of the 6 sensors. |
| `dlc_session_cost` | Read-only session cost & execution metrics view (duration, stages, memory, sensors, learnings). |
| `dlc_session_replay` | Print structured session narrative replay for stakeholders who weren't present without mutating state. |
| `dlc_outcomes_pack` | Generate comprehensive handover document (`OUTCOMES.md`) at workflow close. |
| `dlc_get_skill_spec` | Retrieve official `SKILL.md` specification and argument hints for any AI-DLC skill. |
| `dlc_install_skills` | Export AI-DLC skills into agent tool directories (`.cursor/skills`, `.claude/skills`, `.agents/skills`). |

### Prompts
| Prompt | Description |
|---|---|
| `aidlc_start` | Workflow kickoff, scope selection, and intent initialization. |
| `socratic_stage_inquiry` | Injects Socratic inquiry protocol and rubric dimensions for any stage. |
| `persona_product_agent` | Socratic Product Strategist (intent, empathy, boundaries, user stories). |
| `persona_architect_agent` | Principal Systems Architect (domain models, trade-offs, schemas, resilience). |
| `persona_developer_agent` | Senior Software Engineer (reverse engineering, clean code, implementation). |
| `persona_devsecops_agent` | DevSecOps Specialist (CI/CD pipelines, security automation, canary deployments). |
| `persona_quality_agent` | Lead QA Engineer (edge cases, automated testing, performance benchmarks). |
| `persona_tech_lead` | Engineering Tech Lead (Units of Work DAG, dependency sequencing, delivery plan). |
| `persona_infra_agent` | Cloud Infrastructure Architect (IaC, provisioning, container definitions). |
| `persona_observability_agent` | SRE Lead (tracing, telemetry, SLO alarms, incident runbooks). |
| `persona_security_agent` | Application Security Specialist (threat modeling, attack surface, RBAC). |
| `persona_business_analyst` | Business Analyst (market research, feasibility, resource constraints). |
| `persona_coach_agent` | Agile Coach (team formation, architectural retrospectives, post-mortems). |

### Resources
| URI | Description |
|---|---|
| `aidlc://state` | Live content of `./aidlc/.../aidlc-state.md`. |
| `aidlc://active-intent` | JSON metadata of active intent. |
| `aidlc://rubrics` | Complete catalog of 33 stage rubrics and probing dimensions. |
| `aidlc://scopes` | Scope routing matrix and stage sequences. |
| `aidlc://scopes/catalog` | Metadata catalog for all 11 official scopes from `core/scopes/`. |
| `aidlc://scopes/{scope}` | Verbatim markdown execution specification & YAML frontmatter for any scope (e.g. `express`, `bugfix`). |
| `aidlc://sensors/catalog` | Metadata catalog for all 6 deterministic sensors from `core/sensors/`. |
| `aidlc://sensors/{id}` | Verbatim markdown specification for any sensor (`claim-sources`, `required-sections`, etc.). |
| `aidlc://skills/catalog` | Metadata catalog for all 4 official skills from `core/skills/`. |
| `aidlc://skills/{name}` | Verbatim markdown specification & argument hint for any skill (`aidlc-outcomes-pack`, `aidlc-replay`, etc.). |
| `aidlc://outcomes` | Dynamic handover report (`OUTCOMES.md`) generated deterministically for the active intent. |
| `aidlc://session-replay` | Dynamic structured session replay narrative generated from audit shards and artifacts. |
| `aidlc://session-cost` | Deterministic runtime metrics and session cost report for the active intent. |
| `aidlc://knowledge` | Catalog and index of all 59 core engineering guides + workspace documents. |
| `aidlc://knowledge/{agent}/{doc}` | Direct markdown access to any core playbook (e.g. `aidlc-architect-agent/ddd-patterns.md`). |
| `aidlc://audit` | Append-only audit trail of lifecycle events (`audit.jsonl`). |
| `aidlc://stages/catalog` | Metadata catalog for all 33 official stages from `core/aidlc-common/stages/`. |
| `aidlc://stages/{slug}` | Verbatim markdown execution guide & frontmatter for any stage (e.g. `domain-design`). |
| `aidlc://memory/active` | Composite active memory resolved from org, team, project, and current stage phase. |
| `aidlc://memory/{org,team,project,learnings}` | Direct access to individual memory layer rules and corrections diary. |
| `aidlc://memory/phases/{phase}` | Phase-specific guardrails for `ideation`, `inception`, `construction`, or `operation`. |
| `aidlc://protocols/stage-protocol` | Voice contract, HARD STOP approval gate rules, atomic stage ritual. |
| `aidlc://protocols/reviewer-protocol` | Independent reviewer invocation protocol (§12a) and verdict schema. |
| `aidlc://protocols/construction-protocol` | Units of Work (UoW) DAG execution, Plan Approval, build-and-test loopback. |
| `aidlc://protocols/recovery-protocol` | Session resumption and stage reopening without data loss. |

---

## 📚 Built-in Core Knowledge Base (59 Playbooks)

The server bundles the complete software engineering playbooks from `core/knowledge/`:
* **Architect**: `ddd-patterns.md`, `architecture-guide.md`, `architecture-patterns.md`, `nfr-design-guide.md`, `adr-template.md`.
* **Developer**: `api-design-guide.md`, `code-generation-guide.md`, `data-modelling-patterns.md`, `re-artifacts.md`.
* **DevSecOps**: `threat-modelling-stride.md`, `security-guide.md`, `devsecops-pipeline-patterns.md`.
* **Quality**: `testing-guide.md`, `test-strategy-patterns.md`, `nfr-reliability-guide.md`, `nfr-validation-methods.md`.
* **AWS Platform**: `cdk-best-practices.md`, `well-architected-framework.md`, `cost-optimization-patterns.md`.
* **Operations**: `observability-patterns.md`, `slo-sli-patterns.md`, `incident-response-guide.md`.
* **Product**: `requirements-elicitation.md`, `user-story-patterns.md`, `prioritization-frameworks.md`.
* **Delivery**: `workflow-planning-guide.md`, `team-topologies.md`, `mob-programming-guide.md`.
* **Shared**: `ai-dlc-principles.md`, `brownfield.md`, `verification.md`, `audit-format.md`.

All documents are retrievable via `dlc_knowledge_read({ identifier: "ddd-patterns" })` or resource `aidlc://knowledge/...`.

---

## 🛡️ Lifecycle Guards & Hooks Architecture

The server implements upstream AI-DLC lifecycle guardrails across two complementary tiers:

### 1. Server-Side Guards (Client-Agnostic)
* **Review Freeze Guard**: Once an artifact passes independent review (`dlc_request_review`), it is frozen against direct edits. Revisions require explicitly unfreezing via `dlc_reopen_stage`.
* **Plan Approval Guard**: Implementation code generation (`code-generation`) is hard-locked until the architectural/implementation plan (`delivery-planning`, `units-generation`, or `functional-design`) receives gate approval.
* **Audit Trail**: Every session event, stage transition, gate approval, and decision writes an append-only event to `./aidlc/spaces/default/intents/<intent>/audit/audit.jsonl`.

### 2. Client Harness Hook Adapters
Run `dlc_install_hooks({ target: "all" })` or use CLI subcommands:
* **`session-start`**: Injects active workflow state (`aidlc-state.md`) into context when starting/resuming sessions.
* **`pre-tool`**: Refuses raw edits to state files or audit logs outside workflow verbs.
* **`stop`**: Validates the continuation loop, allowing turn stops only at genuine approval gates or question prompts.
* **`statusline`**: Displays real-time stage and gate status in the CLI status bar.

---

## 🧠 Official AI-DLC Skills Subsystem

The server bundles the official skills specifications and execution engines from upstream `core/skills/`:

| Skill | Classification | Purpose & Behavior |
|---|---|---|
| `aidlc-outcomes-pack` | `read-only` | Generates a comprehensive handover document (`OUTCOMES.md`) at workflow close covering architecture decisions, setup guides, repository structure, and footprint. Sourced deterministically from runtime metrics and deliverables. |
| `aidlc-replay` | `read-only` | Terminal narrative replay for async review and stakeholders who weren't in the room. Synthesizes audit shards and stage events into an executive summary and milestone timeline without mutating state. |
| `aidlc-session-cost` | `read-only` | Transparent deterministic session cost view: duration, stage outcomes (approved/failed/pending), phase rollup, memory counts, sensor firings, and captured learnings. |
| `aidlc-knowledge` | `read-write` (catalog only) | Document knowledge catalog management: indexes team PDFs, Word, Markdown, and text files under workspace lock. Never advances workflow stage pointer or mutates stage state. |

Skills can be retrieved via `dlc_get_skill_spec`, inspected dynamically via `aidlc://skills/...`, executed via dedicated MCP tools (`dlc_outcomes_pack`, `dlc_session_replay`, `dlc_session_cost`), or exported to assistant workspaces (`.cursor/skills`, `.claude/skills`, `.agents/skills`) using `dlc_install_skills`.

---

## 🔄 The Socratic Workflow Loop

```
User Intent
   │
   ▼
dlc_init_intent ({ label: "auth-service", scope: "feature", projectType: "auto" })
   │
   ▼
Adopt Persona & Socratic Inquiry (Trade-offs, limits, non-goals, failure modes)
   │
   ▼
dlc_submit_draft ({ stageId: "intent-capture", content: "..." })
   │
   ├── [Rubric Incomplete] ──► Returns lingering Socratic questions ──┐
   │                                                                 │
   │                                                                 ▼
   │                              Agent probes user on missing dimensions
   │                                                                 │
   └── [Rubric Satisfied] ◄──────────────────────────────────────────┘
           │
           ▼
dlc_approve_gate ({ notes: "Approved by tech lead" })
           │
           ▼
Advances to Stage 2.3 (Requirements Analysis)
```

---

## 🧪 Testing

Run automated tests:
```bash
npm test
```

## 📄 License
MIT
