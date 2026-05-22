import type { Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';

interface ProviderPayload {
  providerId: string;
  baseUrl: string;
  model: string;
  apiStyle: 'openai' | 'ollama';
}

function applyCors(res: { setHeader: (name: string, value: string) => void }): void {
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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function forwardChat(
  provider: ProviderPayload,
  apiKey: string | undefined,
  messages: unknown[],
  model: string
): Promise<{ status: number; text: string }> {
  const base = provider.baseUrl.replace(/\/$/, '');

  if (provider.apiStyle === 'ollama' || provider.providerId === 'ollama') {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });
    const text = await res.text();
    if (!res.ok) return { status: res.status, text };
    const data = JSON.parse(text) as { message?: { content?: string } };
    return {
      status: 200,
      text: JSON.stringify({
        choices: [{ message: { role: 'assistant', content: data.message?.content ?? '...' } }],
      }),
    };
  }

  const url = base.endsWith('/v1') ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'http://localhost:5173';
    headers['X-Title'] = 'Tokemons';
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages }),
  });
  return { status: res.status, text: await res.text() };
}

export function chatApiPlugin(envApiKey: string | undefined): Plugin {
  return {
    name: 'tokemons-chat-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/chat')) return next();
        applyCors(res);

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Method not allowed' }));
        }

        let payload: {
          messages?: unknown[];
          model?: string;
          provider?: ProviderPayload;
        };
        try {
          payload = JSON.parse(await readBody(req));
        } catch {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }

        res.setHeader('Content-Type', 'application/json');

        const clientKey = req.headers['x-api-key'] ?? req.headers['x-openrouter-key'];
        const headerKey = Array.isArray(clientKey) ? clientKey[0] : clientKey;

        const provider = payload.provider ?? {
          providerId: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          model: payload.model ?? 'openrouter/auto',
          apiStyle: 'openai' as const,
        };
        const apiKey = resolveApiKey(provider.providerId, headerKey, envApiKey);

        const needsKey =
          provider.providerId !== 'ollama' && provider.providerId !== 'lmstudio';
        if (needsKey && !apiKey) {
          const last =
            (payload.messages as { content?: string }[])?.at(-1)?.content ?? '';
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: `[Offline - press P to set ${provider.providerId} API] "${String(last).slice(0, 55)}..."`,
                  },
                },
              ],
              mock: true,
            })
          );
        }

        try {
          const result = await forwardChat(
            provider,
            apiKey,
            payload.messages ?? [],
            payload.model ?? provider.model
          );
          res.statusCode = result.status;
          res.end(result.text);
        } catch (e) {
          res.statusCode = 502;
          res.end(
            JSON.stringify({ error: e instanceof Error ? e.message : 'Upstream error' })
          );
        }
      });
    },
  };
}
