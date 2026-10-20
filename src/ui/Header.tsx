import React from 'react';
import { FileCode2, Menu, Moon, Sliders, Sun } from 'lucide-react';
import { Conversation, ExecutionState } from '../types';

interface HeaderProps {
  conversation: Conversation | null;
  onOpenSidebar: () => void;
  onOpenContext: () => void;
  onOpenWorkspace: () => void;
  onOpenModels?: () => void;
  onOpenSettings: () => void;
  onSelectModel?: (modelId: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  executionState: ExecutionState;
  workspaceFileCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  conversation,
  onOpenSidebar,
  onOpenContext,
  onOpenWorkspace,
  onOpenModels,
  onOpenSettings,
  onSelectModel,
  onRenameConversation,
  theme,
  onToggleTheme,
  executionState,
  workspaceFileCount,
}) => {
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleInput, setTitleInput] = React.useState('');

  const handleStartEdit = () => {
    if (!conversation) return;
    setTitleInput(conversation.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (conversation && titleInput.trim() && onRenameConversation) {
      onRenameConversation(conversation.id, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="h-12 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 md:px-4 flex items-center justify-between select-none shrink-0 transition-colors">
      {/* Left zone: Conversation Title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenSidebar}
          aria-label="Toggle navigation drawer"
          className="p-1.5 -ml-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded md:hidden transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center text-xs font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
          {isEditingTitle ? (
            <form onSubmit={handleSaveTitle} className="flex items-center gap-1">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={() => handleSaveTitle()}
                autoFocus
                className="px-1.5 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs outline-hidden"
              />
            </form>
          ) : (
            <span
              onClick={handleStartEdit}
              title="Click to rename conversation"
              className="truncate max-w-[160px] sm:max-w-[260px] text-neutral-800 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
            >
              {conversation?.title || 'New Workspace'}
            </span>
          )}
        </div>
      </div>

      {/* Center/Action zone: Context prompt, Virtual Files */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Context Button */}
        <button
          onClick={onOpenContext}
          title="Conversation system prompt & context"
          className="px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded transition-colors whitespace-nowrap"
        >
          Context
        </button>

        {/* Workspace Files Button */}
        <button
          onClick={onOpenWorkspace}
          title="Open virtual filesystem workspace"
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded transition-colors whitespace-nowrap"
        >
          <FileCode2 className="w-3.5 h-3.5 text-neutral-500" />
          <span className="hidden sm:inline">Files</span>
          {workspaceFileCount > 0 && (
            <span className="text-[10px] font-mono px-1 py-0.2 bg-neutral-200 dark:bg-neutral-800 rounded text-neutral-600 dark:text-neutral-400">
              {workspaceFileCount}
            </span>
          )}
        </button>
      </div>

      {/* Right zone: Theme toggle & Settings */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenSettings}
          aria-label="Settings and storage management"
          className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded transition-colors"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
