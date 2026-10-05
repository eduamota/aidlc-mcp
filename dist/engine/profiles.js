import { STAGE_DEFINITIONS } from "./socratic-rubric.js";
export const PROFILES = {
    feature: {
        type: "feature",
        name: "Standard Feature",
        description: "Complete full-lifecycle feature development across all 6 phases with comprehensive verification and threat modeling.",
        stageIds: [
            "intent-capture",
            "requirements-analysis",
            "architecture-design",
            "threat-modeling",
            "task-decomposition",
            "code-generation",
            "automated-testing",
            "operation-readiness",
        ],
    },
    mvp: {
        type: "mvp",
        name: "MVP / Greenfield Prototype",
        description: "Rapid end-to-end prototyping focusing on core architecture, implementation, and essential testing while deferring heavy ops.",
        stageIds: [
            "intent-capture",
            "requirements-analysis",
            "architecture-design",
            "task-decomposition",
            "code-generation",
            "automated-testing",
        ],
    },
    bugfix: {
        type: "bugfix",
        name: "Bugfix & Root Cause Remediation",
        description: "Surgical problem diagnosis and regression fix. Skips ideation, focuses on root cause analysis, fix design, and regression testing.",
        stageIds: [
            "requirements-analysis",
            "architecture-design",
            "code-generation",
            "automated-testing",
        ],
    },
    express: {
        type: "express",
        name: "Express Iteration",
        description: "Lightweight streamlined flow for straightforward code enhancements, updates, or maintenance tasks.",
        stageIds: [
            "requirements-analysis",
            "code-generation",
            "automated-testing",
        ],
    },
};
/**
 * Initializes the list of StageState objects for a given profile and project type.
 * If projectType is 'brownfield', injects 'reverse-engineering' before requirements analysis.
 */
export function createStagesForProfile(profileType, projectType = "greenfield") {
    const profile = PROFILES[profileType] || PROFILES.feature;
    const stageIds = [...profile.stageIds];
    if (projectType === "brownfield" && !stageIds.includes("reverse-engineering")) {
        const reqIndex = stageIds.indexOf("requirements-analysis");
        if (reqIndex !== -1) {
            stageIds.splice(reqIndex, 0, "reverse-engineering");
        }
        else {
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
//# sourceMappingURL=profiles.js.map