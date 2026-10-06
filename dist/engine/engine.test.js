import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DlcStateMachine } from "./state-machine.js";
import { evaluateRubric } from "./socratic-rubric.js";
import { SCOPES, createStagesForScope } from "./profiles.js";
import { runDlcDoctor } from "../utils/doctor.js";
import { addKnowledgeDocument, listKnowledgeDocuments, readKnowledgeDocument } from "../utils/knowledge.js";
import { STAGE_PROTOCOL, REVIEWER_PROTOCOL, CONSTRUCTION_PROTOCOL, RECOVERY_PROTOCOL, } from "./protocols.js";
import { getStageSpec, getAllStageSpecs } from "../stages/registry.js";
import { readAuditTrail } from "./audit.js";
import { executeHook } from "../hooks/runner.js";
import { installHooks } from "../hooks/installer.js";
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
test("The 11 AI-DLC Core Scopes and Stage Routing", () => {
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
//# sourceMappingURL=engine.test.js.map