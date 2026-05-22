import type { ChatMessage, ChatResponse } from './api.js';
import {
  type ApiConfig,
  getPreset,
  isConfigured,
  isLocalProvider,
  loadApiConfig,
} from './providers.js';

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? '';

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
}

function normalizeOllama(data: {
  message?: { content?: string };
  error?: string;
}): ChatResponse {
  if (data.error) throw new Error(data.error);
  return {
    choices: [{ message: { role: 'assistant', content: data.message?.content?.trim() ?? '...' } }],
  };
}

function normalizeOpenAI(data: ChatResponse): ChatResponse {
  if (data.error) {
    throw new Error(
      typeof data.error === 'string' ? data.error : data.error.message ?? 'API error'
    );
  }
  return data;
}

async function fetchDirect(cfg: ApiConfig, body: ChatRequest): Promise<ChatResponse> {
  const base = cfg.baseUrl.replace(/\/$/, '');

  if (cfg.providerId === 'ollama' || base.includes('11434')) {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: body.model || cfg.model,
        messages: body.messages,
        stream: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Ollama ${res.status}`);
    return normalizeOllama(data as { message?: { content?: string } });
  }

  const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey.trim()) headers.Authorization = `Bearer ${cfg.apiKey.trim()}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: body.model || cfg.model, messages: body.messages }),
  });
  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok) {
    const err = data.error;
    throw new Error(
      typeof err === 'string' ? err : err?.message ?? `API ${res.status}`
    );
  }
  return normalizeOpenAI(data);
}

async function fetchProxy(cfg: ApiConfig, body: ChatRequest): Promise<ChatResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey.trim()) headers['X-Api-Key'] = cfg.apiKey.trim();

  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: body.model || cfg.model,
      messages: body.messages,
      provider: {
        providerId: cfg.providerId,
        baseUrl: cfg.baseUrl,
        model: body.model || cfg.model,
        apiStyle: cfg.providerId === 'ollama' ? 'ollama' : 'openai',
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok) {
    let errMsg = `Proxy ${res.status}`;
    if (data.error) {
      if (typeof data.error === 'object' && data.error !== null) {
        errMsg = data.error.message ?? JSON.stringify(data.error);
      } else {
        errMsg = String(data.error);
      }
    }
    throw new Error(errMsg);
  }
  return data;
}

export async function routeChat(
  body: ChatRequest,
  cfg: ApiConfig = loadApiConfig()
): Promise<ChatResponse> {
  if (!isConfigured(cfg)) {
    const last = body.messages[body.messages.length - 1]?.content ?? '';
    return {
      mock: true,
      choices: [
        {
          message: {
            role: 'assistant',
            content: `[Offline - press P / ${getPreset(cfg.providerId).label}] "${last.slice(0, 55)}..."`,
          },
        },
      ],
    };
  }

  if (isLocalProvider(cfg)) {
    try {
      return await fetchDirect(cfg, body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Local API failed';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        throw new Error(
          `${msg} - start ${getPreset(cfg.providerId).label} at ${cfg.baseUrl}`
        );
      }
      throw e;
    }
  }

  return fetchProxy(cfg, body);
}
