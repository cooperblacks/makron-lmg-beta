import React, { useEffect, useState } from 'react';
import {
  Download,
  FileCode,
  FolderArchive,
  History,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { VirtualFileSystem } from '../filesystem/virtualFs';
import { db } from '../storage/indexeddb';
import { Checkpoint, VirtualFile } from '../types';

interface WorkspaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  initialFilePath?: string | null;
  onFilesChanged: () => void;
}

export const WorkspaceDrawer: React.FC<WorkspaceDrawerProps> = ({
  isOpen,
  onClose,
  conversationId,
  initialFilePath,
  onFilesChanged,
}) => {
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<VirtualFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [activeTab, setActiveTab] = useState<'files' | 'checkpoints'>('files');

  const loadWorkspace = async () => {
    if (!conversationId) return;
    const list = await VirtualFileSystem.listFiles(conversationId);
    setFiles(list);

    const cps = await db.getCheckpoints(conversationId);
    setCheckpoints(cps);

    if (initialFilePath) {
      const match = list.find((f) => f.path === initialFilePath);
      if (match) {
        setSelectedFile(match);
        setFileContent(match.content);
        return;
      }
    }

    if (list.length > 0 && !selectedFile) {
      setSelectedFile(list[0]);
      setFileContent(list[0].content);
    } else if (list.length === 0) {
      setSelectedFile(null);
      setFileContent('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWorkspace();
    }
  }, [isOpen, conversationId, initialFilePath]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectFile = (file: VirtualFile) => {
    setSelectedFile(file);
    setFileContent(file.content);
    setIsEditing(false);
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    await VirtualFileSystem.writeFile(conversationId, selectedFile.path, fileContent);
    await loadWorkspace();
    onFilesChanged();
    setIsEditing(false);
  };

  const handleDeleteFile = async (path: string) => {
    await VirtualFileSystem.deleteFile(conversationId, path);
    if (selectedFile?.path === path) {
      setSelectedFile(null);
      setFileContent('');
    }
    await loadWorkspace();
    onFilesChanged();
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;
    const clean = newFilePath.trim().startsWith('/') ? newFilePath.trim() : '/' + newFilePath.trim();
    await VirtualFileSystem.writeFile(conversationId, clean, '// ' + clean);
    setNewFilePath('');
    setIsCreating(false);
    await loadWorkspace();
    onFilesChanged();
  };

  const handleExportZip = async () => {
    const blob = await VirtualFileSystem.exportZip(conversationId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `makron_workspace_${conversationId.slice(0, 8)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSingleFile = () => {
    if (!selectedFile) return;
    const blob = new Blob([fileContent], { type: selectedFile.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.path.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateCheckpoint = async () => {
    const name = `Snapshot ${checkpoints.length + 1}`;
    await VirtualFileSystem.createCheckpoint(conversationId, name);
    const cps = await db.getCheckpoints(conversationId);
    setCheckpoints(cps);
  };

  const handleRollback = async (cpId: string) => {
    await VirtualFileSystem.rollbackToCheckpoint(conversationId, cpId);
    await loadWorkspace();
    onFilesChanged();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl h-[90vh] sm:h-[80vh] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-2xl flex flex-col overflow-hidden text-xs"
      >
        {/* Top Header */}
        <div className="h-12 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Virtual Filesystem</span>
            {/* Tab switch */}
            <div className="flex items-center p-0.5 bg-neutral-100 dark:bg-neutral-900 rounded">
              <button
                type="button"
                onClick={() => setActiveTab('files')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'files'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                Files ({files.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('checkpoints')}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'checkpoints'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                Snapshots ({checkpoints.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportZip}
              disabled={files.length === 0}
              title="Download workspace ZIP"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-neutral-200 dark:border-neutral-800 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 disabled:opacity-30 transition-colors"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Export ZIP</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Close workspace drawer"
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'files' ? (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* File Sidebar */}
            <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 flex flex-col shrink-0 max-h-48 md:max-h-full">
              {/* New file trigger */}
              <div className="p-2 border-b border-neutral-200 dark:border-neutral-800">
                {isCreating ? (
                  <form onSubmit={handleCreateFile} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newFilePath}
                      onChange={(e) => setNewFilePath(e.target.value)}
                      placeholder="/path/to/file.ts"
                      autoFocus
                      className="w-full px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs rounded outline-hidden font-mono"
                    />
                    <button
                      type="submit"
                      className="p-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="p-1 text-neutral-400 hover:text-neutral-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center justify-center gap-1.5 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded border border-dashed border-neutral-300 dark:border-neutral-700 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New File</span>
                  </button>
                )}
              </div>

              {/* File items */}
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {files.length === 0 ? (
                  <div className="p-4 text-center text-neutral-400 text-[11px]">
                    No files in workspace
                  </div>
                ) : (
                  files.map((file) => {
                    const isSelected = selectedFile?.path === file.path;
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleSelectFile(file)}
                        className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors font-mono text-[11px] ${
                          isSelected
                            ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileCode className="w-3 h-3 text-neutral-400 shrink-0" />
                          <span className="truncate">{file.path}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.path);
                          }}
                          title="Delete file"
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-500 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* File Viewer / Editor */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-950">
              {selectedFile ? (
                <>
                  {/* Action strip */}
                  <div className="h-10 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50/50 dark:bg-neutral-900/30">
                    <div className="flex items-center gap-2 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                      <span>{selectedFile.path}</span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-[10px] text-neutral-400">{selectedFile.size} bytes</span>
                      <span className="text-neutral-400">·</span>
                      <span className="text-[10px] text-neutral-400">v{selectedFile.version}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleDownloadSingleFile}
                        title="Download file"
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 rounded"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {isEditing ? (
                        <button
                          onClick={handleSaveFile}
                          className="flex items-center gap-1 px-2.5 py-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded font-medium text-xs hover:opacity-90"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-2.5 py-1 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded text-xs font-medium text-neutral-700 dark:text-neutral-300"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Textarea or Code pre */}
                  <div className="flex-1 p-3 overflow-auto">
                    {isEditing ? (
                      <textarea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        className="w-full h-full p-2 font-mono text-xs text-neutral-900 dark:text-neutral-100 bg-transparent resize-none outline-hidden leading-relaxed"
                      />
                    ) : (
                      <pre className="font-mono text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap">
                        {fileContent || '(Empty file)'}
                      </pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-neutral-400 text-center">
                  <FileCode className="w-8 h-8 stroke-1 text-neutral-300 dark:text-neutral-700 mb-2" />
                  <p className="text-xs">Select or create a file to inspect its content.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Checkpoints View */
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-600 dark:text-neutral-400 text-xs">
                Checkpoints preserve recoverable workspace state across agent steps.
              </span>
              <button
                onClick={handleCreateCheckpoint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded text-xs font-medium hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Take Snapshot</span>
              </button>
            </div>

            {checkpoints.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-xs">
                No checkpoints created yet. Snapshots are created automatically before execution runs.
              </div>
            ) : (
              <div className="space-y-2">
                {checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="p-3 border border-neutral-200 dark:border-neutral-800 rounded bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">{cp.name}</div>
                      <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
                        {new Date(cp.timestamp).toLocaleString()} · {Object.keys(cp.files).length} files
                      </div>
                    </div>

                    <button
                      onClick={() => handleRollback(cp.id)}
                      className="flex items-center gap-1 px-2.5 py-1 border border-neutral-300 dark:border-neutral-700 rounded text-xs hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Rollback</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
