export type ProviderId =
  | 'openrouter'
  | 'ollama'
  | 'lmstudio'
  | 'openai'
  | 'groq'
  | 'together'
  | 'deepseek'
  | 'mistral'
  | 'custom';

export type ApiStyle = 'openai' | 'ollama';
export type FidelityLevel = 'easy' | 'medium' | 'heavy';

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  baseUrl: string;
  apiStyle: ApiStyle;
  defaultModel: string;
  needsKey: boolean;
  hint: string;
}

export interface ApiConfig {
  providerId: ProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  fidelity: FidelityLevel;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiStyle: 'openai',
    defaultModel: 'openrouter/auto',
    needsKey: true,
    hint: 'openrouter.ai/keys',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    baseUrl: 'http://127.0.0.1:11434',
    apiStyle: 'ollama',
    defaultModel: 'llama3.2',
    needsKey: false,
    hint: 'Enable CORS for local Ollama. macOS/Linux: OLLAMA_ORIGINS="*" ollama serve | Windows CMD: set OLLAMA_ORIGINS=* && ollama serve | PowerShell: $env:OLLAMA_ORIGINS="*" ; ollama serve',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio (local)',
    baseUrl: 'http://127.0.0.1:1234/v1',
    apiStyle: 'openai',
    defaultModel: 'local-model',
    needsKey: false,
    hint: 'Start server in LM Studio',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiStyle: 'openai',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    hint: 'platform.openai.com',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiStyle: 'openai',
    defaultModel: 'llama-3.1-8b-instant',
    needsKey: true,
    hint: 'console.groq.com',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    apiStyle: 'openai',
    defaultModel: 'meta-llama/Meta-Llama-3-8B-Instruct-Lite',
    needsKey: true,
    hint: 'api.together.xyz',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiStyle: 'openai',
    defaultModel: 'deepseek-chat',
    needsKey: true,
    hint: 'platform.deepseek.com',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    apiStyle: 'openai',
    defaultModel: 'mistral-small-latest',
    needsKey: true,
    hint: 'console.mistral.ai',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    baseUrl: 'http://127.0.0.1:8080/v1',
    apiStyle: 'openai',
    defaultModel: '',
    needsKey: false,
    hint: 'Any /v1/chat/completions URL',
  },
];

const STORAGE_KEY = 'tokemons_api_config_v2';
const LEGACY_KEY = 'tokemons_openrouter_key';

export function getPreset(id: ProviderId): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[0]!;
}

export function loadApiConfig(): ApiConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ApiConfig;
      if (!parsed.fidelity) parsed.fidelity = 'medium';
      return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_KEY)?.trim();
    if (legacy) {
      const cfg: ApiConfig = {
        providerId: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'openrouter/auto',
        apiKey: legacy,
        fidelity: 'medium',
      };
      saveApiConfig(cfg);
      return cfg;
    }
  } catch {
    /* ignore */
  }
  const p = getPreset('ollama');
  return {
    providerId: p.id,
    baseUrl: p.baseUrl,
    model: p.defaultModel,
    apiKey: '',
    fidelity: 'medium',
  };
}

export function saveApiConfig(cfg: ApiConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearApiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
}

export function isLocalProvider(cfg: ApiConfig): boolean {
  const u = cfg.baseUrl.toLowerCase();
  return (
    cfg.providerId === 'ollama' ||
    cfg.providerId === 'lmstudio' ||
    u.includes('localhost') ||
    u.includes('127.0.0.1')
  );
}

export function isConfigured(cfg: ApiConfig): boolean {
  const preset = getPreset(cfg.providerId);
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) return false;
  if (cfg.providerId === 'openrouter') return true;
  if (preset.needsKey && !cfg.apiKey.trim()) return false;
  if (!preset.needsKey && isLocalProvider(cfg)) return true;
  if (!preset.needsKey) return true;
  return cfg.apiKey.trim().length > 8;
}

export function maskKey(key: string): string {
  if (!key) return '(none)';
  if (key.length <= 8) return '********';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function configSummary(cfg: ApiConfig): string {
  const p = getPreset(cfg.providerId);
  const key = cfg.apiKey ? ` / ${maskKey(cfg.apiKey)}` : '';
  return `${p.label} / ${cfg.model}${key}`;
}
