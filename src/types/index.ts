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

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  sizeLabel: string;
  defaultDtype: 'fp32' | 'fp16' | 'q8' | 'q4';
  recommendedDevice: 'webgpu' | 'wasm';
  contextWindow: number;
  isCustom?: boolean;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  defaultModelId: string;
  devicePreference: 'webgpu' | 'wasm';
  autoApproveTools: boolean;
  lastNonEmptySystemPrompt: string;
  maxRepairAttempts: number;
  hfToken?: string;
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
  autoCapabilities: boolean;
}
