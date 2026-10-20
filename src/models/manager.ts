import { ModelConfig, ModelProvider } from '../types';
import { generateExternalModel } from './external';

export interface ProgressEventPayload {
  status: 'init' | 'progress' | 'done' | 'ready';
  file: string;
  progress: number;
  loaded: number;
  total: number;
  text?: string;
}

export interface VendorConfig {
  id: ModelProvider;
  name: string;
  logo: string;
  defaultModel: string;
  keyPlaceholder: string;
  description: string;
}

export const VENDOR_CONFIGS: VendorConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    logo: 'openai.jpg',
    defaultModel: 'gpt-4o',
    keyPlaceholder: 'sk-proj-...',
    description: 'Frontier omni-modal model with advanced reasoning, coding, and vision analysis.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    logo: 'gemini.jpg',
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIzaSy...',
    description: 'Ultra-fast multimodal reasoning with 1M token context window and native vision.',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    logo: 'claude.jpg',
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPlaceholder: 'sk-ant-api03-...',
    description: 'Industry-standard coding intelligence, nuanced writing, and visual reasoning.',
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    logo: 'grok.jpg',
    defaultModel: 'grok-2-latest',
    keyPlaceholder: 'xai-...',
    description: 'Real-time frontier intelligence and reasoning model from xAI.',
  },
  {
    id: 'groq',
    name: 'Groq',
    logo: 'groq.jpg',
    defaultModel: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'gsk_...',
    description: 'LPU hardware engine delivering extreme inference speed over 250 tok/s.',
  },
  {
    id: 'qwen',
    name: 'Alibaba Cloud Qwen',
    logo: 'qwen.jpg',
    defaultModel: 'qwen-2.5-72b-instruct',
    keyPlaceholder: 'sk-...',
    description: 'Premier multilingual open-weights architecture with strong mathematics.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: 'deepseek.jpg',
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
    description: 'State-of-the-art MoE architecture delivering competitive code generation.',
  },
  {
    id: 'zai',
    name: 'Zhipu AI (GLM)',
    logo: 'zai.jpg',
    defaultModel: 'glm-4-plus',
    keyPlaceholder: 'your-api-key...',
    description: 'Bilingual frontier model with robust semantic reasoning and tool use.',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Inference',
    logo: 'huggingface.jpg',
    defaultModel: 'meta-llama/Llama-3.1-8B-Instruct',
    keyPlaceholder: 'hf_...',
    description: 'Serverless cloud inference powered by your Hugging Face user token.',
  },
];

export const AVAILABLE_MODELS: ModelConfig[] = [
  // --- Browser-Based Local SLMs (SmolLM2 135M Default First) ---
  {
    id: 'onnx-community/SmolLM2-135M-Instruct-ONNX',
    name: 'SmolLM2 (135M Instruct)',
    description: 'Ultra-lightweight instant inference model for constrained environments and mobile devices.',
    sizeLabel: '~90 MB (q4)',
    defaultDtype: 'q4',
    recommendedDevice: 'wasm',
    contextWindow: 2048,
    provider: 'local',
    supportsVision: false,
  },
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen 2.5 (0.5B Instruct)',
    description: 'Optimal balance of reasoning, tool following, and low memory footprint in Transformers.js.',
    sizeLabel: '~350 MB (q4)',
    defaultDtype: 'q4',
    recommendedDevice: 'webgpu',
    contextWindow: 4096,
    provider: 'local',
    supportsVision: false,
  },
  {
    id: 'onnx-community/SmolLM2-360M-Instruct-ONNX',
    name: 'SmolLM2 (360M Instruct)',
    description: 'Fast mobile-friendly model optimized for synthetic reasoning and structured tasks.',
    sizeLabel: '~210 MB (q4)',
    defaultDtype: 'q4',
    recommendedDevice: 'wasm',
    contextWindow: 2048,
    provider: 'local',
    supportsVision: false,
  },
  {
    id: 'Xenova/Qwen1.5-0.5B-Chat',
    name: 'Qwen 1.5 (0.5B Chat)',
    description: 'Proven public Xenova ONNX repository with direct CDN mirror.',
    sizeLabel: '~300 MB (q4)',
    defaultDtype: 'q4',
    recommendedDevice: 'wasm',
    contextWindow: 2048,
    provider: 'local',
    supportsVision: false,
  },
];

export function isVisionCapable(modelIdentifier: string): boolean {
  const lower = modelIdentifier.toLowerCase();
  return (
    lower.includes('gpt-4o') ||
    lower.includes('gemini') ||
    lower.includes('claude-3') ||
    lower.includes('grok-2') ||
    lower.includes('glm-4') ||
    lower.includes('vl') ||
    lower.includes('vision')
  );
}

