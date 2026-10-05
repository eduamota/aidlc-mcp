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
| `aidlc://knowledge` | Listing of team standards and reference documents. |
| `aidlc://protocols/stage-protocol` | Voice contract, HARD STOP approval gate rules, atomic stage ritual. |
| `aidlc://protocols/reviewer-protocol` | Independent reviewer invocation protocol (§12a) and verdict schema. |
| `aidlc://protocols/construction-protocol` | Units of Work (UoW) DAG execution, Plan Approval, build-and-test loopback. |
| `aidlc://protocols/recovery-protocol` | Session resumption and stage reopening without data loss. |

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
