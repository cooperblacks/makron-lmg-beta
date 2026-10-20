import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Cpu,
  FileCode2,
  FileText,
  Globe,
  Mic,
  MicOff,
  Paperclip,
  Sparkles,
  Square,
  Wrench,
  X,
} from 'lucide-react';
import { AVAILABLE_MODELS, modelManager } from '../models/manager';
import { DocumentParser } from '../documents/parser';
import { AgentCapabilities, AttachedFile, ExecutionState, ReasoningLevel } from '../types';

interface ComposerProps {
  onSendMessage: (
    content: string,
    attachments: AttachedFile[],
    options?: {
      reasoningLevel: ReasoningLevel;
      capabilities: AgentCapabilities;
    }
  ) => void;
  onCancelExecution: () => void;
  executionState: ExecutionState;
  disabled?: boolean;
  reasoningLevel: ReasoningLevel;
  onChangeReasoningLevel: (level: ReasoningLevel) => void;
  capabilities: AgentCapabilities;
  onChangeCapabilities: (caps: AgentCapabilities) => void;
  currentModelId?: string;
  onOpenModels?: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  onSendMessage,
  onCancelExecution,
  executionState,
  disabled = false,
  reasoningLevel,
  onChangeReasoningLevel,
  capabilities,
  onChangeCapabilities,
  currentModelId,
  onOpenModels,
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const isRunning =
    executionState === 'planning' ||
    executionState === 'running' ||
    executionState === 'waiting_approval' ||
    executionState === 'reviewing' ||
    executionState === 'downloading_model';

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === currentModelId) || AVAILABLE_MODELS[0];
  const isWebGpu = modelManager.getHasWebGpu();

  // Web Speech API initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInput((prev) => (prev ? prev + ' ' + transcript : transcript));
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
            }
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleSpeech = () => {
    if (!recognitionRef.current) {
      console.warn('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Speech start error:', err);
        setIsListening(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsParsingDoc(true);
    try {
      const parsedList: AttachedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const parsed = await DocumentParser.parseFile(files[i]);
        parsedList.push(parsed);
      }
      setAttachments((prev) => [...prev, ...parsedList]);
    } catch (err) {
      console.error('Failed to parse file attachment:', err);
    } finally {
      setIsParsingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = () => {
    if (isRunning) {
      onCancelExecution();
      return;
    }

    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    onSendMessage(trimmed, attachments, {
      reasoningLevel,
      capabilities,
    });
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const toggleAutoCapabilities = () => {
    onChangeCapabilities({
      ...capabilities,
      autoCapabilities: !capabilities.autoCapabilities,
    });
  };

  const toggleCapability = (key: 'allowInternet' | 'allowTools' | 'allowFiles') => {
    onChangeCapabilities({
      ...capabilities,
      [key]: !capabilities[key],
      autoCapabilities: false, // Manual override turns auto off
    });
  };

  const powerLevels: ReasoningLevel[] = ['auto', 'low', 'med', 'high', 'max'];

  return (
    <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2 sm:p-3">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-1.5 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded text-xs text-neutral-700 dark:text-neutral-300 font-mono"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                <span className="truncate max-w-[130px] text-[11px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(file.id)}
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className="relative flex items-end gap-1.5 sm:gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 p-1.5 sm:p-2 focus-within:border-neutral-400 dark:focus-within:border-neutral-600 transition-colors">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            className="hidden"
            accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.js,.ts,.tsx,.html,.css,.py"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isRunning || isParsingDoc}
            title="Attach documents (PDF, CSV, TXT, JSON, Code)"
            className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-40 rounded transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              isRunning
                ? 'Execution in progress...'
                : 'Direct Makron agent: e.g. "Build an animated timer in /timer.html and test it"'
            }
            rows={1}
            className="flex-1 max-h-40 resize-none bg-transparent text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-hidden py-1 leading-relaxed"
          />

          {/* Web Speech API Microphone button */}
          <button
            type="button"
            onClick={toggleSpeech}
            disabled={disabled || isRunning}
            title={isListening ? 'Stop listening' : 'Speech to text'}
            className={`p-1.5 rounded transition-colors shrink-0 ${
              isListening
                ? 'text-red-500 bg-red-100 dark:bg-red-950/60 animate-pulse'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Send / Stop control */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || (!isRunning && !input.trim() && attachments.length === 0)}
            title={isRunning ? 'Stop execution' : 'Send message (Enter)'}
            className={`p-1.5 rounded transition-all shrink-0 ${
              isRunning
                ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 hover:opacity-90'
                : 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-20'
            }`}
          >
            {isRunning ? <Square className="w-3.5 h-3.5 fill-current" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Capabilities & Reasoning Controls Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px] font-mono select-none">
          {/* Capabilities Switches: Auto / Internet / Tools / Files */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {/* Auto Button */}
            <button
              type="button"
              onClick={toggleAutoCapabilities}
              title="Auto-detect whether tools/internet/files are required"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                capabilities.autoCapabilities
                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Auto</span>
            </button>

            <span className="text-neutral-300 dark:text-neutral-700">|</span>

            {/* Internet Switch */}
            <button
              type="button"
              onClick={() => toggleCapability('allowInternet')}
              title={`Internet Access (${capabilities.allowInternet ? 'Allowed' : 'Blocked'})`}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                capabilities.allowInternet
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                  : 'text-neutral-400 dark:text-neutral-600 line-through opacity-70 hover:opacity-100'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Net</span>
            </button>

            {/* Tools Switch */}
            <button
              type="button"
              onClick={() => toggleCapability('allowTools')}
              title={`Tool Execution (${capabilities.allowTools ? 'Enabled' : 'Disabled'})`}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                capabilities.allowTools
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                  : 'text-neutral-400 dark:text-neutral-600 line-through opacity-70 hover:opacity-100'
              }`}
            >
              <Wrench className="w-3 h-3" />
              <span>Tools</span>
            </button>

            {/* Files Switch */}
            <button
              type="button"
              onClick={() => toggleCapability('allowFiles')}
              title={`Virtual Filesystem Creation (${capabilities.allowFiles ? 'Enabled' : 'Disabled'})`}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                capabilities.allowFiles
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                  : 'text-neutral-400 dark:text-neutral-600 line-through opacity-70 hover:opacity-100'
              }`}
            >
              <FileCode2 className="w-3 h-3" />
              <span>Files</span>
            </button>
          </div>

          {/* Right zone: Model selector & Reasoning Power Switcher */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            {/* Model Selector placed to the left side of Auto-Low-Med-High-Max */}
            <button
              type="button"
              onClick={onOpenModels}
              title={`Active Model: ${currentModel.name}. Click to switch SLM or manage local weights`}
              className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] sm:text-[11px] font-mono text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded transition-colors whitespace-nowrap cursor-pointer"
            >
              <Cpu className="w-3 h-3 text-neutral-500 shrink-0" />
              <span className="truncate max-w-[85px] sm:max-w-[125px]">
                {currentModel.name.split('(')[0].trim()}
              </span>
              <span className="text-[9px] px-1 py-0.2 bg-neutral-200 dark:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400">
                {isWebGpu ? 'GPU' : 'WASM'}
              </span>
            </button>

            {/* Reasoning Power Segmented Switch: Auto-Low-Med-High-Max */}
            <div className="flex items-center p-0.5 rounded bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              {powerLevels.map((lvl) => {
                const isActive = reasoningLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChangeReasoningLevel(lvl)}
                    title={`Reasoning Power: ${lvl.toUpperCase()}`}
                    className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold shadow-2xs'
                        : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
