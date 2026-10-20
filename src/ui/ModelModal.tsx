import React, { useEffect, useState } from 'react';
import { Check, Cpu, Download, HardDrive, Plus, Sparkles, X } from 'lucide-react';
import { AVAILABLE_MODELS, ModelManager, ProgressEventPayload } from '../models/manager';
import { ModelConfig } from '../types';

interface ModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  preferredDevice: 'webgpu' | 'wasm';
  onChangeDevice: (device: 'webgpu' | 'wasm') => void;
  hfToken?: string;
  onUpdateHfToken?: (token: string) => void;
}

export const ModelModal: React.FC<ModelModalProps> = ({
  isOpen,
  onClose,
  selectedModelId,
  onSelectModel,
  preferredDevice,
  onChangeDevice,
  hfToken = '',
  onUpdateHfToken,
}) => {
  const [models, setModels] = useState<ModelConfig[]>(AVAILABLE_MODELS);
  const [customModelId, setCustomModelId] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<ProgressEventPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState(hfToken);

  const manager = ModelManager.getInstance();
  const hasWebGpu = manager.getHasWebGpu();

  useEffect(() => {
    setTokenInput(hfToken);
  }, [hfToken]);

  useEffect(() => {
    const unsub = manager.onProgress((p) => {
      setDownloadProgress(p);
      if (p.status === 'ready') {
        setIsLoading(false);
      }
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleLoadModel = async (modelId: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      onSelectModel(modelId);
      await manager.loadModel(modelId, preferredDevice, 'q4', tokenInput.trim());
    } catch (err: any) {
      setErrorMsg(err.message || 'Model load failure');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customModelId.trim();
    if (!trimmed) return;

    const newConfig: ModelConfig = {
      id: trimmed,
      name: trimmed.split('/').pop() || trimmed,
      description: 'Custom registered Hugging Face ONNX model repository.',
      sizeLabel: 'Custom',
      defaultDtype: 'q4',
      recommendedDevice: hasWebGpu ? 'webgpu' : 'wasm',
      contextWindow: 2048,
      isCustom: true,
    };

    setModels((prev) => [...prev, newConfig]);
    setCustomModelId('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl overflow-hidden text-xs flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-12 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-neutral-500" />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Local SLM Registry</span>
            <span className="text-[10px] font-mono text-neutral-400">Transformers.js</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Device Acceleration Switch */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 dark:text-neutral-400 font-medium">Hardware Backend:</span>
            <span className="text-neutral-500 font-mono text-[11px]">
              {hasWebGpu ? 'WebGPU Available' : 'WebGPU Not Detected (CPU WASM active)'}
            </span>
          </div>

          <div className="flex items-center p-0.5 bg-neutral-200 dark:bg-neutral-800 rounded">
            <button
              type="button"
              disabled={!hasWebGpu}
              onClick={() => onChangeDevice('webgpu')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                preferredDevice === 'webgpu'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 disabled:opacity-30'
              }`}
            >
              WebGPU
            </button>
            <button
              type="button"
              onClick={() => onChangeDevice('wasm')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                preferredDevice === 'wasm'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              WASM
            </button>
          </div>
        </div>

        {/* Hugging Face Access Token (Optional for gated/private models) */}
        <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center justify-between gap-2 shrink-0">
          <div className="flex-1 min-w-0">
            <span className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
              Hugging Face Token (Optional)
            </span>
            <span className="text-[10px] text-neutral-400">
              Required only for gated models (e.g. Llama) or private repositories.
            </span>
          </div>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value);
              if (onUpdateHfToken) onUpdateHfToken(e.target.value);
            }}
            placeholder="hf_..."
            className="w-40 sm:w-48 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-[11px] outline-hidden"
          />
        </div>

        {/* Download progress bar if active */}
        {isLoading && downloadProgress && (
          <div className="p-3 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            <div className="flex items-center justify-between font-mono text-[11px] mb-1 text-neutral-600 dark:text-neutral-400">
              <span className="truncate max-w-[280px]">Downloading {downloadProgress.file || 'model weights'}</span>
              <span>{downloadProgress.progress}%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-neutral-900 dark:bg-neutral-100 h-full rounded-full transition-all"
                style={{ width: `${downloadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-b border-red-200 dark:border-red-900 text-[11px] leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Model list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {models.map((model) => {
            const isSelected = model.id === selectedModelId;
            const isLoaded = manager.getIsLoaded() && manager.getCurrentModelId() === model.id;

            return (
              <div
                key={model.id}
                onClick={() => handleLoadModel(model.id)}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50/80 dark:bg-neutral-900/60'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {model.name}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400 px-1 py-0.2 bg-neutral-100 dark:bg-neutral-800 rounded">
                      {model.sizeLabel}
                    </span>
                    {isLoaded && (
                      <span className="text-[10px] font-mono text-neutral-600 dark:text-neutral-400">
                        · Loaded in memory
                      </span>
                    )}
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-neutral-900 dark:text-neutral-100" />}
                </div>

                <p className="text-[11px] text-neutral-500 leading-relaxed mb-2">
                  {model.description}
                </p>

                <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-400">
                  <span>ID: {model.id}</span>
                  <span>·</span>
                  <span>Context: {model.contextWindow} tok</span>
                  <span>·</span>
                  <span>Precision: {model.defaultDtype}</span>
                </div>
              </div>
            );
          })}

          {/* Register custom Hugging Face model */}
          <form onSubmit={handleAddCustomModel} className="pt-2">
            <span className="block text-[11px] text-neutral-500 mb-1.5 font-medium">
              Register Custom Model Repository
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customModelId}
                onChange={(e) => setCustomModelId(e.target.value)}
                placeholder="e.g. onnx-community/SmolLM2-135M-Instruct-ONNX"
                className="flex-1 px-2.5 py-1.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 font-mono text-xs text-neutral-900 dark:text-neutral-100 outline-hidden focus:border-neutral-400"
              />
              <button
                type="submit"
                disabled={!customModelId.trim()}
                className="px-3 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded font-medium text-xs disabled:opacity-30 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="h-11 px-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between shrink-0 text-[11px] text-neutral-500">
          <span>Inference runs 100% locally in your browser.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
