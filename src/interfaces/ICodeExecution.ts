export interface CodeRun {
    stdout?: string;
    stderr?: string;
    code: number;
    signal?: string;
    output?: string;
    wall_time?: number;
}

export interface ExecutionResult {
    language: string;
    version: string;
    run: CodeRun;
    message?: string;
}

export interface ExecutionRuntime {
    language: string;
    version: string;
    aliases: string[];
    runtime: string;
}

export interface AiChoices {
    index: number;
    message: {
        role: string;
        content: string;
    }
}

export interface CodeAnalisis {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: AiChoices[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        total_time: number;
    }
}

export type ExecutionRuntimes = ExecutionRuntime[];