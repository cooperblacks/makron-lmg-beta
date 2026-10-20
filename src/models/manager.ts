import { ModelConfig } from '../types';

export interface ProgressEventPayload {
  status: 'init' | 'progress' | 'done' | 'ready';
  file: string;
  progress: number;
  loaded: number;
  total: number;
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen 2.5 (0.5B Instruct)',
    description: 'Optimal balance of reasoning, tool following, and low memory footprint.',
    sizeLabel: '~350 MB (q4)',
    defaultDtype: 'q4',
    recommendedDevice: 'webgpu',
    contextWindow: 4096,
  },
  {
    id: 'onnx-community/SmolLM2-135M-Instruct-ONNX',
    name: 'SmolLM2 (135M Instruct)',
    description: 'Ultra-lightweight instant inference model for constrained environments.',
    sizeLabel: '~90 MB (q4)',
    defaultDtype: 'q4',
    recommendedDevice: 'wasm',
    contextWindow: 2048,
  },
  {
    id: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
    name: 'SmolLM2 (360M Instruct)',
    description: 'Fast mobile-friendly model optimized for synthetic reasoning and structured tasks.',
    sizeLabel: '~210 MB (q4)',
    defaultDtype: 'q4',
    recommendedDevice: 'wasm',
    contextWindow: 2048,
  },
  {
    id: 'Xenova/Qwen1.5-0.5B-Chat',
    name: 'Qwen 1.5 (0.5B Chat)',
    description: 'Proven public Xenova ONNX repository with direct CDN mirror.',
    sizeLabel: '~300 MB (q4)',
    defaultDtype: 'q4',
    recommendedDevice: 'wasm',
    contextWindow: 2048,
  },
];

export class ModelManager {
  private static instance: ModelManager;
  private worker: Worker | null = null;
  private isLoaded = false;
  private currentModelId: string | null = null;
  private currentDevice: 'webgpu' | 'wasm' = 'wasm';
  private hasWebGpuSupport = false;
  private progressListeners: Set<(p: ProgressEventPayload) => void> = new Set();
  private pendingGenerations: Map<
    string,
    {
      resolve: (text: string) => void;
      reject: (err: any) => void;
      onToken?: (t: string) => void;
    }
  > = new Map();

  private constructor() {
    this.detectWebGpu();
  }

  static getInstance(): ModelManager {
    if (!this.instance) {
      this.instance = new ModelManager();
    }
    return this.instance;
  }

  private async detectWebGpu() {
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        this.hasWebGpuSupport = !!adapter;
      } catch {
        this.hasWebGpuSupport = false;
      }
    }
  }

  getHasWebGpu(): boolean {
    return this.hasWebGpuSupport;
  }

  getCurrentModelId(): string | null {
    return this.currentModelId;
  }

  getIsLoaded(): boolean {
    return this.isLoaded;
  }

  onProgress(cb: (p: ProgressEventPayload) => void): () => void {
    this.progressListeners.add(cb);
    return () => this.progressListeners.delete(cb);
  }

  private initWorker() {
    if (this.worker) return;

    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (e: MessageEvent) => {
      const { type, data } = e.data;

      if (type === 'PROGRESS') {
        this.progressListeners.forEach((l) => l(data));
      } else if (type === 'LOAD_COMPLETE') {
        this.isLoaded = true;
        this.currentModelId = data.modelId;
        this.progressListeners.forEach((l) =>
          l({ status: 'ready', file: data.modelId, progress: 100, loaded: 1, total: 1 })
        );
      } else if (type === 'LOAD_ERROR') {
        this.isLoaded = false;
        this.progressListeners.forEach((l) =>
          l({ status: 'done', file: data.modelId, progress: 0, loaded: 0, total: 0 })
        );
        console.error('Model load error:', data.error);
      } else if (type === 'TOKEN') {
        const gen = this.pendingGenerations.get(data.id);
        if (gen && gen.onToken) {
          gen.onToken(data.token);
        }
      } else if (type === 'GENERATE_COMPLETE') {
        const gen = this.pendingGenerations.get(data.id);
        if (gen) {
          gen.resolve(data.fullText);
          this.pendingGenerations.delete(data.id);
        }
      } else if (type === 'GENERATE_CANCELLED') {
        const gen = this.pendingGenerations.get(data.id);
        if (gen) {
          gen.reject(new Error('GENERATION_CANCELLED'));
          this.pendingGenerations.delete(data.id);
        }
      } else if (type === 'GENERATE_ERROR') {
        const gen = this.pendingGenerations.get(data.id);
        if (gen) {
          gen.reject(new Error(data.error));
          this.pendingGenerations.delete(data.id);
        }
      }
    };
  }

  async loadModel(modelId: string, preferredDevice?: 'webgpu' | 'wasm', dtype = 'q4', hfToken?: string): Promise<void> {
    this.initWorker();

    const device = preferredDevice || (this.hasWebGpuSupport ? 'webgpu' : 'wasm');
    this.currentDevice = device;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Model download/load timed out for ${modelId}`));
      }, 180000); // 3 minutes max

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'LOAD_COMPLETE' && e.data.data.modelId === modelId) {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', handler);
          resolve();
        } else if (e.data.type === 'LOAD_ERROR' && e.data.data.modelId === modelId) {
          clearTimeout(timeout);
          this.worker?.removeEventListener('message', handler);
          reject(new Error(e.data.data.error || 'Failed to load model'));
        }
      };

      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage({
        type: 'LOAD_MODEL',
        data: { modelId, device, dtype, hfToken },
      });
    });
  }

  abortGeneration() {
    if (this.worker) {
      this.worker.postMessage({ type: 'ABORT' });
    }
  }

  async generate(options: {
    messages?: Array<{ role: string; content: string }>;
    prompt?: string;
    maxNewTokens?: number;
    temperature?: number;
    onToken?: (token: string) => void;
    signal?: AbortSignal;
  }): Promise<string> {
    this.initWorker();

    const id = 'gen_' + Math.random().toString(36).substring(2, 9);

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        this.abortGeneration();
      });
    }

    return new Promise((resolve, reject) => {
      this.pendingGenerations.set(id, {
        resolve,
        reject,
        onToken: options.onToken,
      });

      this.worker!.postMessage({
        type: 'GENERATE',
        data: {
          id,
          messages: options.messages,
          prompt: options.prompt,
          max_new_tokens: options.maxNewTokens || 512,
          temperature: options.temperature || 0.2,
        },
      });
    });
  }
}

export const modelManager = ModelManager.getInstance();
