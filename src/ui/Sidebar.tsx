import React, { useState } from 'react';
import { Check, HardDrive, MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Conversation } from '../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onClose: () => void;
  storageUsage: { usage: number; quota: number };
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onRenameConversation,
  isOpen,
  onClose,
  storageUsage,
  onOpenSettings,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const saveRename = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 md:w-60 bg-neutral-50 dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Bar */}
        <div className="h-12 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-neutral-900 dark:text-neutral-100">ꫧ</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Makron LMG
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action: New Conversation */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-900 dark:text-neutral-100 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-400 dark:text-neutral-600">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    onClose();
                  }}
                  className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-neutral-200/80 dark:bg-neutral-800/90 text-neutral-900 dark:text-neutral-100 font-medium'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    {editingId === conv.id ? (
                      <form onSubmit={(e) => saveRename(conv.id, e)} className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={(e) => saveRename(conv.id, e)}
                          autoFocus
                          className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 px-1 py-0.5 text-xs rounded outline-hidden"
                        />
                        <button type="submit" className="p-0.5 text-neutral-700 dark:text-neutral-300">
                          <Check className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <span
                        onDoubleClick={(e) => startRename(conv, e)}
                        className="truncate"
                        title={conv.title}
                      >
                        {conv.title}
                      </span>
                    )}
                  </div>

                  {editingId !== conv.id && (
                    <>
                      {confirmDeleteId === conv.id ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-800 px-1.5 py-0.5 rounded text-[11px] text-red-700 dark:text-red-300 shrink-0"
                        >
                          <span className="font-semibold text-[10px]">Delete?</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                              setConfirmDeleteId(null);
                            }}
                            title="Confirm delete conversation"
                            className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            title="Cancel delete"
                            className="p-0.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => startRename(conv, e)}
                            title="Rename conversation"
                            aria-label="Rename conversation"
                            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(conv.id);
                            }}
                            title="Delete conversation"
                            aria-label="Delete conversation"
                            className="p-1 text-neutral-400 hover:text-red-500 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Storage Info (Clicking opens Settings Modal) */}
        <div
          onClick={() => {
            if (onOpenSettings) {
              onOpenSettings();
            }
          }}
          title="Click to open settings and storage management"
          className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-[11px] text-neutral-500 font-mono cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors select-none"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <HardDrive className="w-3 h-3" />
              <span>Storage</span>
            </span>
            <span>{formatBytes(storageUsage.usage)}</span>
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-neutral-600 dark:bg-neutral-400 h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(1, (storageUsage.usage / (storageUsage.quota || 1)) * 100))}%`,
              }}
            />
          </div>
        </div>
      </aside>
    </>
  );
};
