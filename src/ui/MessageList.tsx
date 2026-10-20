import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Edit2,
  FileCode,
  FileText,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { AttachedFile, ExecutionState, Message } from '../types';
import { ExecutionProgress } from './ExecutionProgress';

interface MessageListProps {
  messages: Message[];
  activeExecutionState: ExecutionState;
  modelDownloadProgress?: {
    modelId: string;
    progress: number;
    loaded: number;
    total: number;
    file: string;
    text?: string;
  } | null;
  onOpenFile: (path: string) => void;
  onApproveTool: (stepId: string, toolCallId: string) => void;
  onDenyTool: (stepId: string, toolCallId: string) => void;
  onSelectPromptSuggestion: (prompt: string) => void;
  onRedoMessage?: (content: string, attachments?: AttachedFile[]) => void;
  onEditMessage?: (id: string, newContent: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  activeExecutionState,
  modelDownloadProgress,
  onOpenFile,
  onApproveTool,
  onDenyTool,
  onSelectPromptSuggestion,
  onRedoMessage,
  onEditMessage,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages, tokens or state updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, activeExecutionState, modelDownloadProgress]);

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = (msg: Message) => {
    if (editContent.trim() && onEditMessage) {
      onEditMessage(msg.id, editContent.trim());
    }
    setEditingMsgId(null);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDateHeader = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-10 h-10 rounded border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-xl font-bold text-neutral-800 dark:text-neutral-200 mb-3 bg-neutral-50 dark:bg-neutral-900">
          ꫧ
        </div>
        <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Makron LMG
        </h2>
        <p className="text-xs text-neutral-500 max-w-sm mt-1">
          Local SLM multi-step execution pipeline with sandboxed tools and virtual filesystem.
        </p>

        {/* Suggestion buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 max-w-md w-full">
          {[
            'Explain how multi-step reasoning enables small language models',
            'Build an interactive Pomodoro timer in /timer.html',
            'Write a TypeScript function to parse and validate semver strings',
            'Inspect workspace files and synthesize a status report',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => onSelectPromptSuggestion(prompt)}
              className="p-2.5 text-left text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  let lastDateStr = '';

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const msgDateStr = formatDateHeader(msg.timestamp);
          const showDateHeader = msgDateStr !== lastDateStr;
          if (showDateHeader) {
            lastDateStr = msgDateStr;
          }

          const hasThinking =
            !isUser && (msg.roadmap || (msg.executionSteps && msg.executionSteps.length > 0));
          const isRunning = msg.status === 'running';
          const isThinkingOpen =
            expandedThinking[msg.id] ?? (isRunning && activeExecutionState !== 'downloading_model');

          return (
            <React.Fragment key={msg.id}>
              {/* Centered Date Separator */}
              {showDateHeader && (
                <div className="flex items-center my-4 select-none">
                  <div className="flex-1 border-t border-neutral-200 dark:border-neutral-800" />
                  <span className="px-3 text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                    {msgDateStr}
                  </span>
                  <div className="flex-1 border-t border-neutral-200 dark:border-neutral-800" />
                </div>
              )}

              {/* USER MESSAGE: Right Aligned, High Contrast Opposite Surface */}
              {isUser ? (
                <div className="flex flex-col items-end group">
                  {/* Attachments if any */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1 justify-end">
                      {msg.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-1.5 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-[11px] font-mono text-neutral-600 dark:text-neutral-400"
                        >
                          <FileText className="w-3 h-3 text-neutral-500" />
                          <span>{att.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bubble */}
                  <div className="bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900 rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[85%] sm:max-w-[75%] shadow-xs text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words font-sans">
                    {editingMsgId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 p-2 rounded text-xs outline-hidden resize-none border border-neutral-300 dark:border-neutral-700 font-sans"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMsgId(null)}
                            className="px-2 py-0.5 text-[11px] rounded bg-neutral-800 text-neutral-300 dark:bg-neutral-200 dark:text-neutral-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg)}
                            className="px-2 py-0.5 text-[11px] rounded bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white font-medium"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>

                  {/* Actions & Timestamp on Hover */}
                  <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-neutral-400 opacity-60 group-hover:opacity-100 transition-opacity">
                    <span className="font-mono text-[10px]">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Redo Button */}
                    {onRedoMessage && (
                      <button
                        type="button"
                        onClick={() => onRedoMessage(msg.content, msg.attachments)}
                        title="Resend this request"
                        className="p-1 hover:text-neutral-800 dark:hover:text-neutral-200 rounded"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(msg)}
                      title="Edit message"
                      className="p-1 hover:text-neutral-800 dark:hover:text-neutral-200 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>

                    {/* Copy Button */}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      title="Copy text"
                      className="p-1 hover:text-neutral-800 dark:hover:text-neutral-200 rounded"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ) : (
                /* AI MESSAGE: Left Aligned, Distinct Surface, No 'Makron Agent' header */
                <div className="flex flex-col items-start space-y-2 group">
                  {/* Live Model Download Progress Bar */}
                  {isRunning && activeExecutionState === 'downloading_model' && modelDownloadProgress && (
                    <div className="w-full p-3 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 font-mono text-xs">
                      <div className="flex items-center justify-between mb-1.5 text-neutral-700 dark:text-neutral-300 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-neutral-900 dark:bg-neutral-100 animate-pulse" />
                          <span className="font-semibold">Loading SLM Weights: {modelDownloadProgress.modelId}</span>
                        </div>
                        <span>{modelDownloadProgress.progress}%</span>
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-1">
                        <div
                          className="bg-neutral-900 dark:bg-neutral-100 h-full rounded-full transition-all duration-150"
                          style={{ width: `${Math.max(2, modelDownloadProgress.progress)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-400">
                        <span className="truncate max-w-[200px]">{modelDownloadProgress.file || 'Initializing...'}</span>
                        <span>
                          {formatBytes(modelDownloadProgress.loaded)} / {formatBytes(modelDownloadProgress.total)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* "Show Thinking" Collapsible Panel */}
                  {hasThinking && (
                    <div className="w-full">
                      <button
                        type="button"
                        onClick={() => toggleThinking(msg.id)}
                        className="flex items-center gap-2 px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-400 transition-colors select-none"
                      >
                        <Sparkles className="w-3 h-3 text-neutral-500" />
                        <span>{isThinkingOpen ? 'Hide Thinking' : 'Show Thinking'}</span>
                        <span className="text-neutral-400">·</span>
                        <span className="text-neutral-400">
                          {msg.executionSteps?.length || msg.roadmap?.steps.length || 0} steps
                        </span>
                        <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${isThinkingOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isThinkingOpen && (
                        <div className="mt-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
                          <ExecutionProgress
                            state={msg.status === 'running' ? activeExecutionState : (msg.status as any) || 'completed'}
                            roadmap={msg.roadmap}
                            steps={msg.executionSteps}
                            onApproveTool={onApproveTool}
                            onDenyTool={onDenyTool}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quality Review Observation Tag */}
                  {msg.reviewResult && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono py-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                      <span>Quality Review Verified</span>
                      <span aria-hidden="true">·</span>
                      <span>{msg.reviewResult.completenessScore}% Completeness</span>
                    </div>
                  )}

                  {/* Message Content */}
                  {msg.content ? (
                    <div className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed break-words whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>
                  ) : isRunning ? (
                    <div className="text-xs font-mono text-neutral-400 flex items-center gap-1.5 py-1">
                      <span>Reasoning and generating...</span>
                    </div>
                  ) : null}

                  {/* File references chips */}
                  {msg.executionSteps && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Array.from(
                        new Set(msg.executionSteps.flatMap((s) => s.fileChanges?.map((fc) => fc.path) || []))
                      ).map((path) => (
                        <button
                          key={path}
                          onClick={() => onOpenFile(path)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded text-xs font-mono text-neutral-700 dark:text-neutral-300 transition-colors"
                        >
                          <FileCode className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{path}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp & Copy on Hover for AI Message */}
                  <div className="flex items-center gap-2 pt-0.5 text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      title="Copy text"
                      className="hover:text-neutral-700 dark:hover:text-neutral-300"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
