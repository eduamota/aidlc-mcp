import { ProfileType, ProjectType, StageState } from "../types.js";
export interface ProfileDefinition {
    type: ProfileType;
    name: string;
    description: string;
    stageIds: string[];
}
export declare const PROFILES: Record<ProfileType, ProfileDefinition>;
/**
 * Initializes the list of StageState objects for a given profile and project type.
 * If projectType is 'brownfield', injects 'reverse-engineering' before requirements analysis.
 */
export declare function createStagesForProfile(profileType: ProfileType, projectType?: ProjectType): StageState[];
