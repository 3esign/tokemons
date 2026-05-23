import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ProviderPayload {
  providerId: string;
  baseUrl: string;
  model: string;
  apiStyle: 'openai' | 'ollama';
}

function applyCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, X-OpenRouter-Key');
}

function resolveApiKey(
  providerId: string,
  headerKey: string | undefined,
  envOpenRouterKey: string | undefined
): string | undefined {
  const clientKey = headerKey?.trim();
  if (clientKey) return clientKey;
  return providerId === 'openrouter' ? envOpenRouterKey?.trim() || undefined : undefined;
}

function parseBody(body: unknown): {
  messages?: unknown[];
  model?: string;
  provider?: ProviderPayload;
} {
  if (typeof body === 'string') return JSON.parse(body) as ReturnType<typeof parseBody>;
  return (body ?? {}) as ReturnType<typeof parseBody>;
}

async function forwardChat(
  provider: ProviderPayload,
  apiKey: string | undefined,
  messages: unknown[],
  model: string
) {
  const base = provider.baseUrl.replace(/\/$/, '');

  if (provider.apiStyle === 'ollama') {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    const data = await res.json();
    if (!res.ok) return { status: res.status, body: data };
    return {
      status: 200,
      body: {
        choices: [{ message: { role: 'assistant', content: data.message?.content ?? '...' } }],
      },
    };
  }

  const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/3esign/simplato';
    headers['X-Title'] = 'Tokemons';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens: 150 }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body: ReturnType<typeof parseBody>;
  try {
    body = parseBody(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const provider = body.provider ?? {
    providerId: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: body.model ?? 'openrouter/auto',
    apiStyle: 'openai' as const,
  };

  const clientKey = req.headers['x-api-key'] ?? req.headers['x-openrouter-key'];
  const headerKey = Array.isArray(clientKey) ? clientKey[0] : clientKey;
  const apiKey = resolveApiKey(provider.providerId, headerKey, process.env.OPENROUTER_API_KEY);

  const isLocal =
    provider.providerId === 'ollama' ||
    provider.providerId === 'lmstudio' ||
    provider.baseUrl.includes('localhost') ||
    provider.baseUrl.includes('127.0.0.1');

  if (isLocal) {
    return res.status(400).json({
      error: 'Local providers (Ollama/LM Studio) must be called from your browser, not Vercel.',
      hint: 'Play locally with npm run dev',
    });
  }

  const needsKey = !['ollama', 'lmstudio'].includes(provider.providerId);
  if (needsKey && !apiKey) {
    const last = (body.messages as { content?: string }[])?.at(-1)?.content ?? '';
    return res.status(200).json({
      mock: true,
      choices: [
        {
          message: {
            role: 'assistant',
            content: `[Offline - set API in game (P)] "${String(last).slice(0, 55)}..."`,
          },
        },
      ],
    });
  }

  try {
    const result = await forwardChat(
      provider,
      apiKey,
      body.messages ?? [],
      body.model ?? provider.model
    );
    return res.status(result.status).json(result.body);
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'Upstream error' });
  }
}
