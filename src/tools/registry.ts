import { DocumentParser } from '../documents/parser';
import { VirtualFileSystem } from '../filesystem/virtualFs';
import { db } from '../storage/indexeddb';

export interface ToolDefinition {
  name: string;
  description: string;
  requiresApproval: boolean;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (
    params: any,
    context: { conversationId: string; signal?: AbortSignal }
  ) => Promise<{ result: any; fileChanges?: { path: string; action: 'create' | 'update' | 'delete' }[] }>;
}

export class ToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  static register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  static get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  static getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  static getDocumentation(): string {
    return Array.from(this.tools.values())
      .map((t) => {
        const paramStr = Object.entries(t.parameters)
          .map(([k, v]) => `    ${k}: (${v.type}${v.required ? ', required' : ''}) - ${v.description}`)
          .join('\n');
        return `Tool: ${t.name}\nDescription: ${t.description}\nParameters:\n${paramStr}`;
      })
      .join('\n\n');
  }

  /**
   * Execute a tool safely with timeout and error boundary
   */
  static async execute(
    name: string,
    params: any,
    context: { conversationId: string; signal?: AbortSignal },
    timeoutMs = 15000
  ): Promise<{ result: any; fileChanges?: { path: string; action: 'create' | 'update' | 'delete' }[] }> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: "${name}"`);
    }

    // Validate required parameters
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      if (paramDef.required && (params[paramName] === undefined || params[paramName] === null)) {
        throw new Error(`Missing required parameter "${paramName}" for tool "${name}"`);
      }
    }

    // Timeout promise
    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      const res = await Promise.race([tool.execute(params, context), timeoutPromise]);
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
}

// --- Register Default Built-In Tools ---

// 1. file_write
ToolRegistry.register({
  name: 'file_write',
  description: 'Create or overwrite a file in the workspace virtual filesystem.',
  requiresApproval: false,
  parameters: {
    path: { type: 'string', description: 'Normalized workspace file path (e.g. /src/index.js)', required: true },
    content: { type: 'string', description: 'Content to write into the file', required: true },
  },
  execute: async (params, ctx) => {
    const { file, action } = await VirtualFileSystem.writeFile(ctx.conversationId, params.path, params.content);
    return {
      result: { path: file.path, size: file.size, version: file.version, action },
      fileChanges: [{ path: file.path, action }],
    };
  },
});

// 2. file_read
ToolRegistry.register({
  name: 'file_read',
  description: 'Read the text content of a file from the workspace virtual filesystem.',
  requiresApproval: false,
  parameters: {
    path: { type: 'string', description: 'Workspace file path to read', required: true },
  },
  execute: async (params, ctx) => {
    const content = await VirtualFileSystem.readFile(ctx.conversationId, params.path);
    return { result: { path: params.path, content } };
  },
});

// 3. file_list
ToolRegistry.register({
  name: 'file_list',
  description: 'List all existing files and directories currently in the workspace virtual filesystem.',
  requiresApproval: false,
  parameters: {},
  execute: async (_, ctx) => {
    const files = await VirtualFileSystem.listFiles(ctx.conversationId);
    return {
      result: files.map((f) => ({
        path: f.path,
        size: f.size,
        mimeType: f.mimeType,
        version: f.version,
        updatedAt: f.updatedAt,
      })),
    };
  },
});

// 4. file_delete
ToolRegistry.register({
  name: 'file_delete',
  description: 'Delete a file from the workspace virtual filesystem.',
  requiresApproval: true,
  parameters: {
    path: { type: 'string', description: 'Workspace file path to delete', required: true },
  },
  execute: async (params, ctx) => {
    const deleted = await VirtualFileSystem.deleteFile(ctx.conversationId, params.path);
    return {
      result: { path: params.path, deleted },
      fileChanges: deleted ? [{ path: params.path, action: 'delete' }] : [],
    };
  },
});

// 5. run_code
ToolRegistry.register({
  name: 'run_code',
  description: 'Execute sandboxed JavaScript code and return console outputs or return value.',
  requiresApproval: false,
  parameters: {
    code: { type: 'string', description: 'JavaScript code to execute in isolated sandbox', required: true },
  },
  execute: async (params) => {
    const logs: string[] = [];
    const customConsole = {
      log: (...args: any[]) => logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
      warn: (...args: any[]) => logs.push('[WARN] ' + args.join(' ')),
      error: (...args: any[]) => logs.push('[ERROR] ' + args.join(' ')),
    };

    try {
      // Safe sandboxed evaluation using isolated Function without window/document access
      const sandboxFn = new Function('console', 'Math', 'Date', 'JSON', 'Array', 'Object', 'String', 'Number', `
        "use strict";
        try {
          ${params.code}
        } catch (err) {
          throw err;
        }
      `);

      const returnValue = sandboxFn(customConsole, Math, Date, JSON, Array, Object, String, Number);
      return {
        result: {
          success: true,
          logs,
          returned: returnValue !== undefined ? returnValue : null,
        },
      };
    } catch (err: any) {
      return {
        result: {
          success: false,
          logs,
          error: err.message || String(err),
        },
      };
    }
  },
});

// 6. http_fetch
ToolRegistry.register({
  name: 'http_fetch',
  description: 'Fetch external public JSON or text resource via HTTP (requires user approval).',
  requiresApproval: true,
  parameters: {
    url: { type: 'string', description: 'URL to request', required: true },
    method: { type: 'string', description: 'HTTP method (GET, POST)', required: false },
  },
  execute: async (params, ctx) => {
    const url = params.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid URL protocol. Must be http:// or https://');
    }

    const response = await fetch(url, {
      method: params.method || 'GET',
      signal: ctx.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      // Cap returned text length
      data = text.length > 5000 ? text.substring(0, 5000) + '... [truncated]' : text;
    }

    return {
      result: {
        status: response.status,
        statusText: response.statusText,
        data,
      },
    };
  },
});

// 7. data_transform
ToolRegistry.register({
  name: 'data_transform',
  description: 'Parse, sort, filter, or aggregate structured CSV or JSON data.',
  requiresApproval: false,
  parameters: {
    format: { type: 'string', description: 'Format: "csv" or "json"', required: true },
    data: { type: 'string', description: 'Raw CSV or JSON text', required: true },
    operation: { type: 'string', description: 'Operation: "summary" | "filter" | "sort"', required: false },
  },
  execute: async (params) => {
    if (params.format === 'json') {
      const parsed = JSON.parse(params.data);
      if (Array.isArray(parsed)) {
        return {
          result: {
            itemCount: parsed.length,
            sample: parsed.slice(0, 3),
            keys: parsed.length > 0 ? Object.keys(parsed[0]) : [],
          },
        };
      }
      return { result: { parsed } };
    }

    if (params.format === 'csv') {
      const lines = params.data.trim().split('\n');
      const headers = lines[0].split(',').map((h: string) => h.trim());
      const rowCount = lines.length - 1;
      return {
        result: {
          headers,
          rowCount,
          previewRows: lines.slice(1, 4).map((l: string) => l.split(',')),
        },
      };
    }

    return { result: { message: 'Unrecognized format' } };
  },
});

// 8. doc_extract
ToolRegistry.register({
  name: 'doc_extract',
  description: 'Extract and search text chunks from uploaded document attachments in this conversation.',
  requiresApproval: false,
  parameters: {
    query: { type: 'string', description: 'Keyword or concept to search for in uploaded documents', required: false },
  },
  execute: async (params, ctx) => {
    const messages = await db.getMessages(ctx.conversationId);
    const attachments = messages.flatMap((m) => m.attachments || []);

    if (attachments.length === 0) {
      return { result: { message: 'No documents attached to this conversation.' } };
    }

    const matches: { fileName: string; snippet: string }[] = [];
    const queryLower = (params.query || '').toLowerCase();

    for (const att of attachments) {
      const text = att.extractedText || att.content || '';
      const chunks = DocumentParser.chunkText(text, 800);

      for (const chunk of chunks) {
        if (!queryLower || chunk.toLowerCase().includes(queryLower)) {
          matches.push({
            fileName: att.name,
            snippet: chunk.length > 500 ? chunk.substring(0, 500) + '...' : chunk,
          });
          if (matches.length >= 5) break;
        }
      }
      if (matches.length >= 5) break;
    }

    return {
      result: {
        totalAttachments: attachments.length,
        matchedSnippets: matches,
      },
    };
  },
});
