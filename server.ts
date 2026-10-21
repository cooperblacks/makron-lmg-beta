import { GoogleGenAI } from '@google/genai';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbService, initDatabase } from './src/server/db';
import { AuthUser, CustomAgent, ReasoningLevel } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'makron-secret-key-2026-production';

app.use(express.json({ limit: '25mb' }));

// Auth Middleware
interface AuthRequest extends Request {
  user?: AuthUser;
}

const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const user = await dbService.getUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: user.tier,
      apiKeysConfigured: Object.keys(user.apiKeys || {}).filter((k) => Boolean(user.apiKeys[k])),
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
};

// -----------------------------------------------------------------------------
// AUTH ROUTES
// -----------------------------------------------------------------------------

app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const newUser = await dbService.createUser(email, password, name);
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        tier: newUser.tier,
        agentCount: 0,
        apiKeysConfigured: [],
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Signup failed' });
  }
});

app.post('/api/auth/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await dbService.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.default.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userAgents = await dbService.getAgentsByUserId(user.id);
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        agentCount: userAgents.length,
        apiKeysConfigured: Object.keys(user.apiKeys || {}).filter((k) => Boolean(user.apiKeys[k])),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Signin failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userAgents = await dbService.getAgentsByUserId(req.user!.id);
    res.json({
      user: {
        ...req.user,
        agentCount: userAgents.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/keys', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await dbService.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Return key presence without exposing raw secrets
    const summary: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(user.apiKeys || {})) {
      summary[k] = Boolean(v && v.trim());
    }
    res.json({ keys: summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/auth/keys', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { apiKeys } = req.body;
    if (!apiKeys || typeof apiKeys !== 'object') {
      return res.status(400).json({ error: 'Invalid apiKeys payload' });
    }
    await dbService.updateUserApiKeys(req.user!.id, apiKeys);
    res.json({ success: true, message: 'API keys saved securely' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// USER AGENT MANAGEMENT ROUTES (AUTHENTICATED)
// -----------------------------------------------------------------------------

app.get('/api/agents', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const agents = await dbService.getAgentsByUserId(req.user!.id);
    res.json({ agents });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const agent = await dbService.createAgent(req.user!.id, req.body);
    res.status(201).json({ agent });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create agent' });
  }
});

app.put('/api/agents/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const updated = await dbService.updateAgent(req.params.id, req.user!.id, req.body);
    res.json({ agent: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update agent' });
  }
});

app.delete('/api/agents/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const success = await dbService.deleteAgent(req.params.id, req.user!.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete agent' });
  }
});

// -----------------------------------------------------------------------------
// PUBLIC VISITOR AGENT ROUTES (NO AUTH REQUIRED)
// -----------------------------------------------------------------------------

// Get published agent metadata for /agent/:customName and /embed/agent/:customName
app.get('/api/public/agents/:customName', async (req: Request, res: Response) => {
  try {
    const { customName } = req.params;
    const agent = await dbService.getAgentByCustomName(customName);
    if (!agent) {
      return res.status(404).json({ error: `Agent "${customName}" not found.` });
    }

    // Public view: NEVER expose owner user ID or raw API keys!
    res.json({
      agent: {
        id: agent.id,
        customName: agent.customName,
        displayName: agent.displayName,
        description: agent.description,
        avatar: agent.avatar,
        effortLevel: agent.effortLevel,
        skills: agent.skills,
        themeColor: agent.themeColor,
        themePreset: agent.themePreset,
        allowsFileUploads: agent.allowsFileUploads,
        embedEnabled: agent.embedEnabled,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public Chat endpoint for published agents
app.post('/api/public/agents/:customName/chat', async (req: Request, res: Response) => {
  try {
    const { customName } = req.params;
    const { message, history, attachments } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const agent = await dbService.getAgentByCustomName(customName);
    if (!agent) {
      return res.status(404).json({ error: `Agent "${customName}" not found.` });
    }

    // Load owner's secure credentials from db
    const owner = await dbService.getUserById(agent.userId);
    const ownerApiKeys = owner?.apiKeys || {};

    // Determine API Key: Agent owner's configured Gemini or OpenAI key, or system GEMINI_API_KEY
    const geminiKey = ownerApiKeys.gemini || process.env.GEMINI_API_KEY;
    const openaiKey = ownerApiKeys.openai;

    let responseText = '';

    // Prepare context instructions
    const effortInstruction =
      agent.effortLevel === 'low'
        ? 'Provide direct, concise, immediate answers without preamble.'
        : agent.effortLevel === 'high' || agent.effortLevel === 'max'
        ? 'Provide comprehensive, thoroughly analyzed and structured multi-step solutions with detailed code or operational blueprints where appropriate.'
        : 'Provide balanced, well-reasoned, actionable assistance.';

    const systemInstruction = `You are "${agent.displayName}", an AI assistant.\n${agent.description ? `Description: ${agent.description}\n` : ''}${agent.systemPrompt ? `Context & Directives:\n${agent.systemPrompt}\n` : ''}\nEffort & Reasoning Policy: ${effortInstruction}\nActive Capabilities: ${agent.skills.join(', ')}`;

    // Build dialogue messages for model
    const priorTurns = Array.isArray(history)
      ? history.slice(-8).map((h: { role: string; content: string }) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          text: h.content,
        }))
      : [];

    let attachmentsText = '';
    if (agent.allowsFileUploads && Array.isArray(attachments) && attachments.length > 0) {
      attachmentsText = '\n\nAttached User Documents:\n' + attachments.map((a: any) => `[File: ${a.name}]\n${a.content || a.extractedText || ''}`).join('\n\n');
    }

    // Inference execution
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const contents: any[] = [];

        for (const turn of priorTurns) {
          contents.push({ role: turn.role, parts: [{ text: turn.text }] });
        }
        contents.push({ role: 'user', parts: [{ text: message + attachmentsText }] });

        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction,
            temperature: agent.effortLevel === 'low' ? 0.2 : 0.7,
          },
        });

        responseText = result.text || 'I have processed your request.';
      } catch (geminiErr: any) {
        console.warn('Gemini call failed:', geminiErr);
        responseText = `[Error generating response: ${geminiErr.message || String(geminiErr)}]`;
      }
    } else if (openaiKey) {
      try {
        const fetchRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemInstruction },
              ...priorTurns.map((t: any) => ({ role: t.role === 'model' ? 'assistant' : 'user', content: t.text })),
              { role: 'user', content: message + attachmentsText },
            ],
            temperature: 0.3,
          }),
        });
        const openAiData = await fetchRes.json();
        responseText = openAiData.choices?.[0]?.message?.content || 'No response generated.';
      } catch (openAiErr: any) {
        responseText = `[OpenAI error: ${openAiErr.message}]`;
      }
    } else {
      // Fallback response with helpful information
      responseText = `Hello! I am ${agent.displayName}. My owner has configured me with the following directives:\n\n${agent.systemPrompt || 'General assistance.'}\n\nTo enable full live AI inference, the agent owner can save their Gemini or OpenAI API key in their Makron account settings panel.`;
    }

    res.json({
      response: responseText,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chat generation failed' });
  }
});

