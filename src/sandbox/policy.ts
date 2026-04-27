import type { AppConfig } from '../config/schema.js';

export type SandboxDecision = {
  allowed: boolean;
  reason?: string;
};

export class SandboxPolicy {
  constructor(private readonly config: AppConfig['sandbox']) {}

  describe() {
    return {
      workspaceRoot: this.config.workspaceRoot,
      allowNetwork: this.config.allowNetwork,
      allowPersistentWrites: this.config.allowPersistentWrites,
      maxExecutionMs: this.config.maxExecutionMs,
      blockedActions: ['delete', 'persistent_write', 'unapproved_network', 'unsafe_shell'],
    };
  }

  canRead(path: string): SandboxDecision {
    if (!path.startsWith(this.config.workspaceRoot)) {
      return { allowed: false, reason: 'path is outside sandbox workspace root' };
    }
    return { allowed: true };
  }

  canExecute(): SandboxDecision {
    // Basic policy allows execution but maxExecutionMs is enforced by the caller
    return { allowed: true };
  }

  canWrite(path: string): SandboxDecision {
    if (!path.startsWith(this.config.workspaceRoot)) {
      return { allowed: false, reason: 'path is outside sandbox workspace root' };
    }

    if (!this.config.allowPersistentWrites) {
      return { allowed: false, reason: 'persistent writes are disabled' };
    }

    return { allowed: true };
  }

  canDelete(): SandboxDecision {
    return { allowed: false, reason: 'delete operations require explicit host approval' };
  }

  canUseNetwork(): SandboxDecision {
    return this.config.allowNetwork
      ? { allowed: true }
      : { allowed: false, reason: 'network access is disabled in sandbox policy' };
  }
}
