export interface ProjectScanSummary {
    projectType: "greenfield" | "brownfield";
    detectedRuntimes: string[];
    manifests: string[];
    keyDirectories: string[];
    dependencies: string[];
    entryPoints: string[];
    draftDocument: string;
}
export declare function scanWorkspaceForReverseEngineering(workspaceDir?: string): Promise<ProjectScanSummary>;
