import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Bot,
  FileText,
  Loader2,
  Paperclip,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PublicAgentOwner, VerifiedType } from '../types';
import { GUARANTEED_FEMALE_VOICES, GUARANTEED_MALE_VOICES } from './PublishedAgentView';
import { VerifiedBadge } from './VerifiedBadge';

interface EmbedAgentViewProps {
  customName: string;
}

interface PublicAgent {
  id: string;
  customName: string;
  displayName: string;
  description?: string;
  avatar: string;
  modelId?: string;
  gender?: 'male' | 'female' | 'neutral';
  effortLevel: string;
  skills: string[];
  themeColor: string;
  themePreset: string;
  themeMode?: 'light' | 'dark';
  themeBg?: string;
  themeCard?: string;
  themeText?: string;
  allowsFileUploads: boolean;
  embedEnabled: boolean;
  owner?: PublicAgentOwner;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const EmbedAgentView: React.FC<EmbedAgentViewProps> = ({ customName }) => {
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchAgent = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/agents/${encodeURIComponent(customName)}`);
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Agent not found');
        }
        const data = await res.json();
        setAgent(data.agent);

        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `Hello! I am **${data.agent.displayName}**.\n\n${
              data.agent.description || 'How can I help you today?'
            }`,
            timestamp: Date.now(),
          },
        ]);
      } catch (err: any) {
        setError(err.message || 'Failed to load agent');
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [customName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakText = (text: string, msgId: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (currentlySpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/[*#`_\[\]()]/g, ' ')
      .replace(/\n+/g, '. ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const availableVoices = window.speechSynthesis.getVoices();
    const targetGender = agent?.gender || 'female';

    if (targetGender === 'female') {
      const match = availableVoices.find((v) =>
        GUARANTEED_FEMALE_VOICES.some((targetName) =>
          v.name.toLowerCase().includes(targetName.toLowerCase())
        ) ||
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('samantha')
      );
      if (match) utterance.voice = match;
      utterance.pitch = 1.1;
      utterance.rate = 1.0;
    } else if (targetGender === 'male') {
      const match = availableVoices.find((v) =>
        GUARANTEED_MALE_VOICES.some((targetName) =>
          v.name.toLowerCase().includes(targetName.toLowerCase())
        ) ||
        v.name.toLowerCase().includes('male') ||
        v.name.toLowerCase().includes('david') ||
        v.name.toLowerCase().includes('alex')
      );
      if (match) utterance.voice = match;
      utterance.pitch = 0.9;
      utterance.rate = 1.0;
    }

    utterance.onend = () => setCurrentlySpeakingId(null);
    utterance.onerror = () => setCurrentlySpeakingId(null);

    setCurrentlySpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && attachedFiles.length === 0) || sending || !agent) return;

    const userText = input.trim();
    const currentFiles = [...attachedFiles];
    setInput('');
    setAttachedFiles([]);

    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content:
        userText +
        (currentFiles.length > 0
          ? `\n\n*(Attached ${currentFiles.length} file(s): ${currentFiles
              .map((f) => f.name)
              .join(', ')})*`
          : ''),
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setSending(true);

    try {
      const history = nextMessages
        .filter((m) => m.id !== 'welcome')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`/api/public/agents/${encodeURIComponent(customName)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText || 'Please inspect the attached documents.',
          history,
          attachments: currentFiles,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chat request failed');
      }

      const botMsg: ChatMessage = {
        id: 'bot_' + Date.now(),
        role: 'assistant',
        content: data.response || 'No response returned.',
        timestamp: data.timestamp || Date.now(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `⚠️ ${err.message || 'Error occurred.'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result;
        if (typeof text === 'string') {
          setAttachedFiles((prev) => [...prev, { name: file.name, content: text }]);
        }
      };
      reader.readAsText(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-lg font-bold mb-2 animate-pulse">
          ꫧ
        </div>
        <p className="text-[11px] text-neutral-400 font-mono">Connecting...</p>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 text-center">
        <Bot className="w-6 h-6 text-red-400 mb-2" />
        <p className="text-xs text-neutral-400 max-w-xs">{error || 'Agent unavailable'}</p>
      </div>
    );
  }

  const themeColor = agent.themeColor || '#8b5cf6';
  const isLight = agent.themeMode === 'light';
  const bgColor = agent.themeBg || (isLight ? '#f8fafc' : '#0a0a0a');
  const cardColor = agent.themeCard || (isLight ? '#ffffff' : '#141416');
  const textColor = agent.themeText || (isLight ? '#0f172a' : '#fafafa');
  const borderColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  const owner = agent.owner;

  return (
    <div
      className="h-screen flex flex-col font-sans select-none overflow-hidden"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {/* Compact Top Header */}
      <header
        className="h-12 px-3 flex items-center justify-between border-b shrink-0 backdrop-blur-md"
        style={{
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(10, 10, 12, 0.9)',
          borderColor: borderColor,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-2xs overflow-hidden"
            style={{ backgroundColor: themeColor }}
          >
            {agent.avatar && agent.avatar.startsWith('data:image') ? (
              <img src={agent.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{agent.avatar || 'ꫧ'}</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-semibold truncate leading-tight">{agent.displayName}</h1>
            <span className="text-[9px] text-emerald-500 font-mono flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>
        </div>

        {owner && (
          <div className="flex items-center gap-1.5 pl-2">
            <span className="text-[10px] font-medium max-w-[90px] truncate">{owner.name || owner.username}</span>
            <VerifiedBadge type={owner.verifiedType} size="sm" />
          </div>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const isSpeaking = currentlySpeakingId === m.id;

          return (
            <div
              key={m.id}
              className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {!isUser && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5 overflow-hidden"
                  style={{ backgroundColor: themeColor }}
                >
                  {agent.avatar && agent.avatar.startsWith('data:image') ? (
                    <img src={agent.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{agent.avatar || 'ꫧ'}</span>
                  )}
                </div>
              )}

              <div className="max-w-[88%] flex flex-col items-start gap-0.5">
                <div
                  className={`rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-xs ${
                    isUser ? 'text-white' : ''
                  }`}
                  style={
                    isUser
                      ? { backgroundColor: themeColor }
                      : {
                          backgroundColor: cardColor,
                          border: `1px solid ${borderColor}`,
                          color: textColor,
                        }
                  }
                >
                  {isUser ? (
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  ) : (
                    <div className="prose prose-xs max-w-none break-words" style={{ color: textColor }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {!isUser && (
                  <button
                    type="button"
                    onClick={() => speakText(m.content, m.id)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] opacity-60 hover:opacity-100 transition cursor-pointer"
                    style={{ color: textColor }}
                  >
                    {isSpeaking ? (
                      <>
                        <VolumeX className="w-2.5 h-2.5 text-red-500 animate-pulse" />
                        <span className="text-red-500 font-medium">Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-2.5 h-2.5" />
                        <span>Speak</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-start gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5 overflow-hidden"
              style={{ backgroundColor: themeColor }}
            >
              {agent.avatar && agent.avatar.startsWith('data:image') ? (
                <img src={agent.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{agent.avatar || 'ꫧ'}</span>
              )}
            </div>
            <div
              className="rounded-2xl px-3 py-1.5 text-xs flex items-center gap-1.5 border shadow-2xs"
              style={{
                backgroundColor: cardColor,
                borderColor: borderColor,
                color: textColor,
              }}
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="opacity-70 text-[11px]">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Composer */}
      <footer
        className="p-2 border-t shrink-0"
        style={{
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(10, 10, 12, 0.95)',
          borderColor: borderColor,
        }}
      >
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5 px-1">
            {attachedFiles.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border shadow-2xs"
                style={{
                  backgroundColor: cardColor,
                  borderColor: borderColor,
                  color: textColor,
                }}
              >
                <FileText className="w-2.5 h-2.5 opacity-60" />
                <span className="truncate max-w-[100px]">{f.name}</span>
                <button
                  onClick={() => setAttachedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-0.5 opacity-60 hover:opacity-100"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSendMessage}
          className="flex items-end gap-1.5 rounded-xl p-1 border shadow-xs"
          style={{
            backgroundColor: cardColor,
            borderColor: borderColor,
          }}
        >
          {agent.allowsFileUploads && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                className="p-1.5 opacity-60 hover:opacity-100 transition rounded-lg cursor-pointer"
                style={{ color: textColor }}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}

          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-0 px-2 py-1 text-xs resize-none focus:outline-hidden min-h-[30px] max-h-[100px]"
            style={{ color: textColor }}
          />

          <button
            type="submit"
            disabled={(!input.trim() && attachedFiles.length === 0) || sending}
            className="p-1.5 text-white rounded-lg transition disabled:opacity-40 cursor-pointer shadow-xs shrink-0"
            style={{ backgroundColor: themeColor }}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </form>
      </footer>
    </div>
  );
};
