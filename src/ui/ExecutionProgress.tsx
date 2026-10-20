import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  ShieldAlert,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react';
import { ExecutionState, ExecutionStepRecord, Roadmap, ToolCallRecord } from '../types';

interface ExecutionProgressProps {
  state: ExecutionState;
  roadmap?: Roadmap;
  steps?: ExecutionStepRecord[];
  onApproveTool: (stepId: string, toolCallId: string) => void;
  onDenyTool: (stepId: string, toolCallId: string) => void;
}

export const ExecutionProgress: React.FC<ExecutionProgressProps> = ({
  state,
  roadmap,
  steps = [],
  onApproveTool,
  onDenyTool,
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />
            Done
          </span>
        );
      case 'running':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono text-neutral-900 dark:text-neutral-100 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Running
          </span>
        );
      case 'waiting_approval':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            Approval Required
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono text-red-600 dark:text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono text-neutral-500">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-mono text-neutral-400 dark:text-neutral-600">
            <Clock className="w-3.5 h-3.5" />
            Pending
          </span>
        );
    }
  };

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const totalCount = roadmap?.steps.length || steps.length || 0;

  return (
    <div className="my-3 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/70 dark:bg-neutral-900/40 overflow-hidden text-xs">
      {/* Header Bar */}
      <div className="px-3 py-2 bg-neutral-100/70 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {roadmap?.objective || 'Multi-Step Execution Pipeline'}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-neutral-500">
          <span>
            {completedCount}/{totalCount} steps
          </span>
          <span className="capitalize">{state}</span>
        </div>
      </div>

      {/* Step List */}
      <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
        {steps.map((step) => {
          const isExpanded = expandedSteps[step.id] ?? (step.status === 'running' || step.status === 'waiting_approval');
          const elapsed =
            step.startTime && step.endTime
              ? `${((step.endTime - step.startTime) / 1000).toFixed(1)}s`
              : step.startTime
              ? 'active'
              : '';

          return (
            <div key={step.id} className="p-2.5">
              {/* Step summary row */}
              <div
                onClick={() => toggleStep(step.id)}
                className="flex items-center justify-between cursor-pointer select-none group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button className="text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                  <span className="font-mono text-neutral-400 dark:text-neutral-500 text-[11px]">
                    0{step.stepNumber}.
                  </span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {step.title}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 ml-2">
                  {elapsed && (
                    <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                      {elapsed}
                    </span>
                  )}
                  {getStatusBadge(step.status)}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="mt-2.5 pl-6 pr-1 space-y-2 text-[11px]">
                  {/* Tool Calls if any */}
                  {step.toolCalls && step.toolCalls.length > 0 && (
                    <div className="space-y-1.5">
                      {step.toolCalls.map((tc: ToolCallRecord) => (
                        <div
                          key={tc.id}
                          className="p-2 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 font-mono"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-semibold">
                              <Wrench className="w-3 h-3 text-neutral-500" />
                              <span>{tc.tool}</span>
                            </span>
                            <span className="text-[10px] text-neutral-400 uppercase">
                              {tc.status}
                            </span>
                          </div>

                          {/* Parameters */}
                          <div className="text-[10px] text-neutral-500 truncate mb-1">
                            params: {JSON.stringify(tc.params)}
                          </div>

                          {/* Approval Intercept */}
                          {tc.status === 'pending_approval' && (
                            <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-[11px]">
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Sensitive action requires approval: invoke {tc.tool}?</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onDenyTool(step.id, tc.id)}
                                  className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                                >
                                  Deny
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onApproveTool(step.id, tc.id)}
                                  className="px-2 py-0.5 rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium hover:opacity-90 transition-opacity"
                                >
                                  Approve
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Result */}
                          {tc.result && (
                            <div className="text-[10px] text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900 p-1.5 rounded overflow-x-auto max-h-32">
                              {JSON.stringify(tc.result, null, 2)}
                            </div>
                          )}

                          {/* Error */}
                          {tc.error && (
                            <div className="text-[10px] text-red-600 dark:text-red-400 mt-1">
                              Error: {tc.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step output description */}
                  {step.output && (
                    <div className="text-neutral-600 dark:text-neutral-400 leading-relaxed font-mono text-[11px] bg-neutral-100/50 dark:bg-neutral-900/50 p-2 rounded">
                      {step.output}
                    </div>
                  )}

                  {/* Step error */}
                  {step.error && (
                    <div className="text-red-600 dark:text-red-400 font-mono text-[11px]">
                      Error: {step.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
