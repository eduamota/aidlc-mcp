export declare function findWorkspaceRoot(startDir?: string): string;
interface ParsedCliArgs {
    command: string;
    subcommand?: string;
    args: string[];
    flags: {
        json: boolean;
        write: boolean;
        workspace?: string;
        space?: string;
        intent?: string;
        scope?: string;
        depth?: string;
        testStrategy?: string;
        notes?: string;
        reason?: string;
        file?: string;
        target?: string;
        help: boolean;
        version: boolean;
    };
}
export declare function parseCliArgs(rawArgs: string[]): ParsedCliArgs;
export declare function dispatchCli(rawArgs: string[]): Promise<boolean>;
export {};