export function resolveModelDetails(
  modelId: string,
  vendorModels: Record<string, string> = {}
): {
  id: string;
  name: string;
  provider: ModelProvider;
  providerLogo?: string;
  isLocal: boolean;
  modelIdentifier: string;
  supportsVision: boolean;
} {
  const local = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (local) {
    return {
      id: local.id,
      name: local.name,
      provider: 'local',
      isLocal: true,
      modelIdentifier: local.id,
      supportsVision: !!local.supportsVision,
    };
  }

  // Parse vendor:modelId or vendor/modelId or just vendor
  const separatorIndex = modelId.indexOf(':') !== -1 ? modelId.indexOf(':') : modelId.indexOf('/');
  const vendorKey = (separatorIndex !== -1 ? modelId.substring(0, separatorIndex) : modelId) as ModelProvider;
  const specifiedModel = separatorIndex !== -1 ? modelId.substring(separatorIndex + 1) : '';

  if (vendorKey === 'ollama') {
    const activeModelId = specifiedModel || vendorModels['ollama'] || 'llama3.2';
    return {
      id: `ollama:${activeModelId}`,
      name: `Ollama (${activeModelId})`,
      provider: 'ollama',
      providerLogo: undefined,
      isLocal: false,
      modelIdentifier: activeModelId,
      supportsVision: isVisionCapable(activeModelId),
    };
  }

  const vendor = VENDOR_CONFIGS.find((v) => v.id === vendorKey);
  if (vendor) {
    const activeModelId = specifiedModel || vendorModels[vendor.id] || vendor.defaultModel;
    return {
      id: `${vendor.id}:${activeModelId}`,
      name: `${vendor.name} (${activeModelId})`,
      provider: vendor.id,
      providerLogo: vendor.logo,
      isLocal: false,
      modelIdentifier: activeModelId,
      supportsVision: isVisionCapable(activeModelId),
    };
  }

  // Fallback to local default
  return {
    id: AVAILABLE_MODELS[0].id,
    name: AVAILABLE_MODELS[0].name,
    provider: 'local',
    isLocal: true,
    modelIdentifier: AVAILABLE_MODELS[0].id,
    supportsVision: false,
  };
}

export class ModelManager {
  private static instance: ModelManager;
  private worker: Worker | null = null;
  private isLoaded = false;
  private currentModelId: string | null = null;
  private currentDevice: 'webgpu' | 'wasm' = 'wasm';
  private hasWebGpuSupport = false;
  private progressListeners: Set<(p: ProgressEventPayload) => void> = new Set();

  // Guard against concurrent duplicate downloads of the same SLM
  private activeLoadingModelId: string | null = null;
  private activeLoadingPromise: Promise<void> | null = null;

  // Track monotonic smoothed progress to eliminate elastic band jumping
  private maxObservedProgress = 0;

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
        if (typeof data.progress === 'number') {
          if (data.status === 'init') {
            this.maxObservedProgress = 0;
          } else {
            this.maxObservedProgress = Math.max(this.maxObservedProgress, data.progress);
            data.progress = this.maxObservedProgress;
          }
        }
        this.progressListeners.forEach((l) => l(data));
      } else if (type === 'LOAD_COMPLETE') {
        this.isLoaded = true;
        this.currentModelId = data.modelId;
        this.maxObservedProgress = 100;
        this.progressListeners.forEach((l) =>
          l({ status: 'ready', file: data.modelId, progress: 100, loaded: 1, total: 1 })
        );
      } else if (type === 'LOAD_ERROR') {
        this.isLoaded = false;
        this.maxObservedProgress = 0;
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
    const details = resolveModelDetails(modelId);

    // If external vendor model, no weights download needed
    if (!details.isLocal) {
      this.isLoaded = true;
      this.currentModelId = modelId;
      this.progressListeners.forEach((l) =>
        l({ status: 'ready', file: modelId, progress: 100, loaded: 1, total: 1 })
      );
      return;
    }

    // If already loaded in memory, don't re-download
    if (this.isLoaded && this.currentModelId === modelId) {
      return;
    }

    // If already currently downloading/loading this exact model, return existing promise
    if (this.activeLoadingModelId === modelId && this.activeLoadingPromise) {
      return this.activeLoadingPromise;
    }

    this.initWorker();
    this.maxObservedProgress = 0;

    const device = preferredDevice || (this.hasWebGpuSupport ? 'webgpu' : 'wasm');
    this.currentDevice = device;
    this.activeLoadingModelId = modelId;

    this.activeLoadingPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Model download/load timed out for ${modelId}`));
      }, 240000); // 4 minutes max

      const cleanup = () => {
        clearTimeout(timeout);
        this.worker?.removeEventListener('message', handler);
        this.activeLoadingModelId = null;
        this.activeLoadingPromise = null;
      };

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'LOAD_COMPLETE' && e.data.data.modelId === modelId) {
          cleanup();
          resolve();
        } else if (e.data.type === 'LOAD_ERROR' && e.data.data.modelId === modelId) {
          cleanup();
          reject(new Error(e.data.data.error || 'Failed to load model'));
        }
      };

      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage({
        type: 'LOAD_MODEL',
        data: { modelId, device, dtype, hfToken },
      });
    });

    return this.activeLoadingPromise;
  }

  abortGeneration() {
    if (this.worker) {
      this.worker.postMessage({ type: 'ABORT' });
    }
  }

  async generate(options: {
    modelId?: string;
    provider?: string;
    apiKey?: string;
    ollamaUrl?: string;
    vendorModels?: Record<string, string>;
    messages?: Array<{ role: string; content: string }>;
    prompt?: string;
    maxNewTokens?: number;
    temperature?: number;
    onToken?: (token: string) => void;
    signal?: AbortSignal;
  }): Promise<string> {
    const targetModelId = options.modelId || this.currentModelId || AVAILABLE_MODELS[0].id;
    const details = resolveModelDetails(targetModelId, options.vendorModels);

    // If external cloud API model or Ollama
    if (!details.isLocal) {
      return generateExternalModel({
        modelId: details.modelIdentifier,
        provider: details.provider,
        apiKey: options.apiKey || '',
        ollamaUrl: options.ollamaUrl,
        messages: options.messages || (options.prompt ? [{ role: 'user', content: options.prompt }] : []),
        prompt: options.prompt,
        temperature: options.temperature,
        maxTokens: options.maxNewTokens || 1500,
        onToken: options.onToken,
        signal: options.signal,
      });
    }

    // Otherwise, local Web Worker generation
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
