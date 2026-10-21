import React, { useEffect, useState } from 'react';
import {
  Check,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Key,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AVAILABLE_MODELS,
  ModelManager,
  ProgressEventPayload,
  resolveModelDetails,
  VENDOR_CONFIGS,
  VendorConfig,
} from '../models/manager';
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
  apiKeys?: Record<string, string>;
  onUpdateApiKey?: (provider: string, key: string) => void;
  vendorModels?: Record<string, string>;
  onUpdateVendorModel?: (provider: string, model: string) => void;
  ollamaUrl?: string;
  onUpdateOllamaUrl?: (url: string) => void;
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
  apiKeys = {},
  onUpdateApiKey,
  vendorModels = {},
  onUpdateVendorModel,
  ollamaUrl = '',
  onUpdateOllamaUrl,
}) => {
  const [localModelsList, setLocalModelsList] = useState<ModelConfig[]>(AVAILABLE_MODELS);
  const [customModelId, setCustomModelId] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<ProgressEventPayload | null>(null);
  const [loadingModelId, setLoadingModelId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState(hfToken);
  const [showKeyMap, setShowKeyMap] = useState<Record<string, boolean>>({});
  const [ollamaPingState, setOllamaPingState] = useState<'idle' | 'pinging' | 'connected' | 'error'>('idle');
  const [ollamaError, setOllamaError] = useState<string | null>(null);

  const manager = ModelManager.getInstance();
  const hasWebGpu = manager.getHasWebGpu();

  const pingOllamaServer = async (testUrl?: string) => {
    const rawUrl = (testUrl !== undefined ? testUrl : ollamaUrl)?.trim() || 'http://localhost:11434';
    const baseUrl = rawUrl.replace(/\/+$/, '');
    setOllamaPingState('pinging');
    setOllamaError(null);

    // 1. Direct browser ping
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${baseUrl}/api/version`, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        setOllamaPingState('connected');
        return true;
      }
    } catch {
      // Direct ping failed or blocked by CORS / mixed content; try backend proxy
    }

    // 2. Server proxy ping
    try {
      const res = await fetch(`/api/ping-ollama?url=${encodeURIComponent(baseUrl)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setOllamaPingState('connected');
        return true;
      } else {
        setOllamaPingState('error');
        setOllamaError(data.error || 'Server unreachable');
        return false;
      }
    } catch (err: any) {
      setOllamaPingState('error');
      setOllamaError(err.message || 'Server ping failed');
      return false;
    }
  };

  useEffect(() => {
    setTokenInput(hfToken);
  }, [hfToken]);

  // Close on Escape key press (called before any early return)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const unsub = manager.onProgress((p) => {
      setDownloadProgress(p);
      if (p.status === 'ready' || p.status === 'done') {
        setLoadingModelId(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen) {
      const details = resolveModelDetails(selectedModelId, vendorModels);
      if (details.provider === 'ollama') {
        pingOllamaServer();
      }
    }
  }, [isOpen, selectedModelId, ollamaUrl]);

  if (!isOpen) return null;

  const handleSelectLocalModel = async (model: ModelConfig) => {
    setErrorMsg(null);

    // Guard: already loaded
    if (manager.getIsLoaded() && manager.getCurrentModelId() === model.id) {
      onSelectModel(model.id);
      return;
    }

    // Guard: currently downloading
    if (loadingModelId === model.id) {
      return;
    }

    setLoadingModelId(model.id);
    try {
      onSelectModel(model.id);
      await manager.loadModel(model.id, preferredDevice, model.defaultDtype || 'q4', tokenInput.trim());
    } catch (err: any) {
      setErrorMsg(err.message || 'Model load failure');
    } finally {
      setLoadingModelId(null);
    }
  };

  const handleSelectVendorModel = (vendor: VendorConfig) => {
    const chosenModel = vendorModels[vendor.id] || vendor.defaultModel;
    const canonicalId = `${vendor.id}:${chosenModel}`;
    onSelectModel(canonicalId);
  };

  const handleModelIdentifierChange = (vendor: VendorConfig, newModel: string) => {
    if (onUpdateVendorModel) {
      onUpdateVendorModel(vendor.id, newModel);
    }
    // If currently selected, also update active model
    const activeDetails = resolveModelDetails(selectedModelId, vendorModels);
    if (activeDetails.provider === vendor.id) {
      onSelectModel(`${vendor.id}:${newModel.trim() || vendor.defaultModel}`);
    }
  };

  const handleApiKeyChange = (vendorId: string, keyVal: string) => {
    if (onUpdateApiKey) {
      onUpdateApiKey(vendorId, keyVal);
    }
  };

  const toggleShowKey = (vendorId: string) => {
    setShowKeyMap((prev) => ({ ...prev, [vendorId]: !prev[vendorId] }));
  };

  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customModelId.trim();
    if (!trimmed) return;

    const newConfig: ModelConfig = {
      id: trimmed,
      name: trimmed.split('/').pop() || trimmed,
      description: 'Custom registered Hugging Face ONNX repository for Transformers.js.',
      sizeLabel: 'Custom',
      defaultDtype: 'q4',
      recommendedDevice: hasWebGpu ? 'webgpu' : 'wasm',
      contextWindow: 2048,
      isCustom: true,
      provider: 'local',
      supportsVision: false,
    };

    setLocalModelsList((prev) => [...prev, newConfig]);
    setCustomModelId('');
  };

  const currentDetails = resolveModelDetails(selectedModelId, vendorModels);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl overflow-hidden text-xs flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="h-12 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-neutral-500" />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Model Selector</span>
            <span className="text-[10px] font-mono text-neutral-400">Local SLMs & External Providers</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hardware Acceleration Bar for Local Models */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-neutral-600 dark:text-neutral-400 font-medium">Local SLM Hardware:</span>
            <span className="text-neutral-500 font-mono text-[11px]">
              {hasWebGpu ? 'WebGPU Available' : 'WebGPU Not Detected (WASM CPU active)'}
            </span>
          </div>

          <div className="flex items-center p-0.5 bg-neutral-200 dark:bg-neutral-800 rounded">
            <button
              type="button"
              disabled={!hasWebGpu}
              onClick={() => onChangeDevice('webgpu')}
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
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
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                preferredDevice === 'wasm'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              WASM
            </button>
          </div>
        </div>

        {/* Live download progress bar */}
        {loadingModelId && downloadProgress && (
          <div className="p-3 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            <div className="flex items-center justify-between font-mono text-[11px] mb-1 text-neutral-700 dark:text-neutral-300">
              <span className="truncate max-w-[300px]">Downloading {loadingModelId}</span>
              <span>{downloadProgress.progress}%</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-neutral-900 dark:bg-neutral-100 h-full rounded-full transition-all duration-150"
                style={{ width: `${Math.max(2, downloadProgress.progress)}%` }}
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

        {/* Model lists container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Section 1: Browser-Based Local Models */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-neutral-500" />
                <span>Browser-Based Small Language Models (SLMs)</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">100% Client-Side Privacy</span>
            </div>

            <div className="space-y-2">
              {localModelsList.map((model) => {
                const isSelected = selectedModelId === model.id;
                const isLoaded = manager.getIsLoaded() && manager.getCurrentModelId() === model.id;
                const isDownloadingThis = loadingModelId === model.id;

                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectLocalModel(model)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50/90 dark:bg-neutral-900/70 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {model.name}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-400 px-1 py-0.2 bg-neutral-100 dark:bg-neutral-800 rounded">
                          {model.sizeLabel}
                        </span>
                        {isLoaded && (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-900">
                            Loaded in memory
                          </span>
                        )}
                        {isDownloadingThis && (
                          <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 animate-pulse">
                            Downloading...
                          </span>
                        )}
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-neutral-900 dark:text-neutral-100 shrink-0" />}
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
            </div>

            {/* Register custom Hugging Face model */}
            <form onSubmit={handleAddCustomModel} className="pt-2">
              <span className="block text-[11px] text-neutral-500 mb-1.5 font-medium">
                Register Custom Hugging Face ONNX Model
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
                  className="px-3 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded font-medium text-xs disabled:opacity-30 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section: Ollama Server (Self-Hosted / Ngrok Tunnel) */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-neutral-500" />
                <span>Ollama Server (Local or Ngrok Tunnel)</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">Self-Hosted Instance</span>
            </div>

            <div
              className={`p-3.5 rounded-lg border transition-all ${
                currentDetails.provider === 'ollama'
                  ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50/90 dark:bg-neutral-900/70 shadow-xs'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/40 dark:bg-neutral-900/20'
              }`}
            >
              {/* Top Row: Icon, Name, Select Button */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                    <Server className="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                      Ollama Instance
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentDetails.provider === 'ollama' ? (
                    ollamaPingState === 'pinging' ? (
                      <span className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700">
                        <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />
                        <span>Pinging...</span>
                      </span>
                    ) : ollamaPingState === 'connected' ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        <Check className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-medium">
                          Offline / Unreachable
                        </span>
                        <button
                          type="button"
                          onClick={() => pingOllamaServer()}
                          title="Retry pinging Ollama server"
                          className="p-1 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const activeModel = vendorModels['ollama'] || 'llama3.2';
                        onSelectModel(`ollama:${activeModel}`);
                        pingOllamaServer();
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Select Model
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 leading-relaxed mb-3">
                Connect directly to an Ollama server running locally or tunneled securely via Ngrok. Status shows Active only when the server is reachable.
              </p>

              {/* Form Fields: Ngrok URL & Model Identifier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* 1. Ngrok / Server URL */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-mono text-neutral-500">
                      Ollama Server / Ngrok URL
                    </label>
                    <button
                      type="button"
                      onClick={() => pingOllamaServer()}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Test Connection</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => {
                      if (onUpdateOllamaUrl) {
                        onUpdateOllamaUrl(e.target.value);
                      }
                    }}
                    placeholder="https://xxxx-xx-xx.ngrok-free.app"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono text-neutral-900 dark:text-neutral-100 outline-hidden focus:border-neutral-500"
                  />
                  {ollamaError && currentDetails.provider === 'ollama' && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      {ollamaError}
                    </p>
                  )}
                </div>

                {/* 2. Model Identifier */}
                <div>
                  <label className="block text-[10px] font-mono text-neutral-500 mb-1">
                    Model Identifier (Default: llama3.2)
                  </label>
                  <input
                    type="text"
                    value={vendorModels['ollama'] || 'llama3.2'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (onUpdateVendorModel) {
                        onUpdateVendorModel('ollama', val);
                      }
                      if (currentDetails.provider === 'ollama') {
                        onSelectModel(`ollama:${val.trim() || 'llama3.2'}`);
                      }
                    }}
                    placeholder="llama3.2"
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono text-neutral-900 dark:text-neutral-100 outline-hidden focus:border-neutral-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: External Vendors (Single Entry per Vendor with Model & Key Form Fields) */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-neutral-500" />
                <span>External LLM Providers (One Entry per Vendor)</span>
              </span>
              <span className="text-[10px] font-mono text-neutral-400">Editable Model Identifier & API Key</span>
            </div>

            <div className="space-y-3">
              {VENDOR_CONFIGS.map((vendor) => {
                const currentModelVal = vendorModels[vendor.id] || vendor.defaultModel;
                const isSelected = currentDetails.provider === vendor.id;
                const apiKeyVal = apiKeys[vendor.id] || '';
                const isShowingKey = !!showKeyMap[vendor.id];

                return (
                  <div
                    key={vendor.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50/90 dark:bg-neutral-900/70 shadow-xs'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/40 dark:bg-neutral-900/20'
                    }`}
                  >
                    {/* Top Row: Logo, Vendor Name, Select Button */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 flex items-center justify-center">
                          <img
                            src={`https://muxai.vercel.app/logos/${vendor.logo}`}
                            alt={vendor.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div>
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs">
                            {vendor.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectVendorModel(vendor)}
                            className="px-2.5 py-1 text-xs font-medium rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 transition-opacity cursor-pointer"
                          >
                            Select Model
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-500 leading-relaxed mb-3">
                      {vendor.description}
                    </p>

                    {/* Form Fields: Model Identifier & API Key */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {/* 1. Editable Model Identifier */}
                      <div>
                        <label className="block text-[10px] font-mono text-neutral-500 mb-1">
                          Model Identifier (Default: {vendor.defaultModel})
                        </label>
                        <input
                          type="text"
                          value={currentModelVal}
                          onChange={(e) => handleModelIdentifierChange(vendor, e.target.value)}
                          placeholder={vendor.defaultModel}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono text-neutral-900 dark:text-neutral-100 outline-hidden focus:border-neutral-500"
                        />
                      </div>

                      {/* 2. API Key Form Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-mono text-neutral-500">
                            API Key
                          </label>
                          {apiKeyVal ? (
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              Configured
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                              Required
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={isShowingKey ? 'text' : 'password'}
                            value={apiKeyVal}
                            onChange={(e) => handleApiKeyChange(vendor.id, e.target.value)}
                            placeholder={vendor.keyPlaceholder}
                            className="w-full pr-7 px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono text-neutral-900 dark:text-neutral-100 outline-hidden focus:border-neutral-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowKey(vendor.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                            title={isShowingKey ? 'Hide key' : 'Show key'}
                          >
                            {isShowingKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 px-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between shrink-0 text-[11px] text-neutral-500">
          <span>Active: {currentDetails.name}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-medium cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
