import React, { useState } from 'react';
import {
  Check,
  FolderCode,
  Globe,
  Menu,
  Moon,
  Pencil,
  Settings,
  Sun,
} from 'lucide-react';
import { Conversation, ExecutionState } from '../types';

interface HeaderProps {
  conversation: Conversation | null;
  onOpenSidebar: () => void;
  onOpenContext?: () => void;
  onOpenWorkspace: () => void;
  onOpenModels?: () => void;
  onOpenSettings: () => void;
  onSelectModel?: (modelId: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  executionState: ExecutionState;
  workspaceFileCount: number;
  onOpenPublishModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  conversation,
  onOpenSidebar,
  onOpenWorkspace,
  onOpenSettings,
  onRenameConversation,
  theme,
  onToggleTheme,
  workspaceFileCount,
  onOpenPublishModal,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const startRename = () => {
    if (!conversation) return;
    setTitleInput(conversation.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (conversation && titleInput.trim()) {
      onRenameConversation(conversation.id, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') setIsEditingTitle(false);
  };

  return (
    <header className="h-13 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 select-none z-10 relative">
      {/* Left side: Sidebar toggle & Conversation title */}
      <div className="flex items-center gap-2.5 min-w-0 max-w-[45%]">
        <button
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-base text-neutral-900 dark:text-neutral-100 shrink-0 hidden sm:inline">
            Makron
          </span>
          <span className="text-neutral-300 dark:text-neutral-700 hidden sm:inline">/</span>

          {isEditingTitle ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyDown}
                className="px-2 py-0.5 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 outline-hidden font-medium"
              />
              <button
                type="button"
                onClick={handleSaveTitle}
                className="p-1 text-emerald-600 dark:text-emerald-400"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              onClick={startRename}
              title="Click to rename conversation"
              className="group flex items-center gap-1.5 cursor-pointer min-w-0 py-0.5 px-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-850"
            >
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs">
                {conversation?.title || 'New Conversation'}
              </span>
              <Pencil className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* Center: Files icon with workspace file count badge */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onOpenWorkspace}
          title={`Virtual Workspace (${workspaceFileCount} files)`}
          className="relative p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
        >
          <FolderCode className="w-4 h-4" />
          {workspaceFileCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
              {workspaceFileCount}
            </span>
          )}
        </button>
      </div>

      {/* Right side: Publish icon (left side of theme switcher), Theme switcher & Settings */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Publish icon on left side of theme switcher */}
        <button
          type="button"
          onClick={onOpenPublishModal}
          title={
            conversation?.isPublished
              ? `Published Custom Agent: /agent/${conversation.publishedSlug || ''} (Click to manage)`
              : 'Publish conversation as custom agent frontend'
          }
          className={`px-2 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 text-xs font-medium ${
            conversation?.isPublished
              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 shadow-2xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          <Globe
            className={`w-4 h-4 ${
              conversation?.isPublished
                ? 'text-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.5)] animate-pulse'
                : ''
            }`}
          />
          {conversation?.isPublished && (
            <span className="hidden sm:inline font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              Published
            </span>
          )}
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Applet Settings"
          className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
