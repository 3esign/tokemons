import { chatCompletion, extractReply } from '../lib/api.js';
import {
  type ApiConfig,
  type ProviderId,
  PROVIDER_PRESETS,
  clearApiConfig,
  configSummary,
  getPreset,
  isConfigured,
  loadApiConfig,
  saveApiConfig,
} from '../lib/providers.js';

export class ApiSettingsPanel {
  private panel: HTMLElement;
  private statusEl: HTMLElement;
  private providerSelect: HTMLSelectElement;
  private baseUrlInput: HTMLInputElement;
  private modelInput: HTMLInputElement;
  private keyInput: HTMLInputElement;
  private keyRow: HTMLElement;
  private hintEl: HTMLElement;

  constructor() {
    this.panel = document.getElementById('api-settings')!;
    this.statusEl = document.getElementById('api-status')!;
    this.providerSelect = document.getElementById('api-provider') as HTMLSelectElement;
    this.baseUrlInput = document.getElementById('api-base-url') as HTMLInputElement;
    this.modelInput = document.getElementById('api-model') as HTMLInputElement;
    this.keyInput = document.getElementById('api-key-input') as HTMLInputElement;
    this.keyRow = document.getElementById('api-key-row')!;
    this.hintEl = document.getElementById('api-provider-hint')!;

    this.providerSelect.replaceChildren();
    for (const p of PROVIDER_PRESETS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      this.providerSelect.appendChild(opt);
    }

    document.getElementById('api-settings-open')?.addEventListener('click', () => this.show());
    document.getElementById('api-settings-close')?.addEventListener('click', () => this.hide());
    document.getElementById('api-key-save')?.addEventListener('click', () => this.save());
    document.getElementById('api-key-clear')?.addEventListener('click', () => this.clear());
    document.getElementById('api-key-test')?.addEventListener('click', () => void this.test());
    this.providerSelect.addEventListener('change', () => this.onProviderChange(true));
    this.panel.addEventListener('pointerdown', (e) => {
      if (e.target === this.panel) this.hide();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.panel.classList.contains('open')) {
        this.hide();
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT') return;
        this.toggle();
      }
    });

    this.loadIntoForm(loadApiConfig());
    this.refreshStatus();
  }

  show(): void {
    this.panel.classList.add('open');
    this.loadIntoForm(loadApiConfig());
    this.providerSelect.focus();
  }

  hide(): void {
    this.panel.classList.remove('open');
    this.keyInput.value = '';
  }

  toggle(): void {
    if (this.panel.classList.contains('open')) this.hide();
    else this.show();
  }

  private loadIntoForm(cfg: ApiConfig): void {
    this.providerSelect.value = cfg.providerId;
    this.baseUrlInput.value = cfg.baseUrl;
    this.modelInput.value = cfg.model;
    this.keyInput.value = cfg.apiKey;
    this.onProviderChange(false);
  }

  private readForm(): ApiConfig {
    return {
      providerId: this.providerSelect.value as ProviderId,
      baseUrl: this.baseUrlInput.value.trim(),
      model: this.modelInput.value.trim(),
      apiKey: this.keyInput.value.trim(),
    };
  }

  private onProviderChange(resetFields: boolean): void {
    const preset = getPreset(this.providerSelect.value as ProviderId);
    if (resetFields) {
      this.baseUrlInput.value = preset.baseUrl;
      this.modelInput.value = preset.defaultModel;
    }
    this.hintEl.textContent = preset.hint;
    this.keyRow.style.display = preset.needsKey ? 'block' : 'none';
    this.keyInput.placeholder = preset.needsKey ? 'API key (optional for some local)' : 'Not required';
  }

  private refreshStatus(): void {
    const cfg = loadApiConfig();
    const ok = isConfigured(cfg);
    this.statusEl.textContent = ok ? `Ready: ${configSummary(cfg)}` : `Not ready - ${getPreset(cfg.providerId).label}`;
    this.statusEl.classList.toggle('connected', ok);
  }

  private save(): void {
    const cfg = this.readForm();
    if (!cfg.baseUrl || !cfg.model) {
      this.statusEl.textContent = 'Base URL and model required';
      return;
    }
    saveApiConfig(cfg);
    this.refreshStatus();
    this.statusEl.textContent = `Saved / ${configSummary(cfg)}`;
    this.statusEl.classList.add('connected');
  }

  private clear(): void {
    clearApiConfig();
    const p = getPreset('ollama');
    this.loadIntoForm({
      providerId: 'ollama',
      baseUrl: p.baseUrl,
      model: p.defaultModel,
      apiKey: '',
    });
    this.refreshStatus();
  }

  private async test(): Promise<void> {
    const cfg = this.readForm();
    saveApiConfig(cfg);
    this.statusEl.textContent = 'Testing...';
    try {
      const res = await chatCompletion({
        messages: [{ role: 'user', content: 'Reply with exactly: link ok' }],
      });
      if (res.mock) {
        this.statusEl.textContent = 'Mock reply - check key / provider';
        this.statusEl.classList.remove('connected');
        return;
      }
      this.statusEl.textContent = `OK: ${extractReply(res).slice(0, 48)}`;
      this.statusEl.classList.add('connected');
    } catch (e) {
      this.statusEl.textContent = e instanceof Error ? e.message : 'Test failed';
      this.statusEl.classList.remove('connected');
    }
  }
}
