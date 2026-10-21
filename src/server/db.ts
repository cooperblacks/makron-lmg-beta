import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { AgentThemePreset, CustomAgent, ReasoningLevel, UserTier } from '../types';

export interface DbUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  tier: UserTier;
  apiKeys: Record<string, string>;
  createdAt: number;
}

const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '';
const hasNeonDb = Boolean(DB_URL && DB_URL.startsWith('postgres'));

// Local persistence file for fallback
const LOCAL_STORE_FILE = path.join(process.cwd(), '.neondb_local_store.json');

interface LocalStore {
  users: DbUser[];
  agents: CustomAgent[];
}

let localStore: LocalStore = {
  users: [],
  agents: [],
};

// Load existing fallback store if present
try {
  if (fs.existsSync(LOCAL_STORE_FILE)) {
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
    localStore = JSON.parse(raw);
  }
} catch {
  // fresh store
}

function saveLocalStore() {
  try {
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(localStore, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write local store:', err);
  }
}

// SQL client for Neon
const sql = hasNeonDb ? neon(DB_URL) : null;

// Initialize tables if NeonDB is connected
export async function initDatabase() {
  if (sql) {
    try {
      console.log('[NeonDB] Connecting and initializing schema...');
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          tier VARCHAR(32) DEFAULT 'free',
          api_keys TEXT,
          created_at BIGINT
        );
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS agents (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          custom_name VARCHAR(128) UNIQUE NOT NULL,
          display_name VARCHAR(255) NOT NULL,
          description TEXT,
          avatar VARCHAR(255),
          system_prompt TEXT,
          effort_level VARCHAR(32),
          skills TEXT,
          theme_color VARCHAR(64),
          theme_preset VARCHAR(64),
          allows_file_uploads BOOLEAN DEFAULT false,
          embed_enabled BOOLEAN DEFAULT true,
          created_at BIGINT,
          updated_at BIGINT
        );
      `;
      console.log('[NeonDB] Schema verified successfully.');
    } catch (err) {
      console.warn('[NeonDB] Initialization failed, operating with resilient local storage fallback:', err);
    }
  } else {
    console.log('[Database] NeonDB URL not set in environment. Running with local persistent storage fallback.');
  }
}

export const dbService = {
  // --- USERS ---
  async getUserByEmail(email: string): Promise<DbUser | null> {
    const cleanEmail = email.trim().toLowerCase();
    if (sql) {
      try {
        const rows = await sql`
          SELECT id, email, password_hash as "passwordHash", name, tier, api_keys as "apiKeysJson", created_at as "createdAt"
          FROM users WHERE email = ${cleanEmail} LIMIT 1
        `;
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            email: r.email,
            passwordHash: r.passwordHash,
            name: r.name,
            tier: (r.tier as UserTier) || 'free',
            apiKeys: r.apiKeysJson ? JSON.parse(r.apiKeysJson) : {},
            createdAt: Number(r.createdAt),
          };
        }
        return null;
      } catch (err) {
        console.warn('Neon query error, falling back to local store:', err);
      }
    }

    const u = localStore.users.find((u) => u.email.toLowerCase() === cleanEmail);
    return u ? { ...u } : null;
  },

  async getUserById(id: string): Promise<DbUser | null> {
    if (sql) {
      try {
        const rows = await sql`
          SELECT id, email, password_hash as "passwordHash", name, tier, api_keys as "apiKeysJson", created_at as "createdAt"
          FROM users WHERE id = ${id} LIMIT 1
        `;
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            email: r.email,
            passwordHash: r.passwordHash,
            name: r.name,
            tier: (r.tier as UserTier) || 'free',
            apiKeys: r.apiKeysJson ? JSON.parse(r.apiKeysJson) : {},
            createdAt: Number(r.createdAt),
          };
        }
        return null;
      } catch (err) {
        console.warn('Neon query error, falling back to local store:', err);
      }
    }

    const u = localStore.users.find((u) => u.id === id);
    return u ? { ...u } : null;
  },

  async createUser(email: string, password: string, name?: string): Promise<DbUser> {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await this.getUserByEmail(cleanEmail);
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = 'usr_' + Math.random().toString(36).substring(2, 11);
    const tier: UserTier = 'free'; // default
    const createdAt = Date.now();
    const apiKeys: Record<string, string> = {};

    if (sql) {
      try {
        await sql`
          INSERT INTO users (id, email, password_hash, name, tier, api_keys, created_at)
          VALUES (${id}, ${cleanEmail}, ${passwordHash}, ${name || ''}, ${tier}, ${JSON.stringify(apiKeys)}, ${createdAt})
        `;
        return { id, email: cleanEmail, passwordHash, name, tier, apiKeys, createdAt };
      } catch (err) {
        console.warn('Neon insert error, saving to local store:', err);
      }
    }

    const newUser: DbUser = { id, email: cleanEmail, passwordHash, name, tier, apiKeys, createdAt };
    localStore.users.push(newUser);
    saveLocalStore();
    return newUser;
  },

  async updateUserApiKeys(userId: string, apiKeys: Record<string, string>): Promise<void> {
    if (sql) {
      try {
        await sql`
          UPDATE users SET api_keys = ${JSON.stringify(apiKeys)} WHERE id = ${userId}
        `;
        return;
      } catch (err) {
        console.warn('Neon update error:', err);
      }
    }

    const u = localStore.users.find((u) => u.id === userId);
    if (u) {
      u.apiKeys = { ...u.apiKeys, ...apiKeys };
      saveLocalStore();
    }
  },

  async updateUserTier(userId: string, tier: UserTier): Promise<void> {
    if (sql) {
      try {
        await sql`UPDATE users SET tier = ${tier} WHERE id = ${userId}`;
        return;
      } catch (err) {
        console.warn('Neon tier update error:', err);
      }
    }

    const u = localStore.users.find((u) => u.id === userId);
    if (u) {
      u.tier = tier;
      saveLocalStore();
    }
  },

  // --- AGENTS ---
  async getAgentsByUserId(userId: string): Promise<CustomAgent[]> {
    if (sql) {
      try {
        const rows = await sql`
          SELECT id, user_id as "userId", custom_name as "customName", display_name as "displayName",
                 description, avatar, system_prompt as "systemPrompt", effort_level as "effortLevel",
                 skills as "skillsJson", theme_color as "themeColor", theme_preset as "themePreset",
                 allows_file_uploads as "allowsFileUploads", embed_enabled as "embedEnabled",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM agents WHERE user_id = ${userId} ORDER BY created_at DESC
        `;
        return rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          customName: r.customName,
          displayName: r.displayName,
          description: r.description || '',
          avatar: r.avatar || 'ꫧ',
          systemPrompt: r.systemPrompt || '',
          effortLevel: (r.effortLevel as ReasoningLevel) || 'auto',
          skills: r.skillsJson ? JSON.parse(r.skillsJson) : [],
          themeColor: r.themeColor || '#3b82f6',
          themePreset: (r.themePreset as AgentThemePreset) || 'slate',
          allowsFileUploads: Boolean(r.allowsFileUploads),
          embedEnabled: Boolean(r.embedEnabled),
          createdAt: Number(r.createdAt),
          updatedAt: Number(r.updatedAt),
        }));
      } catch (err) {
        console.warn('Neon get agents error:', err);
      }
    }

    return localStore.agents.filter((a) => a.userId === userId);
  },

  async getAgentByCustomName(customName: string): Promise<CustomAgent | null> {
    const slug = customName.trim().toLowerCase();
    if (sql) {
      try {
        const rows = await sql`
          SELECT id, user_id as "userId", custom_name as "customName", display_name as "displayName",
                 description, avatar, system_prompt as "systemPrompt", effort_level as "effortLevel",
                 skills as "skillsJson", theme_color as "themeColor", theme_preset as "themePreset",
                 allows_file_uploads as "allowsFileUploads", embed_enabled as "embedEnabled",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM agents WHERE LOWER(custom_name) = ${slug} LIMIT 1
        `;
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            userId: r.userId,
            customName: r.customName,
            displayName: r.displayName,
            description: r.description || '',
            avatar: r.avatar || 'ꫧ',
            systemPrompt: r.systemPrompt || '',
            effortLevel: (r.effortLevel as ReasoningLevel) || 'auto',
            skills: r.skillsJson ? JSON.parse(r.skillsJson) : [],
            themeColor: r.themeColor || '#3b82f6',
            themePreset: (r.themePreset as AgentThemePreset) || 'slate',
            allowsFileUploads: Boolean(r.allowsFileUploads),
            embedEnabled: Boolean(r.embedEnabled),
            createdAt: Number(r.createdAt),
            updatedAt: Number(r.updatedAt),
          };
        }
        return null;
      } catch (err) {
        console.warn('Neon get agent by name error:', err);
      }
    }

    const a = localStore.agents.find((a) => a.customName.toLowerCase() === slug);
    return a ? { ...a } : null;
  },

  async createAgent(
    userId: string,
    agentData: Omit<CustomAgent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomAgent> {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const userAgents = await this.getAgentsByUserId(userId);
    const maxAgents = user.tier === 'paid' ? 100 : 3;

    if (userAgents.length >= maxAgents) {
      throw new Error(`Agent limit reached for your tier (max ${maxAgents}).`);
    }

    const cleanSlug = agentData.customName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanSlug) throw new Error('A valid custom name identifier is required.');

    const existingSlug = await this.getAgentByCustomName(cleanSlug);
    if (existingSlug) {
      throw new Error(`The custom name "${cleanSlug}" is already taken. Please choose another.`);
    }

    const id = 'agt_' + Math.random().toString(36).substring(2, 11);
    const now = Date.now();

    const newAgent: CustomAgent = {
      id,
      userId,
      customName: cleanSlug,
      displayName: agentData.displayName.trim() || cleanSlug,
      description: agentData.description || '',
      avatar: agentData.avatar || 'ꫧ',
      systemPrompt: agentData.systemPrompt || '',
      effortLevel: agentData.effortLevel || 'auto',
      skills: agentData.skills || ['code_execution', 'file_generation'],
      themeColor: agentData.themeColor || '#3b82f6',
      themePreset: agentData.themePreset || 'slate',
      allowsFileUploads: Boolean(agentData.allowsFileUploads),
      embedEnabled: agentData.embedEnabled !== false,
      createdAt: now,
      updatedAt: now,
    };

    if (sql) {
      try {
        await sql`
          INSERT INTO agents (
            id, user_id, custom_name, display_name, description, avatar,
            system_prompt, effort_level, skills, theme_color, theme_preset,
            allows_file_uploads, embed_enabled, created_at, updated_at
          ) VALUES (
            ${newAgent.id}, ${newAgent.userId}, ${newAgent.customName}, ${newAgent.displayName},
            ${newAgent.description}, ${newAgent.avatar}, ${newAgent.systemPrompt},
            ${newAgent.effortLevel}, ${JSON.stringify(newAgent.skills)}, ${newAgent.themeColor},
            ${newAgent.themePreset}, ${newAgent.allowsFileUploads}, ${newAgent.embedEnabled},
            ${newAgent.createdAt}, ${newAgent.updatedAt}
          )
        `;
        return newAgent;
      } catch (err) {
        console.warn('Neon create agent error:', err);
      }
    }

    localStore.agents.push(newAgent);
    saveLocalStore();
    return newAgent;
  },

  async updateAgent(
    id: string,
    userId: string,
    updates: Partial<Omit<CustomAgent, 'id' | 'userId' | 'createdAt'>>
  ): Promise<CustomAgent> {
    const existing = sql ? await this.getAgentById(id) : localStore.agents.find((a) => a.id === id);
    if (!existing) throw new Error('Agent not found');
    if (existing.userId !== userId) throw new Error('Unauthorized');

    if (updates.customName && updates.customName.toLowerCase() !== existing.customName.toLowerCase()) {
      const cleanSlug = updates.customName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const clash = await this.getAgentByCustomName(cleanSlug);
      if (clash && clash.id !== id) {
        throw new Error(`The custom name "${cleanSlug}" is already taken.`);
      }
      updates.customName = cleanSlug;
    }

    const updated: CustomAgent = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    if (sql) {
      try {
        await sql`
          UPDATE agents SET
            custom_name = ${updated.customName},
            display_name = ${updated.displayName},
            description = ${updated.description},
            avatar = ${updated.avatar},
            system_prompt = ${updated.systemPrompt},
            effort_level = ${updated.effortLevel},
            skills = ${JSON.stringify(updated.skills)},
            theme_color = ${updated.themeColor},
            theme_preset = ${updated.themePreset},
            allows_file_uploads = ${updated.allowsFileUploads},
            embed_enabled = ${updated.embedEnabled},
            updated_at = ${updated.updatedAt}
          WHERE id = ${id} AND user_id = ${userId}
        `;
        return updated;
      } catch (err) {
        console.warn('Neon update agent error:', err);
      }
    }

    const idx = localStore.agents.findIndex((a) => a.id === id);
    if (idx >= 0) {
      localStore.agents[idx] = updated;
      saveLocalStore();
    }
    return updated;
  },

  async deleteAgent(id: string, userId: string): Promise<boolean> {
    if (sql) {
      try {
        await sql`DELETE FROM agents WHERE id = ${id} AND user_id = ${userId}`;
        return true;
      } catch (err) {
        console.warn('Neon delete agent error:', err);
      }
    }

    const before = localStore.agents.length;
    localStore.agents = localStore.agents.filter((a) => !(a.id === id && a.userId === userId));
    saveLocalStore();
    return localStore.agents.length < before;
  },

  async getAgentById(id: string): Promise<CustomAgent | null> {
    if (sql) {
      try {
        const rows = await sql`
          SELECT id, user_id as "userId", custom_name as "customName", display_name as "displayName",
                 description, avatar, system_prompt as "systemPrompt", effort_level as "effortLevel",
                 skills as "skillsJson", theme_color as "themeColor", theme_preset as "themePreset",
                 allows_file_uploads as "allowsFileUploads", embed_enabled as "embedEnabled",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM agents WHERE id = ${id} LIMIT 1
        `;
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            userId: r.userId,
            customName: r.customName,
            displayName: r.displayName,
            description: r.description || '',
            avatar: r.avatar || 'ꫧ',
            systemPrompt: r.systemPrompt || '',
            effortLevel: (r.effortLevel as ReasoningLevel) || 'auto',
            skills: r.skillsJson ? JSON.parse(r.skillsJson) : [],
            themeColor: r.themeColor || '#3b82f6',
            themePreset: (r.themePreset as AgentThemePreset) || 'slate',
            allowsFileUploads: Boolean(r.allowsFileUploads),
            embedEnabled: Boolean(r.embedEnabled),
            createdAt: Number(r.createdAt),
            updatedAt: Number(r.updatedAt),
          };
        }
        return null;
      } catch (err) {
        console.warn('Neon get agent by id error:', err);
      }
    }

    const a = localStore.agents.find((a) => a.id === id);
    return a ? { ...a } : null;
  },
};
