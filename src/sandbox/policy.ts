import type { AppConfig } from '../config/schema.js';
import { relative, isAbsolute } from 'node:path';

export type SandboxDecision = {
  allowed: boolean;
  reason?: string;
};

export class SandboxPolicy {
  constructor(private readonly config: AppConfig['sandbox']) {}

  describe() {
    const blockedActions = ['unapproved_network', 'unsafe_shell'];
    if (!this.config.allowPersistentWrites) blockedActions.push('persistent_write');
    if (!this.config.allowDeletes) blockedActions.push('delete');

    return {
      workspaceRoot: this.config.workspaceRoot,
      allowNetwork: this.config.allowNetwork,
      allowPersistentWrites: this.config.allowPersistentWrites,
      allowDeletes: this.config.allowDeletes,
      maxExecutionMs: this.config.maxExecutionMs,
      blockedActions,
    };
  }

  private isPathSafe(targetPath: string): boolean {
    const relativePath = relative(this.config.workspaceRoot, targetPath);
    return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath);
  }

  canRead(targetPath: string): SandboxDecision {
    if (targetPath !== this.config.workspaceRoot && !this.isPathSafe(targetPath)) {
      return { allowed: false, reason: 'path is outside sandbox workspace root' };
    }
    return { allowed: true };
  }

  canExecute(): SandboxDecision {
    // Basic policy allows execution but maxExecutionMs is enforced by the caller
    return { allowed: true };
  }

  canWrite(targetPath: string): SandboxDecision {
    if (targetPath !== this.config.workspaceRoot && !this.isPathSafe(targetPath)) {
      return { allowed: false, reason: 'path is outside sandbox workspace root' };
    }

    if (!this.config.allowPersistentWrites) {
      return { allowed: false, reason: 'persistent writes are disabled' };
    }

    return { allowed: true };
  }

  canDelete(targetPath: string): SandboxDecision {
    if (targetPath !== this.config.workspaceRoot && !this.isPathSafe(targetPath)) {
      return { allowed: false, reason: 'path is outside sandbox workspace root' };
    }

    if (!this.config.allowDeletes) {
      return { allowed: false, reason: 'delete operations require explicit host approval' };
    }

    return { allowed: true };
  }

  canUseNetwork(): SandboxDecision {
    return this.config.allowNetwork
      ? { allowed: true }
      : { allowed: false, reason: 'network access is disabled in sandbox policy' };
  }
}
