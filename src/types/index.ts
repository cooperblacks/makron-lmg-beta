export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  modelId: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  extractedText?: string;
}

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  requiredTools?: string[];
  expectedOutput?: string;
  dependencies?: string[];
}

export interface Roadmap {
  objective: string;
  steps: RoadmapStep[];
  completionCriteria: string[];
}

export interface ToolCallRecord {
  id: string;
  tool: string;
  params: Record<string, any>;
  result?: any;
  error?: string;
  approved?: boolean;
  status: 'pending_approval' | 'running' | 'success' | 'error' | 'denied';
}

export interface ExecutionStepRecord {
  id: string;
  stepNumber: number;
  title: string;
  status: 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  startTime?: number;
  endTime?: number;
  toolCalls?: ToolCallRecord[];
  output?: string;
  error?: string;
  fileChanges?: {
    path: string;
    action: 'create' | 'update' | 'delete';
  }[];
}

export interface ReviewResult {
  passed: boolean;
  completenessScore?: number;
  observations: string[];
  repairNeeded: boolean;
  repairNotes?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: AttachedFile[];
  roadmap?: Roadmap;
  executionSteps?: ExecutionStepRecord[];
  reviewResult?: ReviewResult;
  status?: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
}

export interface VirtualFile {
  id: string;
  conversationId: string;
  path: string;
  content: string;
  mimeType: string;
  updatedAt: number;
  size: number;
  version: number;
}

export interface Checkpoint {
  id: string;
  conversationId: string;
  name: string;
  timestamp: number;
  files: Record<string, string>; // path -> content
}

export type ModelProvider =
  | 'local'
  | 'ollama'
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'grok'
  | 'groq'
  | 'qwen'
  | 'deepseek'
  | 'zai'
  | 'huggingface';

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  sizeLabel: string;
  defaultDtype: 'fp32' | 'fp16' | 'q8' | 'q4';
  recommendedDevice: 'webgpu' | 'wasm';
  contextWindow: number;
  isCustom?: boolean;
  provider?: ModelProvider;
  providerLogo?: string;
  supportsVision?: boolean;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  defaultModelId: string;
  devicePreference: 'webgpu' | 'wasm';
  autoApproveTools: boolean;
  lastNonEmptySystemPrompt: string;
  maxRepairAttempts: number;
  hfToken?: string;
  apiKeys?: Record<string, string>;
  vendorModels?: Record<string, string>;
  ollamaUrl?: string;
}

export type ExecutionState =
  | 'idle'
  | 'downloading_model'
  | 'planning'
  | 'running'
  | 'waiting_approval'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ReasoningLevel = 'auto' | 'low' | 'med' | 'high' | 'max';

export interface AgentCapabilities {
  allowInternet: boolean;
  allowTools: boolean;
  allowFiles: boolean;
  allowImage?: boolean;
  autoCapabilities: boolean;
}

export type UserTier = 'free' | 'paid';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  tier: UserTier;
  agentCount?: number;
  apiKeysConfigured?: string[];
}

export type AgentThemePreset = 'slate' | 'emerald' | 'indigo' | 'crimson' | 'amber' | 'violet' | 'custom';

export interface CustomAgent {
  id: string;
  userId: string;
  customName: string; // The URL slug: /agent/{custom-name}
  displayName: string;
  description?: string;
  avatar: string; // Emoji, SVG, or icon name
  systemPrompt: string; // Context & knowledge base
  effortLevel: ReasoningLevel;
  skills: string[]; // e.g. ['code_execution', 'file_generation', 'web_search', 'doc_extract']
  themeColor: string; // Primary hex color or CSS color
  themePreset: AgentThemePreset;
  allowsFileUploads: boolean;
  embedEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