// -----------------------------------------------------------------------------
// EMBED WIDGET JAVASCRIPT SNIPPET (GET /embed.js)
// -----------------------------------------------------------------------------
app.get('/embed.js', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
(function() {
  var script = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  var agentSlug = script.getAttribute('data-agent');
  if (!agentSlug) {
    console.error('[Makron Embed] Missing data-agent attribute on script tag.');
    return;
  }

  var host = window.location.origin;
  try {
    var url = new URL(script.src);
    host = url.origin;
  } catch(e) {}

  var themeColor = script.getAttribute('data-color') || '#3b82f6';

  // Create floating circular launcher with "ꫧ" in center
  var launcher = document.createElement('div');
  launcher.id = 'makron-launcher-' + agentSlug;
  launcher.style.position = 'fixed';
  launcher.style.bottom = '24px';
  launcher.style.right = '24px';
  launcher.style.width = '56px';
  launcher.style.height = '56px';
  launcher.style.borderRadius = '50%';
  launcher.style.backgroundColor = themeColor;
  launcher.style.color = '#ffffff';
  launcher.style.display = 'flex';
  launcher.style.alignItems = 'center';
  launcher.style.justifyContent = 'center';
  launcher.style.fontSize = '26px';
  launcher.style.fontWeight = 'bold';
  launcher.style.cursor = 'pointer';
  launcher.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
  launcher.style.zIndex = '999998';
  launcher.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
  launcher.innerText = 'ꫧ';

  launcher.onmouseenter = function() { launcher.style.transform = 'scale(1.08)'; };
  launcher.onmouseleave = function() { launcher.style.transform = 'scale(1)'; };

  // Create iframe container for embed agent chat
  var container = document.createElement('div');
  container.id = 'makron-frame-container-' + agentSlug;
  container.style.position = 'fixed';
  container.style.bottom = '92px';
  container.style.right = '24px';
  container.style.width = '380px';
  container.style.maxWidth = 'calc(100vw - 32px)';
  container.style.height = '560px';
  container.style.maxHeight = 'calc(100vh - 120px)';
  container.style.borderRadius = '16px';
  container.style.overflow = 'hidden';
  container.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
  container.style.zIndex = '999999';
  container.style.display = 'none';
  container.style.border = '1px solid rgba(255,255,255,0.15)';
  container.style.background = '#0a0a0a';

  var iframe = document.createElement('iframe');
  iframe.src = host + '/embed/agent/' + encodeURIComponent(agentSlug);
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.setAttribute('allow', 'clipboard-write');

  container.appendChild(iframe);
  document.body.appendChild(launcher);
  document.body.appendChild(container);

  var isOpen = false;
  launcher.onclick = function() {
    isOpen = !isOpen;
    container.style.display = isOpen ? 'block' : 'none';
    launcher.innerText = isOpen ? '✕' : 'ꫧ';
  };
})();
`);
});

// -----------------------------------------------------------------------------
// VITE DEV SERVER OR PRODUCTION STATIC SERVING
// -----------------------------------------------------------------------------

async function startServer() {
  await initDatabase();

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Makron Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Makron Server] Startup error:', err);
  process.exit(1);
});
