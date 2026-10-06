import { HookContext, HookResult } from "../types.js";
/**
 * Executes an AI-DLC lifecycle hook event.
 */
export declare function executeHook(context: HookContext): Promise<HookResult>;
