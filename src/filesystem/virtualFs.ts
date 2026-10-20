import JSZip from 'jszip';
import { db } from '../storage/indexeddb';
import { Checkpoint, VirtualFile } from '../types';

export class VirtualFileSystem {
  private static MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  /**
   * Sanitizes and normalizes virtual file paths to prevent traversal attacks.
   * Ensures paths start with '/' and contain no '..' components.
   */
  static normalizePath(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') {
      throw new Error('Invalid path: path must be a non-empty string');
    }

    // Strip forbidden characters or null bytes
    let clean = rawPath.replace(/\0/g, '').trim();

    // Replace backslashes
    clean = clean.replace(/\\/g, '/');

    // Split segments and eliminate empty or relative traversal
    const segments = clean.split('/').filter(Boolean);
    const resolved: string[] = [];

    for (const segment of segments) {
      if (segment === '.') continue;
      if (segment === '..') {
        if (resolved.length > 0) resolved.pop();
        continue;
      }
      // Check segment validity
      if (/[<>:"|?*]/.test(segment)) {
        throw new Error(`Invalid characters in filename segment: ${segment}`);
      }
      resolved.push(segment);
    }

    return '/' + resolved.join('/');
  }

  static getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html': return 'text/html';
      case 'css': return 'text/css';
      case 'js': return 'application/javascript';
      case 'ts': return 'text/typescript';
      case 'jsx': case 'tsx': return 'text/plain';
      case 'json': return 'application/json';
      case 'md': return 'text/markdown';
      case 'csv': return 'text/csv';
      case 'svg': return 'image/svg+xml';
      case 'py': return 'text/x-python';
      default: return 'text/plain';
    }
  }

  /**
   * Write or update a file in the workspace
   */
  static async writeFile(
    conversationId: string,
    rawPath: string,
    content: string
  ): Promise<{ file: VirtualFile; action: 'create' | 'update' }> {
    const path = this.normalizePath(rawPath);

    if (new Blob([content]).size > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of 5MB: ${path}`);
    }

    const existing = await db.getFileByPath(conversationId, path);
    const now = Date.now();
    const mimeType = this.getMimeType(path);
    const size = new Blob([content]).size;

    if (existing) {
      const updated: VirtualFile = {
        ...existing,
        content,
        mimeType,
        size,
        updatedAt: now,
        version: (existing.version || 1) + 1,
      };
      await db.saveFile(updated);
      return { file: updated, action: 'update' };
    } else {
      const created: VirtualFile = {
        id: 'vf_' + Math.random().toString(36).substring(2, 11),
        conversationId,
        path,
        content,
        mimeType,
        size,
        updatedAt: now,
        version: 1,
      };
      await db.saveFile(created);
      return { file: created, action: 'create' };
    }
  }

  /**
   * Read file content
   */
  static async readFile(conversationId: string, rawPath: string): Promise<string> {
    const path = this.normalizePath(rawPath);
    const file = await db.getFileByPath(conversationId, path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    return file.content;
  }

  /**
   * Delete file
   */
  static async deleteFile(conversationId: string, rawPath: string): Promise<boolean> {
    const path = this.normalizePath(rawPath);
    const file = await db.getFileByPath(conversationId, path);
    if (!file) return false;
    await db.deleteFile(file.id);
    return true;
  }

  /**
   * Rename or move a file
   */
  static async moveFile(conversationId: string, oldRawPath: string, newRawPath: string): Promise<VirtualFile> {
    const oldPath = this.normalizePath(oldRawPath);
    const newPath = this.normalizePath(newRawPath);

    const file = await db.getFileByPath(conversationId, oldPath);
    if (!file) {
      throw new Error(`Source file not found: ${oldPath}`);
    }

    // Delete old
    await db.deleteFile(file.id);

    // Create new
    const updated: VirtualFile = {
      ...file,
      path: newPath,
      mimeType: this.getMimeType(newPath),
      updatedAt: Date.now(),
      version: file.version + 1,
    };
    await db.saveFile(updated);
    return updated;
  }

  /**
   * List all files in the workspace
   */
  static async listFiles(conversationId: string): Promise<VirtualFile[]> {
    return await db.getFiles(conversationId);
  }

  /**
   * Create a checkpoint snapshot of the current workspace
   */
  static async createCheckpoint(conversationId: string, name: string): Promise<Checkpoint> {
    const files = await db.getFiles(conversationId);
    const snapshot: Record<string, string> = {};
    for (const f of files) {
      snapshot[f.path] = f.content;
    }

    const checkpoint: Checkpoint = {
      id: 'cp_' + Math.random().toString(36).substring(2, 11),
      conversationId,
      name,
      timestamp: Date.now(),
      files: snapshot,
    };

    await db.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  /**
   * Rollback workspace to a previous checkpoint
   */
  static async rollbackToCheckpoint(conversationId: string, checkpointId: string): Promise<void> {
    const checkpoints = await db.getCheckpoints(conversationId);
    const target = checkpoints.find((cp) => cp.id === checkpointId);
    if (!target) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Wipe current files
    const currentFiles = await db.getFiles(conversationId);
    for (const f of currentFiles) {
      await db.deleteFile(f.id);
    }

    // Restore files
    for (const [path, content] of Object.entries(target.files)) {
      await this.writeFile(conversationId, path, content);
    }
  }

  /**
   * Export workspace as ZIP blob
   */
  static async exportZip(conversationId: string): Promise<Blob> {
    const files = await db.getFiles(conversationId);
    const zip = new JSZip();

    for (const f of files) {
      // Remove leading slash for zip relative structure
      const zipPath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      zip.file(zipPath, f.content);
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Generate simple line-by-line diff between two strings
   */
  static computeDiff(oldText: string, newText: string): { type: 'same' | 'added' | 'removed'; text: string }[] {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const diff: { type: 'same' | 'added' | 'removed'; text: string }[] = [];

    let i = 0;
    let j = 0;
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        diff.push({ type: 'same', text: oldLines[i] });
        i++;
        j++;
      } else if (j < newLines.length && (!oldLines.includes(newLines[j]) || i >= oldLines.length)) {
        diff.push({ type: 'added', text: newLines[j] });
        j++;
      } else if (i < oldLines.length) {
        diff.push({ type: 'removed', text: oldLines[i] });
        i++;
      } else {
        j++;
      }
    }
    return diff;
  }
}
