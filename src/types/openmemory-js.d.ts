declare module 'openmemory-js' {
  export interface MemorySearchOptions {
    user_id?: string;
    group_id?: string;
    limit?: number;
  }

  export interface MemoryAddOptions {
    user_id?: string;
    group_id?: string;
    metadata?: Record<string, unknown>;
  }

  export interface MemoryResult {
    id?: string;
    content: string;
    memory?: string;
    text?: string;
    score?: number;
    metadata?: Record<string, unknown>;
  }

  export interface MemoryConfig {
    mode: 'local' | 'remote';
    serverUrl?: string;
    apiKey?: string;
  }

  export class Memory {
    constructor(config?: Partial<MemoryConfig>);
    search(query: string, options?: MemorySearchOptions): Promise<MemoryResult[]>;
    add(content: string, options?: MemoryAddOptions): Promise<void>;
    delete(id: string): Promise<void>;
    reinforce(id: string): Promise<void>;
    source(name: string): Promise<any>;
  }
}
