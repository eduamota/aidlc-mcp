import { ProfileType, StageState } from "../types.js";
export interface ProfileDefinition {
    type: ProfileType;
    name: string;
    description: string;
    stageIds: string[];
}
export declare const PROFILES: Record<ProfileType, ProfileDefinition>;
/**
 * Initializes the list of StageState objects for a given profile.
 */
export declare function createStagesForProfile(profileType: ProfileType): StageState[];
