import { ExecutionStepRecord, ExecutionState, Roadmap, ReviewResult, ToolCallRecord } from '../types';

export type OrchestratorEvent =
  | { type: 'state_change'; state: ExecutionState; messageId: string }
  | { type: 'model_progress'; messageId: string; modelId: string; progress: number; loaded: number; total: number; file: string; text?: string }
  | { type: 'roadmap_generated'; roadmap: Roadmap; messageId: string }
  | { type: 'step_start'; step: ExecutionStepRecord; messageId: string }
  | { type: 'step_update'; step: ExecutionStepRecord; messageId: string }
  | { type: 'step_token'; token: string; stepId: string; messageId: string }
  | { type: 'tool_call_requested'; toolCall: ToolCallRecord; stepId: string; messageId: string }
  | { type: 'tool_call_completed'; toolCall: ToolCallRecord; stepId: string; messageId: string }
  | { type: 'review_complete'; review: ReviewResult; messageId: string }
  | { type: 'final_token'; token: string; messageId: string }
  | { type: 'file_changed'; path: string; action: 'create' | 'update' | 'delete'; conversationId: string }
  | { type: 'error'; error: string; messageId: string }
  | { type: 'completed'; messageId: string; finalOutput: string };

type Listener = (event: OrchestratorEvent) => void;

class ExecutionEventBus {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: OrchestratorEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    });
  }
}

export const eventBus = new ExecutionEventBus();
