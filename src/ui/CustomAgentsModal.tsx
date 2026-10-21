import React, { useEffect, useState } from 'react';
import {
  Bot,
  Camera,
  Check,
  Code,
  Copy,
  ExternalLink,
  Key,
  Moon,
  Palette,
  Plus,
  Settings2,
  Sun,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { AVAILABLE_MODELS, ModelManager, VENDOR_CONFIGS } from '../models/manager';
import { SEASONAL_THEMES } from '../constants/themes';
import { AgentThemePreset, AuthUser, CustomAgent, ReasoningLevel } from '../types';
import { AvatarCropperModal } from './AvatarCropperModal';

interface CustomAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  user: AuthUser | null;
  onOpenApiKeys?: () => void;
}

const AVAILABLE_SKILLS = [
  { id: 'code_execution', label: 'Code Execution' },
  { id: 'file_generation', label: 'File Generation' },
  { id: 'web_search', label: 'Web Search' },
  { id: 'doc_extract', label: 'Document Analysis' },
  { id: 'data_processing', label: 'Data Processing' },
];

export const CustomAgentsModal: React.FC<CustomAgentsModalProps> = ({
  isOpen,
  onClose,
  token,
  user,
  onOpenApiKeys,
}) => {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cropper Modal state
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  // Form State
  const [customName, setCustomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('ꫧ');
  const [modelId, setModelId] = useState('gemini-2.5-flash');
  const [gender, setGender] = useState<'neutral' | 'female' | 'male'>('female');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [effortLevel, setEffortLevel] = useState<ReasoningLevel>('auto');
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['code_execution', 'file_generation']);
  const [themePreset, setThemePreset] = useState<AgentThemePreset>('winter_midnight');
  const [customColor, setCustomColor] = useState('#8b5cf6');
  const [allowsFileUploads, setAllowsFileUploads] = useState(false);
  const [embedEnabled, setEmbedEnabled] = useState(true);

  useEffect(() => {
    if (isOpen && token) {
      loadAgents();
    }
  }, [isOpen, token]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const resetForm = () => {
    setIsCreating(false);
    setEditingAgentId(null);
    setCustomName('');
    setDisplayName('');
    setDescription('');
    setAvatar('ꫧ');
    setModelId('gemini-2.5-flash');
    setGender('female');
    setSystemPrompt('');
    setEffortLevel('auto');
    setSelectedSkills(['code_execution', 'file_generation']);
    setThemePreset('winter_midnight');
    setCustomColor('#8b5cf6');
    setAllowsFileUploads(false);
    setEmbedEnabled(true);
    setError(null);
  };

  const startEdit = (agt: CustomAgent) => {
    setEditingAgentId(agt.id);
    setCustomName(agt.customName);
    setDisplayName(agt.displayName);
    setDescription(agt.description || '');
    setAvatar(agt.avatar || 'ꫧ');
    setModelId(agt.modelId || 'gemini-2.5-flash');
    setGender(agt.gender || 'neutral');
    setSystemPrompt(agt.systemPrompt || '');
    setEffortLevel(agt.effortLevel || 'auto');
    setSelectedSkills(agt.skills || ['code_execution']);
    setThemePreset(agt.themePreset || 'winter_midnight');
    setCustomColor(agt.themeColor || '#8b5cf6');
    setAllowsFileUploads(agt.allowsFileUploads);
    setEmbedEnabled(agt.embedEnabled);
    setIsCreating(true);
    setError(null);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);

    const cleanSlug = customName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanSlug) {
      setError('Please provide a valid custom URL identifier.');
      return;
    }

    if (!displayName.trim()) {
      setError('Please provide a display name for the agent.');
      return;
    }

    const seasonal = SEASONAL_THEMES[themePreset];
    let activeThemeColor = seasonal ? seasonal.color : customColor;
    let activeThemeMode: 'light' | 'dark' = seasonal ? seasonal.mode : 'dark';

    const payload = {
      customName: cleanSlug,
      displayName: displayName.trim(),
      description: description.trim(),
      avatar: avatar.trim() || 'ꫧ',
      modelId,
      gender,
      systemPrompt: systemPrompt.trim(),
      effortLevel,
      skills: selectedSkills,
      themePreset,
      themeColor: activeThemeColor,
      themeMode: activeThemeMode,
      allowsFileUploads,
      embedEnabled,
    };

    try {
      const url = editingAgentId ? `/api/agents/${editingAgentId}` : '/api/agents';
      const method = editingAgentId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save agent');
      }

      await loadAgents();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Error saving agent');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/agent/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(slug);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const copyEmbedSnippet = (agent: CustomAgent) => {
    const script = `<script src="${window.location.origin}/embed.js" data-agent="${agent.customName}" data-color="${agent.themeColor}"></script>`;
    navigator.clipboard.writeText(script);
    setCopiedSnippetId(agent.id);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  const isPaid = user?.tier === 'paid';
  const configuredKeys = user?.apiKeysConfigured || [];
  const currentLoadedModelId = ModelManager.getInstance().getCurrentModelId();

  // Group models into Local and Cloud vendors with readiness status
  const cloudModelOptions = VENDOR_CONFIGS.map((v) => ({
    id: v.defaultModel,
    name: `${v.name} (${v.defaultModel})`,
    vendor: v.id,
    hasKey: configuredKeys.includes(v.id),
  }));

  const localModelOptions = AVAILABLE_MODELS.map((m) => ({
    id: m.id,
    name: `${m.name} (Local)`,
    vendor: 'local',
    isLoaded: m.id === currentLoadedModelId,
    hasKey: true,
  }));

  // Check if current selected model is ready
  const isSelectedLocal = localModelOptions.some((l) => l.id === modelId);
  const selectedCloud = cloudModelOptions.find((c) => c.id === modelId);
  const isSelectedReady = isSelectedLocal || Boolean(selectedCloud?.hasKey);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">ꫧ</span>
              <div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Custom AI Agents & Support Systems
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Configure models, voices, seasonal light/dark themes, and embeddable widgets.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {error && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                {error}
              </div>
            )}

            {!isCreating ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Your Published Agents ({agents.length})
                  </span>
                  <button
                    onClick={() => {
                      resetForm();
                      setIsCreating(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Agent</span>
                  </button>
                </div>

                {loading ? (
                  <div className="py-8 text-center text-xs text-neutral-400">Loading agents...</div>
                ) : agents.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl">
                    <Bot className="w-8 h-8 mx-auto text-neutral-400 mb-2" />
                    <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      No custom agents created yet
                    </p>
                    <p className="text-[11px] text-neutral-500 mb-4">
                      Create an agent, select models, pick voice and seasonal light/dark themes, and publish under /agent/{"{custom-name}"}.
                    </p>
                    <button
                      onClick={() => {
                        resetForm();
                        setIsCreating(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 cursor-pointer"
                    >
                      Get Started
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agents.map((agt) => (
                      <div
                        key={agt.id}
                        className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 space-y-2.5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-xs shrink-0 overflow-hidden"
                              style={{ backgroundColor: agt.themeColor }}
                            >
                              {agt.avatar && agt.avatar.startsWith('data:image') ? (
                                <img src={agt.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                <span>{agt.avatar || 'ꫧ'}</span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                  {agt.displayName}
                                </h3>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-neutral-600 dark:text-neutral-400">
                                  /agent/{agt.customName}
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-500 line-clamp-1">
                                {agt.description || 'Virtual assistant'} • Voice:{' '}
                                {agt.gender === 'female' ? 'Female' : agt.gender === 'male' ? 'Male' : 'Neutral'} •{' '}
                                {agt.themeMode === 'light' ? 'Light Theme' : 'Dark Theme'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => startEdit(agt)}
                              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded"
                              title="Edit agent"
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(agt.id)}
                              className="p-1 text-neutral-400 hover:text-red-500 rounded"
                              title="Delete agent"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60 text-[11px]">
                          <button
                            onClick={() => window.open(`/agent/${agt.customName}`, '_blank')}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-200/80 dark:bg-neutral-800/80 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open Public Link</span>
                          </button>

                          <button
                            onClick={() => copyLink(agt.customName)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-200/80 dark:bg-neutral-800/80 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
                          >
                            {copiedLinkId === agt.customName ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedLinkId === agt.customName ? 'Copied' : 'Copy URL'}</span>
                          </button>

                          {agt.embedEnabled && (
                            <button
                              onClick={() => copyEmbedSnippet(agt)}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-neutral-200/80 dark:bg-neutral-800/80 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition cursor-pointer"
                            >
                              {copiedSnippetId === agt.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Code className="w-3 h-3" />}
                              <span>{copiedSnippetId === agt.id ? 'Script Copied' : 'Copy Embed Code'}</span>
                            </button>
                          )}

                          <span className="ml-auto text-[10px] text-neutral-400 font-mono">
                            Model: {agt.modelId} • Files: {agt.allowsFileUploads ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Creation & Edit Form */
              <form onSubmit={handleSaveAgent} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    {editingAgentId ? 'Edit Virtual Assistant' : 'Configure New Virtual Assistant'}
                  </span>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      URL Slug (/agent/{"{custom-name}"})
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. support-bot"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Customer Support Assistant"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Avatar with Cropping/Zooming & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Short Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Answers customer queries, docs, and tickets 24/7"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Avatar (Upload & Crop)
                    </label>
                    <div className="flex items-center gap-2">
                      <div
                        onClick={() => setIsCropperOpen(true)}
                        title="Click to upload and crop avatar"
                        className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500 transition shrink-0"
                      >
                        {avatar && avatar.startsWith('data:image') ? (
                          <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold text-sm">{avatar || 'ꫧ'}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCropperOpen(true)}
                        className="flex-1 py-1.5 px-2 rounded bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-[11px] font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1 transition"
                      >
                        <Camera className="w-3 h-3" />
                        <span>Upload</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Model Selection & Gender Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                        Powering AI Model
                      </label>
                      <span className="text-[10px] text-neutral-400">
                        {configuredKeys.length} cloud key(s) ready
                      </span>
                    </div>
                    <select
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                    >
                      <optgroup label="Cloud Inference Models (API Key Required)">
                        {cloudModelOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name} {opt.hasKey ? '✓ [API Key Ready]' : '⚠ [Key Required]'}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Browser-Hosted Local Models">
                        {localModelOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name} {opt.isLoaded ? '⚡ [Preloaded & Ready]' : '✓ [Browser Ready]'}
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    {isSelectedReady ? (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        <Check className="w-3 h-3" />
                        <span>Ready: verified credentials & support</span>
                      </div>
                    ) : (
                      <div className="mt-1 p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400 flex items-center justify-between">
                        <span>API key required for {selectedCloud?.vendor || 'this vendor'}</span>
                        {onOpenApiKeys && (
                          <button
                            type="button"
                            onClick={onOpenApiKeys}
                            className="font-semibold underline hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer ml-1"
                          >
                            Add Key
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Voice Gender (Text to Speech)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['female', 'male', 'neutral'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGender(g)}
                          className={`py-1.5 px-2 rounded text-xs capitalize flex items-center justify-center gap-1 border cursor-pointer transition ${
                            gender === g
                              ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                          }`}
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>{g}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Context, Knowledge & System Directives
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Provide specific instructions, knowledge base, company facts, and rules for this agent..."
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed"
                  />
                </div>

                {/* Seasonal Themes with Light & Dark variations */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                      Seasonal Theme Palettes (Light & Dark Variants)
                    </label>
                    {isPaid && (
                      <span className="text-[10px] text-amber-500 font-medium">Custom Colors Unlocked</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.values(SEASONAL_THEMES).map((preset) => {
                      const isSelected = themePreset === preset.id;
                      const isLight = preset.mode === 'light';
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setThemePreset(preset.id as AgentThemePreset)}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition flex flex-col gap-1.5 ${
                            isSelected
                              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5'
                              : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="w-4 h-4 rounded-full shadow-xs shrink-0"
                              style={{ backgroundColor: preset.color }}
                            />
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-mono flex items-center gap-0.5 ${
                                isLight
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-neutral-800 text-neutral-200'
                              }`}
                            >
                              {isLight ? <Sun className="w-2.5 h-2.5" /> : <Moon className="w-2.5 h-2.5" />}
                              <span>{isLight ? 'Light' : 'Dark'}</span>
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-neutral-800 dark:text-neutral-200 truncate">
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}

                    {isPaid && (
                      <button
                        type="button"
                        onClick={() => setThemePreset('custom')}
                        className={`p-2 rounded-lg border text-left cursor-pointer transition flex flex-col gap-1.5 ${
                          themePreset === 'custom'
                            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/5'
                            : 'border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <input
                            type="color"
                            value={customColor}
                            onChange={(e) => setCustomColor(e.target.value)}
                            className="w-4 h-4 rounded cursor-pointer border-0 p-0"
                          />
                          <Palette className="w-3 h-3 text-neutral-400" />
                        </div>
                        <span className="text-[11px] font-medium text-neutral-800 dark:text-neutral-200">
                          Custom Hex
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Reasoning Level & Skills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Reasoning Effort
                    </label>
                    <select
                      value={effortLevel}
                      onChange={(e) => setEffortLevel(e.target.value as ReasoningLevel)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="auto">Auto (Balanced reasoning)</option>
                      <option value="low">Low (Fast direct synthesis)</option>
                      <option value="med">Medium (Standard structure)</option>
                      <option value="high">High (Multi-step verification)</option>
                      <option value="max">Max (Deep multi-turn reasoning)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                      Active Capabilities
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {AVAILABLE_SKILLS.map((sk) => {
                        const active = selectedSkills.includes(sk.id);
                        return (
                          <button
                            key={sk.id}
                            type="button"
                            onClick={() => toggleSkill(sk.id)}
                            className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer border ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600 font-medium'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                            }`}
                          >
                            {sk.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700 dark:text-neutral-300">
                    <input
                      type="checkbox"
                      checked={allowsFileUploads}
                      onChange={(e) => setAllowsFileUploads(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>Allow visitor document and file uploads</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-700 dark:text-neutral-300">
                    <input
                      type="checkbox"
                      checked={embedEnabled}
                      onChange={(e) => setEmbedEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>Enable embed widget (/embed/agent/{"{custom-name}"})</span>
                  </label>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 text-xs rounded text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer shadow-xs"
                  >
                    {editingAgentId ? 'Save Changes' : 'Publish Agent'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <AvatarCropperModal
        isOpen={isCropperOpen}
        onClose={() => setIsCropperOpen(false)}
        initialImage={avatar && avatar.startsWith('data:image') ? avatar : undefined}
        title="Crop & Resize Agent Avatar"
        onCropComplete={(croppedBase64) => setAvatar(croppedBase64)}
      />
    </>
  );
};
