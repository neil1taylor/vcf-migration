/**
 * IBM Code Engine - AI Proxy for watsonx.ai
 *
 * This service proxies requests to IBM watsonx.ai, keeping API credentials
 * server-side and providing caching to manage API costs.
 *
 * Environment Variables:
 *   - IBM_CLOUD_API_KEY: IBM Cloud API key with watsonx.ai access
 *   - WATSONX_PROJECT_ID: watsonx.ai project ID
 *   - WATSONX_MODEL_ID: Model to use (default: ibm/granite-3-8b-instruct)
 *   - AI_PROXY_API_KEY: Shared secret for client authentication
 *   - PORT: Server port (default: 8080)
 */

const express = require('express');
const cors = require('cors');
const { generateText, chat } = require('./watsonx');
const {
  buildClassificationPrompt,
  buildRightsizingPrompt,
  buildInsightsPrompt,
  buildChatSystemPrompt,
} = require('./prompts');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration
const API_KEY = process.env.IBM_CLOUD_API_KEY;
const PROJECT_ID = process.env.WATSONX_PROJECT_ID;
const MODEL_ID = process.env.WATSONX_MODEL_ID || 'ibm/granite-3-8b-instruct';
const PROXY_API_KEY = process.env.AI_PROXY_API_KEY;

// Cache configuration
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map(); // key -> { data, timestamp }

// Rate limiting (simple in-memory)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // requests per window
const rateLimitMap = new Map(); // ip -> { count, windowStart }

// ===== MIDDLEWARE =====

app.use(cors());
app.use(express.json({ limit: '1mb' }));

/**
 * API key authentication middleware for /api/* routes
 */
function authenticateApiKey(req, res, next) {
  if (!PROXY_API_KEY) {
    // If no API key configured on server, skip auth
    return next();
  }

  const clientKey = req.headers['x-api-key'];
  if (!clientKey || clientKey !== PROXY_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * Rate limiting middleware
 */
function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
  }

  entry.count++;
  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart),
    });
  }

  next();
}

// Apply auth and rate limiting to API routes
app.use('/api', authenticateApiKey, rateLimit);

// ===== HEALTH ENDPOINTS =====

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    model: MODEL_ID,
    projectId: PROJECT_ID ? 'configured' : 'not configured',
  });
});

app.get('/ready', (req, res) => {
  const ready = !!API_KEY && !!PROJECT_ID;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not ready',
    apiKey: API_KEY ? 'configured' : 'missing',
    projectId: PROJECT_ID ? 'configured' : 'missing',
  });
});

// ===== CACHE HELPERS =====

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });

  // Limit cache size
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 20; i++) {
      cache.delete(oldest[i][0]);
    }
  }
}

/**
 * Parse JSON from LLM output, handling markdown code blocks
 */
function parseJSONResponse(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    // Try finding JSON array or object
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error('Could not parse JSON from LLM response');
  }
}

// ===== API ENDPOINTS =====

/**
 * POST /api/classify - Classify VM workloads
 */
