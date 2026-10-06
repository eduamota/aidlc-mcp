import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DlcStateMachine } from "./state-machine.js";
import { evaluateRubric } from "./socratic-rubric.js";
import { SCOPES, createStagesForScope, getScopeSpec, getAllScopeSpecs, detectScopeFromPrompt } from "./profiles.js";
import { runDlcDoctor } from "../utils/doctor.js";
import { addKnowledgeDocument, listKnowledgeDocuments, readKnowledgeDocument } from "../utils/knowledge.js";
import { STAGE_PROTOCOL, REVIEWER_PROTOCOL, CONSTRUCTION_PROTOCOL, RECOVERY_PROTOCOL, } from "./protocols.js";
import { getStageSpec, getAllStageSpecs } from "../stages/registry.js";
import { readAuditTrail } from "./audit.js";
import { executeHook } from "../hooks/runner.js";
import { installHooks } from "../hooks/installer.js";
import { ensureMemoryDirs, resolveActiveMemory, getMemoryRule, updateMemoryRule, recordLearning, readMemoryLayer, } from "../utils/memory.js";
import { getAllSensorSpecs, getSensorSpec } from "../sensors/registry.js";
import { evaluateRequiredSections, evaluateClaimSources, evaluateTraceabilityJson, evaluateUpstreamCoverage, runStageSensors, } from "./sensors.js";
import { getAllSkillSpecs, getSkillSpec } from "../skills/registry.js";
import { computeSessionCost, generateSessionReplay, generateOutcomesPack, } from "./skills.js";
import { dispatchCli, parseCliArgs } from "../cli/dispatcher.js";
test("Socratic Rubric Evaluation", () => {
    // 1. Incomplete draft
    const poorContent = "We want an inventory API with GET and POST.";
    const eval1 = evaluateRubric("intent-capture", poorContent);
    assert.equal(eval1.satisfied, false, "Poor draft should not satisfy rubric");
    assert.ok(eval1.unresolvedProbes.length > 0, "Should contain unresolved probes");
    // 2. Comprehensive draft covering all dimensions
    const richContent = `
# Intent Brief: Inventory Management API

## Problem Statement & Motivation
Users currently suffer from stale stock counts across distributed warehouses.
Without this real-time inventory system, over-selling occurs daily causing churn.

## Scope Boundaries & Non-Goals
- In scope: Product inventory tracking, real-time stock deductions, warehouse locations.
- Out of scope & Non-goals: Payment processing, shopping cart UI, external billing integrations.

## Measurable Success Criteria
- Acceptance metric: < 50ms latency on inventory check queries.
- Zero over-allocation under 500 concurrent stock reservation requests.
  `;
    const eval2 = evaluateRubric("intent-capture", richContent);
    assert.equal(eval2.satisfied, true, "Rich draft should satisfy intent-capture rubric");
    assert.equal(eval2.unresolvedProbes.length, 0, "All probes should be resolved");
    assert.equal(eval2.score, 1.0);
});
test("The 11 AI-DLC Core Scopes, Specifications, and Keyword Routing", () => {
    const scopeKeys = Object.keys(SCOPES);
    assert.equal(scopeKeys.length, 11, "Should support all 11 core scopes");
    // Verify enterprise has all stages
    assert.equal(SCOPES.enterprise.stageIds.length, 30);
    assert.equal(SCOPES.feature.stageIds.length, 30);
    assert.equal(SCOPES.poc.stageIds.length, 5);
    assert.equal(SCOPES.bugfix.stageIds.length, 6);
    assert.equal(SCOPES.express.stageIds.length, 7);
    // Verify greenfield vs brownfield stage mapping
    const greenStages = createStagesForScope("poc", "greenfield");
    assert.equal(greenStages.some((s) => s.id === "reverse-engineering"), false);
    const brownStages = createStagesForScope("poc", "brownfield");
    assert.equal(brownStages.some((s) => s.id === "reverse-engineering"), true);
    // Verify official ScopeSpec catalog
    const allSpecs = getAllScopeSpecs();
    assert.equal(allSpecs.length, 11, "All 11 official scope markdown specs must be present");
    const entSpec = getScopeSpec("enterprise");
    assert.ok(entSpec);
    assert.equal(entSpec.guardPolicy, "strict");
    assert.equal(entSpec.depth, "comprehensive");
    assert.equal(entSpec.skeleton, "on");
    const expSpec = getScopeSpec("express");
    assert.ok(expSpec);
    assert.equal(expSpec.skeleton, "off");
    assert.equal(expSpec.reviewCap, "none");
    assert.equal(expSpec.planApproval, "off");
    // Verify attached ScopeSpec in SCOPES map
    assert.ok(SCOPES.bugfix.spec);
    assert.equal(SCOPES.bugfix.spec.name, "bugfix");
    assert.equal(SCOPES.bugfix.spec.skeleton, "off");
    // Verify keyword auto-detection
    assert.equal(detectScopeFromPrompt("Please fix the critical broken authentication bug"), "bugfix");
    assert.equal(detectScopeFromPrompt("Refactor and clean up the legacy payment client"), "refactor");
    assert.equal(detectScopeFromPrompt("Urgent response to patch CVE-2026-9999 security vulnerability"), "security-patch");
    assert.equal(detectScopeFromPrompt("Build a quick prototype spike for user retention"), "poc");
    assert.equal(detectScopeFromPrompt("Deploy cloud infrastructure resources with CDK"), "infra");
    assert.equal(detectScopeFromPrompt("Express lightweight script without design ceremony"), "express");
    assert.equal(detectScopeFromPrompt("Generic task with no trigger words"), undefined);
});
test("AI-DLC Lifecycle State Machine Flow", async () => {
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-test-"));
    try {
        // 1. Initialize intent
        const { intent, intentDir } = await DlcStateMachine.initIntent({
            label: "test-auth-svc",
            description: "Build OAuth2 authorization service",
            profile: "express",
            workspaceDir: tempWs,
        });
        assert.equal(intent.profile, "express");
        assert.ok(intentDir.includes("test-auth-svc"));
        // Check files created
        const stateMd = await fs.readFile(path.join(intentDir, "aidlc-state.md"), "utf-8");
        assert.ok(stateMd.includes("AI-DLC State"));
        assert.ok(stateMd.includes("Requirements Analysis"));
        // 2. Check status
        const status1 = await DlcStateMachine.getStatus(undefined, tempWs);
        assert.equal(status1.intent?.intentId, intent.intentId);
        assert.equal(status1.activeStageState?.id, "requirements-analysis");
        // 3. Submit incomplete draft -> should fail gate approval
        const partialDraft = "# Requirements\nSimple user login";
        const subResult1 = await DlcStateMachine.submitDraft({
            content: partialDraft,
            workspaceDir: tempWs,
        });
        assert.equal(subResult1.evaluation.satisfied, false);
        await assert.rejects(async () => {
            await DlcStateMachine.approveGate({ workspaceDir: tempWs });
        }, /has not met the Socratic rubric yet/, "Cannot approve gate before rubric is satisfied");
        // 4. Submit complete draft -> satisfies rubric
        const completeDraft = `
# Requirements & User Stories: OAuth2 Service

## Functional Requirements
- As a client app, I want to exchange authorization codes for JWT tokens so that users authenticate.
- Endpoint POST /oauth/token accepts grant_type=authorization_code.
- Endpoint GET /oauth/userinfo returns user claims.

## Edge Cases and Limits
- Empty or invalid client credentials return 401 Unauthorized with standardized error JSON.
- Revoked tokens return immediate 403 Forbidden.
- Rate limits applied at 100 requests per minute per IP.

## Non-Functional Requirements (NFRs)
- Latency: P99 token verification under 10ms.
- High availability with stateless JWT signature validation.
    `;
        const subResult2 = await DlcStateMachine.submitDraft({
            content: completeDraft,
            workspaceDir: tempWs,
        });
        assert.equal(subResult2.evaluation.satisfied, true);
        // 5. Approve gate -> advances to stage 2
        const approveResult = await DlcStateMachine.approveGate({
            notes: "Requirements reviewed and approved by lead architect.",
            workspaceDir: tempWs,
        });
        assert.equal(approveResult.success, true);
        assert.equal(approveResult.nextStageId, "code-generation");
        // Check updated status
        const status2 = await DlcStateMachine.getStatus(undefined, tempWs);
        assert.equal(status2.activeStageState?.id, "code-generation");
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
test("Two-Tier Knowledge Base Management", async () => {
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-kb-"));
    try {
        // 1. Add team standard
        const doc = await addKnowledgeDocument({
            filename: "company-architecture-standards.md",
            content: "# Architecture Standards\nAll microservices must use gRPC for internal traffic and OpenTelemetry for traces.",
            category: "shared",
            workspaceDir: tempWs,
        });
        assert.equal(doc.filename, "company-architecture-standards.md");
        assert.equal(doc.category, "shared");
        // 2. List documents (workspace + 59 core documents)
        const list = await listKnowledgeDocuments(tempWs);
        assert.ok(list.length >= 59, "Should list all built-in core knowledge guides plus workspace document");
        assert.ok(list.some((d) => d.id === "company-architecture-standards"), "Should include custom team standard");
        assert.ok(list.some((d) => d.id === "ddd-patterns"), "Should include built-in ddd-patterns guide");
        assert.ok(list.some((d) => d.id === "threat-modelling-stride"), "Should include built-in STRIDE threat modeling");
        // 3. Read workspace document
        const read = await readKnowledgeDocument("company-architecture-standards", tempWs);
        assert.ok(read);
        assert.ok(read.content.includes("OpenTelemetry"));
        // 4. Read built-in core knowledge document
        const dddDoc = await readKnowledgeDocument("ddd-patterns", tempWs);
        assert.ok(dddDoc);
        assert.ok(dddDoc.content.includes("Bounded Contexts"));
        const strideDoc = await readKnowledgeDocument("threat-modelling-stride", tempWs);
        assert.ok(strideDoc);
        assert.ok(strideDoc.content.includes("STRIDE"));
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
test("AI-DLC Doctor Diagnostics", async () => {
    const report = await runDlcDoctor();
    assert.ok(report.checks.length >= 4);
    const nodeCheck = report.checks.find((c) => c.name === "Node.js Runtime");
    assert.ok(nodeCheck);
    assert.equal(nodeCheck.status, "pass");
});
test("AI-DLC Protocols: Decisions, Reviews, and Recovery Reopening", async () => {
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-proto-"));
    try {
        // 1. Verify protocol texts contain key instructions
        assert.ok(STAGE_PROTOCOL.includes("Voice Contract"));
        assert.ok(STAGE_PROTOCOL.includes("Approval Gate Rules (HARD STOP)"));
        assert.ok(REVIEWER_PROTOCOL.includes("Reviewer Invocation Protocol (§12a)"));
        assert.ok(CONSTRUCTION_PROTOCOL.includes("Units of Work (UoW) Execution"));
        assert.ok(RECOVERY_PROTOCOL.includes("Re-opening a Stage"));
        // 2. Initialize an intent
        const { intent } = await DlcStateMachine.initIntent({
            label: "protocol-demo",
            description: "Demonstrating protocols",
            profile: "express",
            workspaceDir: tempWs,
        });
        // 3. Log a non-gate decision (§2)
        const decRes = await DlcStateMachine.logDecision({
            stageId: "requirements-analysis",
            decision: "Use JWT tokens over session cookies",
            rationale: "Stateless verification enables horizontal scaling with zero DB lookups.",
            optionsConsidered: ["Session cookies with Redis", "API Keys"],
            workspaceDir: tempWs,
        });
        assert.equal(decRes.logged, true);
        assert.equal(decRes.count, 1);
        // 4. Submit artifact and request independent review (§12a)
        const validDraft = `
# Requirements Analysis: Protocol Demo

## Functional Requirements
- System authenticates client using JWT.
- System validates claims with public key.

## Edge Cases and Limits
- Expired token returns 401 Unauthorized.
- Malformed header returns 400 Bad Request.

## Non-Functional Requirements (NFRs)
- Latency under 5ms per verification.
- Scale to 10k RPS.
    `;
        await DlcStateMachine.submitDraft({
            content: validDraft,
            workspaceDir: tempWs,
        });
        const review = await DlcStateMachine.requestReview({
            stageId: "requirements-analysis",
            reviewer: "aidlc-security-reviewer-agent",
            workspaceDir: tempWs,
        });
        assert.equal(review.verdict, "APPROVED");
        assert.equal(review.reviewer, "aidlc-security-reviewer-agent");
        assert.ok(review.findings.length > 0);
        // 5. Approve gate to move to stage 2
        await DlcStateMachine.approveGate({
            notes: "Stage 1 approved with passing review",
            workspaceDir: tempWs,
        });
        const statusAfterApprove = await DlcStateMachine.getStatus(undefined, tempWs);
        assert.equal(statusAfterApprove.activeStageState?.id, "code-generation");
        // 6. Test Recovery Protocol: Reopen Stage 1
        const reopen = await DlcStateMachine.reopenStage({
            stageId: "requirements-analysis",
            reason: "Need to add OAuth refresh token flow",
            workspaceDir: tempWs,
        });
        assert.equal(reopen.success, true);
        assert.equal(reopen.reopenedStageId, "requirements-analysis");
        const statusAfterReopen = await DlcStateMachine.getStatus(undefined, tempWs);
        assert.equal(statusAfterReopen.activeStageState?.id, "requirements-analysis");
        assert.equal(statusAfterReopen.activeStageState?.status, "in_progress");
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
test("Official Stage Specifications Catalog (33 Stages)", () => {
    const allSpecs = getAllStageSpecs();
    assert.equal(allSpecs.length, 33, "Should bundle all 33 official stages");
    // Verify critical stages exist and contain execution markdown
    const reqSpec = getStageSpec("requirements-analysis");
    assert.ok(reqSpec, "requirements-analysis spec must exist");
    assert.equal(reqSpec.phase, "inception");
    assert.equal(reqSpec.lead_agent, "aidlc-product-agent");
    assert.equal(reqSpec.reviewer, "aidlc-product-lead-agent");
    assert.ok(reqSpec.markdown.includes("## Steps"));
    assert.ok(reqSpec.markdown.includes("### Step 1: Load Prior Context"));
    // Verify domain-design
    const domainSpec = getStageSpec("domain-design");
    assert.ok(domainSpec);
    assert.equal(domainSpec.phase, "inception");
    assert.equal(domainSpec.lead_agent, "aidlc-architect-agent");
    assert.ok(domainSpec.markdown.includes("Domain Design"));
    // Verify alias lookup
    const stateSpec = getStageSpec("state-initialization");
    assert.ok(stateSpec);
    assert.equal(stateSpec.slug, "state-init");
});
test("AI-DLC Lifecycle Guards: Review Freeze and Plan Approval", async () => {
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-guards-"));
    try {
        const { intent } = await DlcStateMachine.initIntent({
            label: "guards-test",
            description: "Testing Review Freeze and Plan Approval Guards",
            profile: "express",
            workspaceDir: tempWs,
        });
        const richReqs = `
# Requirements Analysis
## Functional Requirements
- Requirement 1: User login with JWT token.
- Requirement 2: Token refresh endpoint.
## Edge Cases and Limits
- Reject expired token with 401.
- Limit auth attempts to 5 per min.
## Non-Functional Requirements (NFRs)
- Latency under 10ms.
- 99.99% availability.
    `;
        // 1. Submit and approve review -> should freeze the stage
        await DlcStateMachine.submitDraft({
            content: richReqs,
            workspaceDir: tempWs,
        });
        const rev = await DlcStateMachine.requestReview({
            stageId: "requirements-analysis",
            reviewer: "lead-reviewer",
            workspaceDir: tempWs,
        });
        assert.equal(rev.verdict, "APPROVED");
        // Check intent stage is frozen
        const status1 = await DlcStateMachine.getStatus(undefined, tempWs);
        assert.equal(status1.activeStageState?.frozen, true);
        // 2. Attempting to submit another draft while frozen must be rejected
        await assert.rejects(async () => {
            await DlcStateMachine.submitDraft({
                content: "# Modifying frozen draft without reopening",
                workspaceDir: tempWs,
            });
        }, /\[REVIEW_FREEZE_BLOCKED\]/, "Frozen stage draft edit must be blocked");
        // 3. Reopening the stage must unfreeze it
        await DlcStateMachine.reopenStage({
            stageId: "requirements-analysis",
            reason: "Need to amend requirements",
            workspaceDir: tempWs,
        });
        const status2 = await DlcStateMachine.getStatus(undefined, tempWs);
        assert.equal(status2.activeStageState?.frozen, false);
        // 4. Now submitting draft succeeds
        const draft2 = await DlcStateMachine.submitDraft({
            content: richReqs,
            workspaceDir: tempWs,
        });
        assert.equal(draft2.evaluation.satisfied, true);
        // 5. Test Audit Trail
        const auditEvents = await readAuditTrail(intent.intentId, tempWs);
        assert.ok(auditEvents.length >= 4, "Should have recorded multiple audit events");
        assert.ok(auditEvents.some((e) => e.type === "INTENT_INITIALIZED"));
        assert.ok(auditEvents.some((e) => e.type === "STAGE_FROZEN"));
        assert.ok(auditEvents.some((e) => e.type === "GUARD_REFUSAL"));
        assert.ok(auditEvents.some((e) => e.type === "STAGE_UNFROZEN"));
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
test("AI-DLC Lifecycle Hooks Runner and Installer", async () => {
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-hooks-"));
    try {
        // 1. Session start with no intent
        const h1 = await executeHook({ event: "session-start", workspaceDir: tempWs });
        assert.equal(h1.action, "allow");
        // 2. Initialize intent and check session-start context injection
        await DlcStateMachine.initIntent({
            label: "hook-test",
            description: "Hook verification intent",
            profile: "express",
            workspaceDir: tempWs,
        });
        const h2 = await executeHook({ event: "session-start", workspaceDir: tempWs });
        assert.equal(h2.action, "allow");
        assert.ok(h2.contextPayload?.includes("AI-DLC Active Session Context"));
        assert.ok(h2.contextPayload?.includes("hook-test"));
        // 3. PreToolUse state-transition guard
        const h3Safe = await executeHook({
            event: "pre-tool",
            toolArgs: { path: "src/index.ts" },
            workspaceDir: tempWs,
        });
        assert.equal(h3Safe.action, "allow");
        const h3Block = await executeHook({
            event: "pre-tool",
            toolArgs: { path: "aidlc/spaces/default/intents/261005-hook-test/aidlc-state.md" },
            workspaceDir: tempWs,
        });
        assert.equal(h3Block.action, "block");
        assert.ok(h3Block.message?.includes("STATE_TRANSITION_GUARD"));
        // 4. StatusLine hook
        const h4 = await executeHook({ event: "statusline", workspaceDir: tempWs });
        assert.equal(h4.action, "notify");
        assert.ok(h4.message?.includes("AI-DLC: hook-test"));
        // 5. Hooks Installer
        const installRes = await installHooks({ target: "all", workspaceDir: tempWs });
        assert.equal(installRes.installed.length, 3);
        assert.ok(installRes.installed.some((i) => i.includes(".claude/settings.json")));
        assert.ok(installRes.installed.some((i) => i.includes(".cursor/rules")));
        assert.ok(installRes.installed.some((i) => i.includes(".git/hooks/pre-commit")));
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
test("AI-DLC Memory Subsystem: 3-Tier Layering, Phase Guardrails, and Learnings", async () => {
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-memory-"));
    try {
        // 1. Ensure memory dirs and seed defaults
        await ensureMemoryDirs(tempWs);
        const orgContent = await readMemoryLayer("org", tempWs);
        assert.ok(orgContent.includes("Org-Level Rules"), "Should seed org.md default");
        assert.ok(orgContent.includes("trunk-based development"));
        const teamContent = await readMemoryLayer("team", tempWs);
        assert.ok(teamContent.includes("Team-Level Rules"));
        // 2. Resolve active memory with phase guardrails
        const activeConstruction = await resolveActiveMemory({
            phase: "construction",
            workspaceDir: tempWs,
        });
        assert.ok(activeConstruction.combinedText.includes("1. Organization-Level Defaults (org.md)"));
        assert.ok(activeConstruction.combinedText.includes("2. Team-Level Affirmed Rules (team.md)"));
        assert.ok(activeConstruction.combinedText.includes("3. Project-Level Local Rules (project.md)"));
        assert.ok(activeConstruction.combinedText.includes("4. Phase Guardrails (construction.md)"));
        assert.ok(activeConstruction.combinedText.includes("Code Completeness"));
        // 3. Query specific rule heading [memory:M<n>]
        const wayOfWorking = await getMemoryRule("org", "Way of Working", tempWs);
        assert.ok(wayOfWorking?.includes("trunk-based development"));
        const missingRule = await getMemoryRule("org", "Non-Existent-Heading", tempWs);
        assert.equal(missingRule, null);
        // 4. Update memory rule (e.g. practices-discovery affirmation)
        const updateRes = await updateMemoryRule("team", "Testing Posture", "- **Methodology**: TDD\n- **Ordering**: test-first\n- **Coverage floor**: 95%", tempWs);
        assert.equal(updateRes.success, true);
        const updatedTesting = await getMemoryRule("team", "Testing Posture", tempWs);
        assert.ok(updatedTesting?.includes("**Coverage floor**: 95%"));
        // 5. Append learning / human correction
        const learnRes = await recordLearning({
            learning: "Always use structured JSON error logs when deploying to AWS Lambda.",
            stageId: "construction/code-generation",
            workspaceDir: tempWs,
        });
        assert.equal(learnRes.success, true);
        const learningsContent = await readMemoryLayer("learnings", tempWs);
        assert.ok(learningsContent.includes("Always use structured JSON error logs"));
        assert.ok(learningsContent.includes("construction/code-generation"));
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
test("AI-DLC Deterministic Sensors: required-sections, claim-sources, traceability, and DAG validation", async () => {
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-sensors-"));
    try {
        // 1. Verify 6 official sensors in registry
        const allSensors = getAllSensorSpecs();
        assert.equal(allSensors.length, 6, "All 6 core sensors must be registered");
        assert.ok(getSensorSpec("claim-sources"));
        assert.ok(getSensorSpec("required-sections"));
        assert.ok(getSensorSpec("traceability"));
        assert.ok(getSensorSpec("upstream-coverage"));
        assert.ok(getSensorSpec("type-check"));
        assert.ok(getSensorSpec("linter"));
        // 2. required-sections sensor:
        // Bad markdown: only 1 H2
        const badMarkdown = "# Title\n## Only One Section\nSome content";
        const req1 = await evaluateRequiredSections({ content: badMarkdown, workspaceDir: tempWs });
        assert.equal(req1.pass, false);
        assert.ok(req1.findings[0].includes("minimum of 2 required"));
        // Good markdown: >= 2 H2
        const goodMarkdown = "# Title\n## Section One\nContent 1\n## Section Two\nContent 2";
        const req2 = await evaluateRequiredSections({ content: goodMarkdown, workspaceDir: tempWs });
        assert.equal(req2.pass, true);
        // Timestamp marker: always passes
        const tsRes = await evaluateRequiredSections({
            content: "# Empty marker",
            filename: "practices-timestamp.md",
            workspaceDir: tempWs,
        });
        assert.equal(tsRes.pass, true);
        // Unit DAG with cycle: must detect cyclic error
        const cyclicDag = `
# Units of Work Dependency
## 1. Units DAG
\`\`\`yaml
units:
  - name: u1
    depends_on:
      - u2
  - name: u2
    depends_on:
      - u1
\`\`\`
## 2. Execution Notes
Notes here.
    `;
        const dagRes = await evaluateRequiredSections({
            content: cyclicDag,
            filename: "unit-of-work-dependency.md",
            workspaceDir: tempWs,
        });
        assert.equal(dagRes.pass, false);
        assert.equal(dagRes.details?.edge_block, "cyclic");
        assert.ok(dagRes.findings.some((f) => f.includes("Circular dependency")));
        // 3. claim-sources sensor:
        // Missing ## Assumptions & Open Questions
        const noAssumptions = "# Intent\n## Sources\n- [desc] info";
        const claim1 = await evaluateClaimSources({ content: noAssumptions });
        assert.equal(claim1.pass, false);
        assert.ok(claim1.findings.some((f) => f.includes("Assumptions & Open Questions")));
        // Valid claim tags
        const validClaims = `
# Intent Capture
## 1. Scope
- [scope] Workflow-selected scope: \`feature\`.
## 2. Requirements
We need inventory tracking [desc] and real-time deductions [Q1].
According to team rules [memory:team#Testing], tests must be automated.
## 3. Assumptions & Open Questions
- System will handle 500 RPS [assumption].
    `;
        const claim2 = await evaluateClaimSources({ content: validClaims });
        assert.equal(claim2.pass, true);
        // 4. traceability sensor:
        const validTraceability = JSON.stringify({
            stage: "functional-design",
            upstream_ids: ["AC1.1", "AC1.2"],
            coverage: [
                { id: "AC1.1", status: "OK", target: "BR1.1" },
                { id: "AC1.2", status: "OK", target: "BR1.2" },
            ],
            reverse: [],
        });
        const tracePass = evaluateTraceabilityJson(validTraceability);
        assert.equal(tracePass.pass, true);
        const gapTraceability = JSON.stringify({
            stage: "functional-design",
            upstream_ids: ["AC1.1"],
            coverage: [{ id: "AC1.1", status: "GAP" }],
        });
        const traceFail = evaluateTraceabilityJson(gapTraceability);
        assert.equal(traceFail.pass, false);
        assert.ok(traceFail.findings.some((f) => f.includes("Traceability GAP")));
        // 5. upstream-coverage sensor:
        const upstreamRes = evaluateUpstreamCoverage({
            consumes: ["requirements-analysis", "domain-design"],
            deliverableContents: [
                "Based on requirements-analysis/ deliverables and `domain-design.md`, we build this unit.",
            ],
        });
        assert.equal(upstreamRes.pass, true);
        // 6. runStageSensors end-to-end orchestration
        const report = await runStageSensors({
            stageSlug: "intent-capture",
            content: validClaims,
            workspaceDir: tempWs,
        });
        assert.equal(report.overallPass, true);
        assert.ok(report.results.length >= 2);
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
test("Skills Registry and Execution", async () => {
    // 1. Registry specs
    const allSkills = getAllSkillSpecs();
    assert.equal(allSkills.length, 4, "Should have 4 official skills");
    const expectedSkills = [
        "aidlc-outcomes-pack",
        "aidlc-replay",
        "aidlc-session-cost",
        "aidlc-knowledge",
    ];
    for (const name of expectedSkills) {
        const spec = getSkillSpec(name);
        assert.ok(spec, `Skill ${name} should be registered`);
        assert.equal(spec.name, name);
        assert.ok(spec.description.length > 5);
        assert.ok(spec.markdown.includes(name));
        assert.ok(spec.classification === "read-only" || spec.classification === "read-write");
    }
    // 2. Skills Engine Operations
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-skills-test-"));
    try {
        const { intent } = await DlcStateMachine.initIntent({
            label: "order-service",
            description: "Scalable order ingestion and validation microservice",
            profile: "mvp",
            workspaceDir: tempWs,
        });
        // Test computeSessionCost
        const cost = await computeSessionCost(intent.intentId, tempWs);
        assert.equal(cost.workflow_id, intent.intentId);
        assert.equal(cost.scope, "mvp");
        assert.ok(cost.stages.total > 0);
        assert.equal(cost.stages.approved, 0);
        assert.equal(cost.stages.pending, cost.stages.total);
        assert.ok(cost.by_phase.ideation);
        // Test generateSessionReplay
        const replay = await generateSessionReplay(intent.intentId, tempWs);
        assert.ok(replay.includes("# Session Replay"));
        assert.ok(replay.includes("order-service"));
        assert.ok(replay.includes("## Executive Summary"));
        assert.ok(replay.includes("## Timeline"));
        // Test generateOutcomesPack
        const { content, filePath } = await generateOutcomesPack({
            intentId: intent.intentId,
            workspaceDir: tempWs,
            writeToFile: true,
        });
        assert.ok(content.includes("# Outcomes Pack"));
        assert.ok(content.includes("## 1. What Was Built"));
        assert.ok(content.includes("## 2. Key Architectural Decisions"));
        assert.ok(filePath);
        // Verify file written to disk
        const onDisk = await fs.readFile(path.join(tempWs, "OUTCOMES.md"), "utf-8");
        assert.equal(onDisk, content);
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
test("CLI Dispatcher and Argument Parser", async () => {
    // 1. Argument parsing
    const parsed1 = parseCliArgs(["doctor", "--json", "--workspace", "/tmp/ws"]);
    assert.equal(parsed1.command, "doctor");
    assert.equal(parsed1.flags.json, true);
    assert.equal(parsed1.flags.workspace, "/tmp/ws");
    // Upstream runtime summary mapping
    const parsed2 = parseCliArgs(["engine", "runtime", "summary", "--json"]);
    assert.equal(parsed2.command, "runtime");
    assert.equal(parsed2.subcommand, "summary");
    assert.equal(parsed2.flags.json, true);
    // 2. Dispatch execution in temp workspace
    const tempWs = await fs.mkdtemp(path.join(os.tmpdir(), "aidlc-cli-test-"));
    try {
        // Test help
        const helpRes = await dispatchCli(["--help"]);
        assert.equal(helpRes, true);
        // Test version
        const verRes = await dispatchCli(["--version", "--json"]);
        assert.equal(verRes, true);
        // Test doctor
        const docRes = await dispatchCli(["doctor", "--json", "--workspace", tempWs]);
        assert.equal(docRes, true);
        // Test sensor list
        const sensorRes = await dispatchCli(["sensor", "list", "--json"]);
        assert.equal(sensorRes, true);
        // Test intent init
        const initRes = await dispatchCli([
            "intent",
            "init",
            "cli-test-intent",
            "Test CLI intent",
            "--scope",
            "poc",
            "--workspace",
            tempWs,
            "--json",
        ]);
        assert.equal(initRes, true);
        // Test status
        const statusRes = await dispatchCli(["status", "--workspace", tempWs, "--json"]);
        assert.equal(statusRes, true);
        // Test runtime summary
        const runRes = await dispatchCli(["runtime", "summary", "--workspace", tempWs, "--json"]);
        assert.equal(runRes, true);
    }
    finally {
        await fs.rm(tempWs, { recursive: true, force: true });
    }
});
//# sourceMappingURL=engine.test.js.map