import { chatCompletion, extractReply } from '../lib/api.js';
import {
  type ApiConfig,
  type ProviderId,
  type FidelityLevel,
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
  private fidelitySelect: HTMLSelectElement;
  private slowModeInput: HTMLInputElement;
  private keyRow: HTMLElement;
  private hintEl: HTMLElement;

  constructor() {
    this.panel = document.getElementById('api-settings')!;
    this.statusEl = document.getElementById('api-status')!;
    this.providerSelect = document.getElementById('api-provider') as HTMLSelectElement;
    this.baseUrlInput = document.getElementById('api-base-url') as HTMLInputElement;
    this.modelInput = document.getElementById('api-model') as HTMLInputElement;
    this.keyInput = document.getElementById('api-key-input') as HTMLInputElement;
    this.fidelitySelect = document.getElementById('api-fidelity') as HTMLSelectElement;
    this.slowModeInput = document.getElementById('api-slow-mode') as HTMLInputElement;
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

    const stopProp = (e: KeyboardEvent) => e.stopPropagation();
    this.providerSelect.addEventListener('keydown', stopProp);
    this.baseUrlInput.addEventListener('keydown', stopProp);
    this.modelInput.addEventListener('keydown', stopProp);
    this.keyInput.addEventListener('keydown', stopProp);
    this.fidelitySelect.addEventListener('keydown', stopProp);
    this.slowModeInput.addEventListener('keydown', stopProp);

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
    // Ensure focus is released so keyboard shortcuts work in the game
    if (this.panel.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
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
    this.fidelitySelect.value = cfg.fidelity || 'medium';
    this.slowModeInput.checked = !!cfg.slowMode;
    this.onProviderChange(false);
  }

  private readForm(): ApiConfig {
    return {
      providerId: this.providerSelect.value as ProviderId,
      baseUrl: this.baseUrlInput.value.trim(),
      model: this.modelInput.value.trim(),
      apiKey: this.keyInput.value.trim(),
      fidelity: this.fidelitySelect.value as FidelityLevel,
      slowMode: this.slowModeInput.checked,
    };
  }

  private onProviderChange(resetFields: boolean): void {
    const preset = getPreset(this.providerSelect.value as ProviderId);
    if (resetFields) {
      this.baseUrlInput.value = preset.baseUrl;
      this.modelInput.value = preset.defaultModel;
    }
    
    if (preset.id === 'ollama') {
      this.hintEl.innerHTML = `
        <div style="margin-top: 4px; padding: 6px; border: 1px dashed #3a5a30; background: rgba(0,0,0,0.15); border-radius: 2px; text-align: left; line-height: 1.4;">
          <strong style="color: #fff; display: block; margin-bottom: 2px; font-size: 8px;">Ollama Local Setup (CORS):</strong>
          To connect the game, you must enable CORS in Ollama by running it with the OLLAMA_ORIGINS environment variable.
          <div style="margin-top: 4px;">
            <strong style="color: #d6deb8;">1. Quit Ollama:</strong> Right-click the Ollama icon in your taskbar/tray and select Quit.
          </div>
          <div style="margin-top: 4px;">
            <strong style="color: #d6deb8;">2. Run in terminal:</strong>
          </div>
          <div style="margin-top: 2px; padding: 2px; background: #1a2e1a; border-radius: 1px; font-family: monospace; font-size: 6px; color: #a9b968; word-break: break-all;">
            â€¢ macOS/Linux: OLLAMA_ORIGINS="*" ollama serve<br/>
            â€¢ PowerShell: $env:OLLAMA_ORIGINS="*" ; ollama serve<br/>
            â€¢ Windows CMD: set OLLAMA_ORIGINS=* && ollama serve
          </div>
        </div>
      `;
    } else {
      this.hintEl.textContent = preset.hint;
    }

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
      fidelity: 'medium',
      slowMode: false,
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

