/**
 * Official AI-DLC Stage Specifications generated from awslabs/aidlc-workflows/core/aidlc-common/stages/
 * Total stages: 33
 */
export interface StageSpec {
    slug: string;
    name: string;
    phase: string;
    execution: string;
    condition?: string;
    lead_agent?: string;
    support_agents?: string[];
    mode?: string;
    summary_confirmation?: string;
    reviewer?: string;
    review_artifact?: string;
    review_class?: string;
    produces: Array<string | {
        artifact: string;
    }>;
    consumes: Array<string | {
        artifact: string;
    }>;
    requires_stage: string[];
    sensors: string[];
    scopes: string[];
    inputs?: string;
    outputs?: string;
    frontmatter: Record<string, any>;
    markdown: string;
}
export declare const STAGE_SPECS: Record<string, StageSpec>;
/**
 * Retrieve the full official stage specification by stage ID or slug.
 */
export declare function getStageSpec(idOrSlug: string): StageSpec | undefined;
/**
 * List all available official stage specifications.
 */
export declare function getAllStageSpecs(): StageSpec[];
/**
 * Get raw markdown content for a stage specification.
 */
export declare function getStageMarkdown(idOrSlug: string): string | undefined;