app.post('/api/classify', async (req, res) => {
  try {
    const { vms } = req.body;

    if (!vms || !Array.isArray(vms) || vms.length === 0) {
      return res.status(400).json({ error: 'Request must include a non-empty vms array' });
    }

    // Check cache
    const cacheKey = `classify:${JSON.stringify(vms.map(v => v.vmName).sort())}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Categories aligned with workloadPatterns.json names
    const categories = [
      'Databases',
      'Middleware / Application Servers',
      'Enterprise Applications',
      'Backup & Recovery',
      'Security & Compliance',
      'Monitoring & Management',
      'Virtualization Infrastructure',
      'Container Platforms',
      'Messaging & Integration',
      'Storage Systems',
      'Network Equipment',
      'Cloud Services',
      'DevOps & CI/CD',
      'Identity & Access',
      'Other',
    ];

    const startTime = Date.now();

    // Process in batches of 10 (smaller batches reduce LLM output truncation)
    const batchSize = 10;
    const allClassifications = [];

    for (let i = 0; i < vms.length; i += batchSize) {
      const batch = vms.slice(i, i + batchSize);
      const prompt = buildClassificationPrompt(batch, categories);

      try {
        const rawResponse = await generateText({
          prompt,
          apiKey: API_KEY,
          projectId: PROJECT_ID,
          modelId: MODEL_ID,
          parameters: { max_new_tokens: 8192, temperature: 0.1 },
        });

        const parsed = parseJSONResponse(rawResponse);
        const classifications = Array.isArray(parsed) ? parsed : parsed.classifications || [];

        // Add source field
        for (const c of classifications) {
          c.source = 'ai';
        }

        allClassifications.push(...classifications);
      } catch (batchError) {
        console.warn(`[classify] Batch ${Math.floor(i / batchSize) + 1} failed: ${batchError.message}. Skipping batch.`);
        // Continue with next batch instead of failing the entire request
      }
    }

    const result = {
      classifications: allClassifications,
      model: MODEL_ID,
      processingTimeMs: Date.now() - startTime,
    };

    setCache(cacheKey, result);
    return res.json(result);
  } catch (error) {
    console.error('[classify] Error:', error.message);
    return res.status(500).json({
      error: 'Classification failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/rightsizing - Get right-sizing recommendations
 */
app.post('/api/rightsizing', async (req, res) => {
  try {
    const { vms, availableProfiles } = req.body;

    if (!vms || !Array.isArray(vms) || vms.length === 0) {
      return res.status(400).json({ error: 'Request must include a non-empty vms array' });
    }

    if (!availableProfiles || !Array.isArray(availableProfiles)) {
      return res.status(400).json({ error: 'Request must include availableProfiles array' });
    }

    // Check cache
    const cacheKey = `rightsizing:${JSON.stringify(vms.map(v => v.vmName).sort())}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const startTime = Date.now();

    // Process in batches of 10 (smaller batches reduce LLM output truncation)
    const batchSize = 10;
    const allRecommendations = [];

    for (let i = 0; i < vms.length; i += batchSize) {
      const batch = vms.slice(i, i + batchSize);
      const prompt = buildRightsizingPrompt(batch, availableProfiles);

      try {
        const rawResponse = await generateText({
          prompt,
          apiKey: API_KEY,
          projectId: PROJECT_ID,
          modelId: MODEL_ID,
          parameters: { max_new_tokens: 8192, temperature: 0.1 },
        });

        const parsed = parseJSONResponse(rawResponse);
        const recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations || [];

        for (const r of recommendations) {
          r.source = 'ai';
        }

        allRecommendations.push(...recommendations);
      } catch (batchError) {
        console.warn(`[rightsizing] Batch ${Math.floor(i / batchSize) + 1} failed: ${batchError.message}. Skipping batch.`);
        // Continue with next batch instead of failing the entire request
      }
    }

    const result = {
      recommendations: allRecommendations,
      model: MODEL_ID,
      processingTimeMs: Date.now() - startTime,
    };

    setCache(cacheKey, result);
    return res.json(result);
  } catch (error) {
    console.error('[rightsizing] Error:', error.message);
    return res.status(500).json({
      error: 'Right-sizing failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/insights - Get migration insights
 */
app.post('/api/insights', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || typeof data.totalVMs !== 'number') {
      return res.status(400).json({ error: 'Request must include valid migration data' });
    }

    // Check cache (use a hash of key metrics)
    const cacheKey = `insights:${data.totalVMs}:${data.totalVCPUs}:${data.totalMemoryGiB}:${data.migrationTarget || 'both'}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const startTime = Date.now();
    const prompt = buildInsightsPrompt(data);

    const rawResponse = await generateText({
      prompt,
      apiKey: API_KEY,
      projectId: PROJECT_ID,
      modelId: MODEL_ID,
      parameters: { max_new_tokens: 2048, temperature: 0.2 },
    });

    const parsed = parseJSONResponse(rawResponse);

    const result = {
      insights: {
        ...parsed,
        source: 'watsonx',
      },
      model: MODEL_ID,
      processingTimeMs: Date.now() - startTime,
    };

    setCache(cacheKey, result);
    return res.json(result);
  } catch (error) {
    console.error('[insights] Error:', error.message);
    return res.status(500).json({
      error: 'Insights generation failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/chat - Conversational chat
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Request must include a message string' });
    }

    const startTime = Date.now();
    const systemPrompt = buildChatSystemPrompt(context);

    // Build messages array for chat API
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      // Limit to last 20 messages to manage context window
      const recentHistory = conversationHistory.slice(-20);
      for (const msg of recentHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    const responseText = await chat({
      messages,
      apiKey: API_KEY,
      projectId: PROJECT_ID,
      modelId: MODEL_ID,
      parameters: { max_tokens: 1024, temperature: 0.3 },
    });

    // Generate suggested follow-ups based on context
    const suggestedFollowUps = generateSuggestedFollowUps(context);

    const result = {
      response: responseText,
      suggestedFollowUps,
      model: MODEL_ID,
      processingTimeMs: Date.now() - startTime,
    };

    // Chat is not cached (conversational)
    return res.json(result);
  } catch (error) {
    console.error('[chat] Error:', error.message);
    return res.status(500).json({
      error: 'Chat failed',
      message: error.message,
    });
  }
});

/**
 * Generate context-aware suggested follow-up questions
 */
function generateSuggestedFollowUps(context) {
  if (!context) {
    return [
      'What is ROKS migration?',
      'Explain VSI vs ROKS migration approaches',
      'What is OpenShift Virtualization?',
    ];
  }

  const page = context.currentPage || '';
  const suggestions = [];

  if (page.includes('dashboard') || page === '/') {
    suggestions.push(
      'What are the biggest migration risks in my environment?',
      'Summarize my environment',
      'Which VMs should I migrate first?',
    );
  } else if (page.includes('roks')) {
    suggestions.push(
      'Which VMs are best suited for ROKS?',
      'What blockers need remediation for ROKS?',
      'How does OpenShift Virtualization handle storage?',
    );
  } else if (page.includes('vsi')) {
    suggestions.push(
      'Which VMs appear over-provisioned?',
      'How can I optimize VSI costs?',
      'What profile family should I use for databases?',
    );
  } else if (page.includes('discovery') || page.includes('wave')) {
    suggestions.push(
      'Is my wave plan balanced?',
      'Which wave has the most risk?',
      'How should I group dependent VMs?',
    );
  } else {
    suggestions.push(
      'What are my migration options?',
      'How can I reduce migration risk?',
      'What should I consider for network planning?',
    );
  }

  return suggestions.slice(0, 3);
}

// ===== START SERVER =====

app.listen(PORT, () => {
  console.log(`AI proxy server listening on port ${PORT}`);
  console.log(`API key configured: ${API_KEY ? 'Yes' : 'No'}`);
  console.log(`Project ID configured: ${PROJECT_ID ? 'Yes' : 'No'}`);
  console.log(`Model: ${MODEL_ID}`);
  console.log(`Client auth: ${PROXY_API_KEY ? 'Enabled' : 'Disabled'}`);
});
