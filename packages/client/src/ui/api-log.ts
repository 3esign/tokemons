export type ApiLogKind = 'tx' | 'rx' | 'err';

export interface ApiLogEntry {
  id: number;
  t: number;
  kind: ApiLogKind;
  title: string;
  detail: string;
}

const MAX_LOG_ENTRIES = 80;
const entries: ApiLogEntry[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

export function recordApiLog(kind: ApiLogKind, title: string, detail: string): void {
  entries.push({
    id: nextId++,
    t: Date.now(),
    kind,
    title,
    detail,
  });
  if (entries.length > MAX_LOG_ENTRIES) entries.shift();
  for (const listener of listeners) listener();
}

export function getApiLogEntries(): ApiLogEntry[] {
  return [...entries];
}

export class ApiLogPanel {
  private panel: HTMLElement;
  private content: HTMLElement;
  private toggleButton: HTMLButtonElement;
  private clearButton: HTMLButtonElement;
  private downloadButton: HTMLButtonElement;

  constructor() {
    this.panel = document.getElementById('api-log-panel')!;
    this.content = document.getElementById('api-log-content')!;
    this.toggleButton = document.getElementById('api-log-minimize') as HTMLButtonElement;
    this.clearButton = document.getElementById('api-log-clear') as HTMLButtonElement;
    this.downloadButton = document.getElementById('api-log-download') as HTMLButtonElement;

    document.getElementById('api-log-header')?.addEventListener('click', (e) => {
      if (e.target instanceof HTMLButtonElement) return;
      this.toggle();
    });
    this.toggleButton.addEventListener('click', () => this.toggle());
    this.clearButton.addEventListener('click', () => this.clear());
    this.downloadButton.addEventListener('click', () => this.download());

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'g' && e.key !== 'G') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      this.toggle();
    });

    listeners.add(() => this.render());
    this.render();
  }

  private toggle(): void {
    const minimized = this.panel.classList.toggle('minimized');
    this.toggleButton.textContent = minimized ? 'OPEN' : 'HIDE';
    if (!minimized) this.content.scrollTop = this.content.scrollHeight;
  }

  private clear(): void {
    entries.length = 0;
    this.render();
  }

  private render(): void {
    this.content.replaceChildren();
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'api-log-empty';
      empty.textContent = 'No API calls recorded yet.';
      this.content.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const line = document.createElement('div');
      line.className = `api-log-entry api-log-${entry.kind}`;
      const time = new Date(entry.t).toLocaleTimeString();
      line.textContent = `[${time}] ${entry.title}\n${entry.detail}`;
      this.content.appendChild(line);
    }
    this.content.scrollTop = this.content.scrollHeight;
  }

  private download(): void {
    const text = formatApiLogText();
    downloadTextFile('tokemons-api-log.txt', text);
  }
}

export function formatApiLogText(): string {
  if (entries.length === 0) return 'Tokemons API Call Log\n\nNo API calls recorded yet.\n';
  return [
    'Tokemons API Call Log',
    `Generated: ${new Date().toISOString()}`,
    '',
    ...entries.map((entry) => {
      return [
        `[${new Date(entry.t).toISOString()}] ${entry.kind.toUpperCase()} ${entry.title}`,
        entry.detail,
      ].join('\n');
    }),
    '',
  ].join('\n\n');
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
