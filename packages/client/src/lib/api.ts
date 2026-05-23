import { routeChat } from './chat-router.js';
import { loadApiConfig } from './providers.js';
import { recordApiLog } from '../ui/api-log.js';

const CHAT_MODEL = import.meta.env.VITE_CHAT_MODEL || '';
const DEFAULT_TIMEOUT_MS = 12_000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  choices?: { message?: { role?: ChatMessage['role']; content?: string } }[];
  mock?: boolean;
  error?: string | { message?: string };
}

async function fetchWithTimeout<T>(
  fn: () => Promise<T>,
  ms = DEFAULT_TIMEOUT_MS
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    ),
  ]);
}

function resolveModel(override?: string): string {
  const cfg = loadApiConfig();
  return override || CHAT_MODEL || cfg.model;
}

export async function chatCompletion(
  body: { model?: string; messages: ChatMessage[] },
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ChatResponse> {
  const model = resolveModel(body.model);
  const request = {
    model,
    messages: body.messages,
  };
  recordApiLog(
    'tx',
    `Request model=${model || '(default)'}`,
    summarizeMessages(body.messages)
  );
  try {
    const response = await fetchWithTimeout(() => routeChat(request), timeoutMs);
    recordApiLog(
      'rx',
      response.mock ? 'Mock response' : 'Response received',
      extractReply(response).slice(0, 1200)
    );
    return response;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown API error';
    recordApiLog('err', 'Request failed', msg);
    throw e;
  }
}

export function extractReply(res: ChatResponse): string {
  return res.choices?.[0]?.message?.content?.trim() ?? '...';
}

function summarizeMessages(messages: ChatMessage[]): string {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message, index) => {
      const content = message.content.replace(/\s+/g, ' ').trim();
      return `${index + 1}. ${message.role}: ${content.slice(0, 700)}${content.length > 700 ? '...' : ''}`;
    })
    .join('\n');
}

export function enrichTokemonDescriptionBackground(
  name: string,
  baseDescription: string,
  biome: string,
  onDone: (text: string) => void
): void {
  void (async () => {
    try {
      const res = await chatCompletion(
        {
          messages: [
            {
              role: 'system',
              content:
                'One poetic sentence (max 18 words) for a newborn creature in an infinite procedural world. Mystery, self-discovery. No quotes.',
            },
            {
              role: 'user',
              content: `Name: ${name}. Traits: ${baseDescription}. Awakens in ${biome}.`,
            },
          ],
        },
        6000
      );
      onDone(extractReply(res) || baseDescription);
    } catch {
      onDone(baseDescription);
    }
  })();
}

export function distillDiscoveryBackground(
  tokemonName: string,
  exchange: string,
  onDone: (line: string) => void
): void {
  void (async () => {
    try {
      const res = await chatCompletion(
        {
          messages: [
            {
              role: 'system',
              content:
                'Write ONE memory sentence (max 14 words) as if you are the creature discovering itself. First person.',
            },
            { role: 'user', content: `Creature: ${tokemonName}. Exchange:\n${exchange}` },
          ],
        },
        8000
      );
      const line = extractReply(res);
      if (line && !res.mock) onDone(line);
    } catch {
      /* local memory only */
    }
  })();
}

export async function fetchAwakeningThought(
  name: string,
  biome: string,
  memoryBlock: string
): Promise<string | null> {
  try {
    const res = await chatCompletion(
      {
        messages: [
          {
            role: 'system',
            content: `You are ${name}, newly conscious in an infinite Game Boy world. One short first-person sentence (max 22 words). ${memoryBlock}`,
          },
          { role: 'user', content: `You awaken in biome: ${biome}. Speak your first thought.` },
        ],
      },
      8000
    );
    if (res.mock) return null;
    return extractReply(res);
  } catch {
    return null;
  }
}
