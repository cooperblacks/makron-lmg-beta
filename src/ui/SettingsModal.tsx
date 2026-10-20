import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cpu,
  Download,
  FileCode2,
  HardDrive,
  History,
  MessageSquare,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AVAILABLE_MODELS } from '../models/manager';
import { db } from '../storage/indexeddb';
import { UserSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (newSettings: UserSettings) => void;
  storageUsage: { usage: number; quota: number };
  onDataWiped: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  storageUsage,
  onDataWiped,
}) => {
  const [stats, setStats] = useState({
    conversationsCount: 0,
    messagesCount: 0,
    filesCount: 0,
    filesBytes: 0,
    checkpointsCount: 0,
  });
  const [cachedModelKeys, setCachedModelKeys] = useState<string[]>([]);
  const [isWipingAll, setIsWipingAll] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [importNotification, setImportNotification] = useState<string | null>(null);
  const [confirmingCategory, setConfirmingCategory] = useState<string | null>(null);
  const [confirmingCache, setConfirmingCache] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    try {
      const s = await db.getCategoryStats();
      setStats(s);

      // Check Cache API
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        setCachedModelKeys(keys);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
      setIsWipingAll(false);
      setConfirmInput('');
      setImportNotification(null);
      setConfirmingCategory(null);
      setConfirmingCache(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClearCategory = async (category: 'conversations' | 'virtual_files' | 'checkpoints') => {
    await db.clearCategory(category);
    setConfirmingCategory(null);
    await loadStats();
    onDataWiped();
  };

  const handleClearModelCache = async (cacheKey?: string) => {
    if (typeof window !== 'undefined' && 'caches' in window) {
      if (cacheKey) {
        await window.caches.delete(cacheKey);
      } else {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
      setConfirmingCache(false);
      await loadStats();
    }
  };

  const handlePerformDoubleConfirmWipe = async () => {
    if (confirmInput.trim().toUpperCase() !== 'CONFIRM') return;
    await db.wipeAllData();
    setIsWipingAll(false);
    onDataWiped();
    onClose();
  };

  const handleExportBackup = async () => {
    const convs = await db.getConversations();
    const files = await db.getFiles(convs[0]?.id || '');
    const allFiles: any[] = [];
    for (const c of convs) {
      const f = await db.getFiles(c.id);
      allFiles.push(...f);
    }

    const backupData: any = {
      version: 1,
      exportedAt: new Date().toISOString(),
      conversations: convs,
      messages: [],
      files: allFiles,
      settings,
    };

    for (const c of convs) {
      const msgs = await db.getMessages(c.id);
      backupData.messages.push(...msgs);
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `makron_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.conversations && !parsed.messages) {
        throw new Error('Invalid backup file structure.');
      }

      await db.importBackup(parsed);
      setImportNotification('Backup imported successfully!');
      await loadStats();
      onDataWiped();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl overflow-hidden text-xs flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-12 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-neutral-500" />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Settings & Storage</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {importNotification && (
            <div className="p-2.5 rounded bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs flex items-center justify-between">
              <span>{importNotification}</span>
              <button onClick={() => setImportNotification(null)} className="text-neutral-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section 1: Storage Quota */}
          <div>
            <div className="flex items-center justify-between text-neutral-900 dark:text-neutral-100 font-medium mb-1.5">
              <span>Browser Storage Quota</span>
              <span className="font-mono text-[11px] text-neutral-500">
                {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}
              </span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-1">
              <div
                className="bg-neutral-900 dark:bg-neutral-100 h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(1, (storageUsage.usage / (storageUsage.quota || 1)) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Section 2: Individual Categories of Data */}
          <div>
            <span className="block font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Granular Data Management
            </span>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/30">
              {/* Category: Conversations */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-neutral-500" />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      Conversations & Messages
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400">
                      {stats.conversationsCount} conversations · {stats.messagesCount} messages
                    </div>
                  </div>
                </div>
                {confirmingCategory === 'conversations' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleClearCategory('conversations')}
                      className="px-2 py-0.5 text-xs bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors"
                    >
                      Delete?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingCategory(null)}
                      className="px-2 py-0.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingCategory('conversations')}
                    disabled={stats.conversationsCount === 0}
                    className="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded disabled:opacity-30 transition-colors"
                  >
                    Clear Conversations
                  </button>
                )}
              </div>

              {/* Category: Virtual Files */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileCode2 className="w-4 h-4 text-neutral-500" />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      Virtual Filesystem
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400">
                      {stats.filesCount} workspace files ({formatBytes(stats.filesBytes)})
                    </div>
                  </div>
                </div>
                {confirmingCategory === 'virtual_files' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleClearCategory('virtual_files')}
                      className="px-2 py-0.5 text-xs bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors"
                    >
                      Delete?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingCategory(null)}
                      className="px-2 py-0.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingCategory('virtual_files')}
                    disabled={stats.filesCount === 0}
                    className="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded disabled:opacity-30 transition-colors"
                  >
                    Clear Files
                  </button>
                )}
              </div>

              {/* Category: Checkpoints */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4 text-neutral-500" />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      Checkpoints & Snapshots
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400">
                      {stats.checkpointsCount} saved workspace snapshots
                    </div>
                  </div>
                </div>
                {confirmingCategory === 'checkpoints' ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleClearCategory('checkpoints')}
                      className="px-2 py-0.5 text-xs bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors"
                    >
                      Delete?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingCategory(null)}
                      className="px-2 py-0.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingCategory('checkpoints')}
                    disabled={stats.checkpointsCount === 0}
                    className="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded disabled:opacity-30 transition-colors"
                  >
                    Clear Snapshots
                  </button>
                )}
              </div>

              {/* Category: Downloaded Model Caches */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-neutral-500" />
                  <div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200">
                      Downloaded Model Weights (Cache API)
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400">
                      {cachedModelKeys.length > 0
                        ? `${cachedModelKeys.length} cache stores active`
                        : 'No cached model weights'}
                    </div>
                  </div>
                </div>
                {confirmingCache ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleClearModelCache()}
                      className="px-2 py-0.5 text-xs bg-red-600 text-white rounded font-medium hover:bg-red-700 transition-colors"
                    >
                      Purge?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingCache(false)}
                      className="px-2 py-0.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingCache(true)}
                    disabled={cachedModelKeys.length === 0}
                    className="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded disabled:opacity-30 transition-colors"
                  >
                    Purge Model Cache
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Import / Export */}
          <div>
            <span className="block font-medium text-neutral-900 dark:text-neutral-100 mb-2">
              Import & Export Data
            </span>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Full Backup</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Backup</span>
              </button>
            </div>
          </div>

          {/* Section 4: Double-Confirmation Clear All */}
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
            {isWipingAll ? (
              <div className="p-3 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 space-y-2.5">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Double Confirmation Required</span>
                </div>
                <p className="text-[11px] text-red-600 dark:text-red-300 leading-relaxed">
                  This will permanently delete all conversations, messages, virtual files, checkpoints, and model caches. Type <strong className="font-mono">CONFIRM</strong> below to proceed:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="CONFIRM"
                    className="flex-1 px-2.5 py-1.5 rounded border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-900 font-mono text-xs uppercase"
                  />
                  <button
                    type="button"
                    onClick={handlePerformDoubleConfirmWipe}
                    disabled={confirmInput.trim().toUpperCase() !== 'CONFIRM'}
                    className="px-3 py-1.5 bg-red-600 text-white rounded font-medium text-xs disabled:opacity-40 hover:bg-red-700 transition-colors"
                  >
                    Wipe Everything
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWipingAll(false);
                      setConfirmInput('');
                    }}
                    className="px-2 py-1.5 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="block font-medium text-red-600 dark:text-red-400">
                    Hard Reset All Storage
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Purges IndexedDB database and all cached model weights.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWipingAll(true)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors"
                >
                  Wipe All Storage
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="h-11 px-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-end shrink-0">
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
