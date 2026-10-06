/**
 * Official AI-DLC Skill Specifications generated from awslabs/aidlc-workflows/core/skills/
 * Total skills: 4
 */
export interface SkillSpec {
    name: string;
    description: string;
    argumentHint?: string;
    userInvocable: boolean;
    classification: "read-only" | "read-write" | string;
    markdown: string;
}
export declare const SKILL_SPECS: Record<string, SkillSpec>;
export declare function getSkillSpec(name: string): SkillSpec | undefined;
export declare function getAllSkillSpecs(): SkillSpec[];
