import { Checkpoint, Conversation, Message, UserSettings, VirtualFile } from '../types';

const DB_NAME = 'makron_db';
const DB_VERSION = 1;

export class LocalStorageDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;

        // Conversations
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Messages
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Virtual Files
        if (!db.objectStoreNames.contains('virtual_files')) {
          const store = db.createObjectStore('virtual_files', { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
          store.createIndex('conversation_path', ['conversationId', 'path'], { unique: true });
        }

        // Checkpoints
        if (!db.objectStoreNames.contains('checkpoints')) {
          const store = db.createObjectStore('checkpoints', { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId', { unique: false });
        }

        // Settings / Key-Value
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Conversations ---
  async getConversations(): Promise<Conversation[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readonly');
      const store = tx.objectStore('conversations');
      const req = store.getAll();
      req.onsuccess = () => {
        const list: Conversation[] = req.result || [];
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getConversation(id: string): Promise<Conversation | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readonly');
      const req = tx.objectStore('conversations').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveConversation(conv: Conversation): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readwrite');
      const req = tx.objectStore('conversations').put(conv);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteConversation(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(['conversations', 'messages', 'virtual_files', 'checkpoints'], 'readwrite');
    
    // delete conversation
    tx.objectStore('conversations').delete(id);

    // delete messages
    const msgStore = tx.objectStore('messages');
    const msgIdx = msgStore.index('conversationId');
    const msgReq = msgIdx.getAllKeys(id);
    msgReq.onsuccess = () => {
      for (const key of msgReq.result) {
        msgStore.delete(key);
      }
    };

    // delete files
    const fileStore = tx.objectStore('virtual_files');
    const fileIdx = fileStore.index('conversationId');
    const fileReq = fileIdx.getAllKeys(id);
    fileReq.onsuccess = () => {
      for (const key of fileReq.result) {
        fileStore.delete(key);
      }
    };

    // delete checkpoints
    const cpStore = tx.objectStore('checkpoints');
    const cpIdx = cpStore.index('conversationId');
    const cpReq = cpIdx.getAllKeys(id);
    cpReq.onsuccess = () => {
      for (const key of cpReq.result) {
        cpStore.delete(key);
      }
    };

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Messages ---
  async getMessages(conversationId: string): Promise<Message[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const idx = store.index('conversationId');
      const req = idx.getAll(conversationId);
      req.onsuccess = () => {
        const msgs: Message[] = req.result || [];
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        resolve(msgs);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveMessage(msg: Message): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const req = tx.objectStore('messages').put(msg);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Virtual Files ---
  async getFiles(conversationId: string): Promise<VirtualFile[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('virtual_files', 'readonly');
      const store = tx.objectStore('virtual_files');
      const idx = store.index('conversationId');
      const req = idx.getAll(conversationId);
      req.onsuccess = () => {
        const files: VirtualFile[] = req.result || [];
        files.sort((a, b) => a.path.localeCompare(b.path));
        resolve(files);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getFileByPath(conversationId: string, path: string): Promise<VirtualFile | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('virtual_files', 'readonly');
      const store = tx.objectStore('virtual_files');
      const idx = store.index('conversation_path');
      const req = idx.get([conversationId, path]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveFile(file: VirtualFile): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('virtual_files', 'readwrite');
      const req = tx.objectStore('virtual_files').put(file);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteFile(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('virtual_files', 'readwrite');
      const req = tx.objectStore('virtual_files').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Checkpoints ---
  async getCheckpoints(conversationId: string): Promise<Checkpoint[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checkpoints', 'readonly');
      const store = tx.objectStore('checkpoints');
      const idx = store.index('conversationId');
      const req = idx.getAll(conversationId);
      req.onsuccess = () => {
        const list: Checkpoint[] = req.result || [];
        list.sort((a, b) => b.timestamp - a.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveCheckpoint(checkpoint: Checkpoint): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('checkpoints', 'readwrite');
      const req = tx.objectStore('checkpoints').put(checkpoint);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Settings ---
  async getSettings(): Promise<UserSettings> {
    const defaultSettings: UserSettings = {
      theme: 'dark',
      defaultModelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
      devicePreference: 'webgpu',
      autoApproveTools: false,
      lastNonEmptySystemPrompt: 'You are an expert autonomous software engineer and analyst. Break down goals into structured steps and use available tools to build precise solutions.',
      maxRepairAttempts: 2,
    };

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get('user_settings');
        req.onsuccess = () => {
          if (req.result && req.result.value) {
            resolve({ ...defaultSettings, ...req.result.value });
          } else {
            resolve(defaultSettings);
          }
        };
        req.onerror = () => resolve(defaultSettings);
      });
    } catch {
      return defaultSettings;
    }
  }

  async saveSettings(settings: UserSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const req = tx.objectStore('settings').put({ key: 'user_settings', value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- Storage Quota, Category Breakdown & Granular Clear ---
  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      return {
        usage: est.usage || 0,
        quota: est.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }

  async getCategoryStats(): Promise<{
    conversationsCount: number;
    messagesCount: number;
    filesCount: number;
    filesBytes: number;
    checkpointsCount: number;
  }> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['conversations', 'messages', 'virtual_files', 'checkpoints'], 'readonly');
      const convReq = tx.objectStore('conversations').count();
      const msgReq = tx.objectStore('messages').count();
      const fileStore = tx.objectStore('virtual_files');
      const fileCountReq = fileStore.count();
      const fileAllReq = fileStore.getAll();
      const cpReq = tx.objectStore('checkpoints').count();

      tx.oncomplete = () => {
        const files: VirtualFile[] = fileAllReq.result || [];
        const filesBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
        resolve({
          conversationsCount: convReq.result || 0,
          messagesCount: msgReq.result || 0,
          filesCount: fileCountReq.result || 0,
          filesBytes,
          checkpointsCount: cpReq.result || 0,
        });
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearCategory(category: 'conversations' | 'virtual_files' | 'checkpoints'): Promise<void> {
    const db = await this.getDB();
    const storesToClear = category === 'conversations' ? ['conversations', 'messages'] : [category];
    const tx = db.transaction(storesToClear, 'readwrite');
    for (const store of storesToClear) {
      tx.objectStore(store).clear();
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async importBackup(data: {
    conversations?: Conversation[];
    messages?: Message[];
    files?: VirtualFile[];
    checkpoints?: Checkpoint[];
    settings?: UserSettings;
  }): Promise<void> {
    const db = await this.getDB();
    const stores = ['conversations', 'messages', 'virtual_files', 'checkpoints', 'settings'];
    const tx = db.transaction(stores, 'readwrite');

    if (data.conversations && Array.isArray(data.conversations)) {
      const store = tx.objectStore('conversations');
      for (const c of data.conversations) store.put(c);
    }
    if (data.messages && Array.isArray(data.messages)) {
      const store = tx.objectStore('messages');
      for (const m of data.messages) store.put(m);
    }
    if (data.files && Array.isArray(data.files)) {
      const store = tx.objectStore('virtual_files');
      for (const f of data.files) store.put(f);
    }
    if (data.checkpoints && Array.isArray(data.checkpoints)) {
      const store = tx.objectStore('checkpoints');
      for (const cp of data.checkpoints) store.put(cp);
    }
    if (data.settings) {
      tx.objectStore('settings').put({ key: 'user_settings', value: data.settings });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async wipeAllData(): Promise<void> {
    const db = await this.getDB();
    const stores = ['conversations', 'messages', 'virtual_files', 'checkpoints', 'settings'];
    const tx = db.transaction(stores, 'readwrite');
    for (const name of stores) {
      tx.objectStore(name).clear();
    }

    // Also clear Cache API (model weights downloaded by transformers.js)
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      } catch (e) {
        console.warn('Failed to clear caches:', e);
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const db = new LocalStorageDB();
