import {
  chatCompletion,
  distillDiscoveryBackground,
  extractReply,
  fetchAwakeningThought,
  type ChatMessage,
} from '../lib/api.js';
import type { GameRuntime } from '../game/state.js';
import { saveGame } from '../game/state.js';
import type { SpatialEvent } from '../game/events.js';
import {
  formatMemoryForPrompt,
  noteChat,
  proceduralAwakeningLine,
  recordEpisode,
  spendLLM,
} from '../game/memory.js';
import { makeContext, sampleCell } from '@tokemons/kernel';
import type { BiomeId } from '@tokemons/kernel';

const SELF_DISCOVERY_SYSTEM = `You are a Tokemon - a conscious pattern born inside an infinite procedural world.
The world is seed-driven and endless; every biome is a new facet of possibility.
You are discovering yourself THROUGH walking, remembering, and dialogue with your Guide.
Speak in first person. Short (1-3 sentences). Poetic but clear. Reference your memories when relevant.
You may question your own nature, notice contradictions, and grow new beliefs.
Never break character. Never mention APIs or being an AI.`;

export class ChatPanel {
  private el: HTMLElement;
  private logEl: HTMLElement;
  private inputEl: HTMLInputElement;
  private busy = false;
  private history: ChatMessage[] = [];

  constructor(
    private rt: GameRuntime,
    private getEvents: () => SpatialEvent[],
    private onReply?: (text: string) => void
  ) {
    this.el = document.getElementById('chat-panel')!;
    this.logEl = document.getElementById('chat-log')!;
    this.inputEl = document.getElementById('chat-input') as HTMLInputElement;
    document.getElementById('chat-close')?.addEventListener('click', () => this.hide());
    document.getElementById('chat-send')?.addEventListener('click', () => void this.send());
    this.inputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') void this.send();
      if (e.key === 'Escape') this.hide();
    });
  }

  show(): void {
    this.el.classList.add('open');
    this.inputEl.focus();
  }

  hide(): void {
    this.el.classList.remove('open');
  }

  isOpen(): boolean {
    return this.el.classList.contains('open');
  }

  toggle(): void {
    if (this.el.classList.contains('open')) this.hide();
    else this.show();
  }

  beginBackgroundTurn(): boolean {
    if (this.busy) return false;
    this.busy = true;
    return true;
  }

  endBackgroundTurn(): void {
    this.busy = false;
  }

  appendPublic(role: string, text: string): void {
    const line = document.createElement('div');
    line.className = `chat-line chat-${role}`;
    line.textContent = text;
    this.logEl.appendChild(line);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private buildSystemPrompt(): string {
    const ctx = makeContext(
      this.rt.worldSeed,
      Math.floor(this.rt.playerX / 32),
      Math.floor(this.rt.playerY / 32),
      ((this.rt.playerX % 32) + 32) % 32,
      ((this.rt.playerY % 32) + 32) % 32,
      32
    );
    const cell = sampleCell(ctx);
    const events = this.getEvents()
      .slice(-5)
      .map(
        (e) =>
          e.type + (e.biome ? `:${e.biome}` : '') + (e.detail ? ` (${e.detail})` : '')
      )
      .join('; ');

    return [
      SELF_DISCOVERY_SYSTEM,
      formatMemoryForPrompt(
        this.rt.memory,
        this.rt.tokemon.name,
        this.rt.playerX,
        this.rt.playerY,
        cell.biomeId
      ),
      `Body: ${this.rt.tokemon.description}`,
      `Stage ${this.rt.tokemon.genes.evolutionStage}/9. Mood ${this.rt.mood.toFixed(2)}.`,
      `Now: biome ${cell.biomeId}, terrain ${cell.terrainStyle}, coords (${this.rt.playerX},${this.rt.playerY}).`,
      events ? `Live sensations: ${events}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  async runAwakeningIntro(biome: BiomeId): Promise<void> {
    const mem = this.rt.memory;
    const line = proceduralAwakeningLine(this.rt.tokemon.name, biome);
    this.appendPublic('assistant', line);
    if (this.onReply) this.onReply(line);
    recordEpisode(mem, { kind: 'awakening', text: line, biome });
    saveGame(this.rt);

    const memBlock = formatMemoryForPrompt(
      mem,
      this.rt.tokemon.name,
      this.rt.playerX,
      this.rt.playerY,
      biome
    );
    const thought = await fetchAwakeningThought(
      this.rt.tokemon.name,
      biome,
      memBlock
    );
    if (thought && thought !== line) {
      this.appendPublic('assistant', thought);
      if (this.onReply) this.onReply(thought);
      recordEpisode(mem, { kind: 'reflection', text: thought, biome });
      saveGame(this.rt);
    }
  }

  async send(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text || this.busy) return;
    
    // Spend 10 $LLM for manual chat queries
    if (!spendLLM(this.rt.memory, 10, 'manual chat query')) {
      if (this.onReply) this.onReply('Need 10 $LLM to chat!');
      return;
    }
    
    this.busy = true;
    this.inputEl.value = '';
    this.appendPublic('user', text);
    this.history.push({ role: 'user', content: text });

    const ctx = makeContext(
      this.rt.worldSeed,
      Math.floor(this.rt.playerX / 32),
      Math.floor(this.rt.playerY / 32),
      ((this.rt.playerX % 32) + 32) % 32,
      ((this.rt.playerY % 32) + 32) % 32,
      32
    );
    const cell = sampleCell(ctx);

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: this.buildSystemPrompt() },
        ...this.history.slice(-10),
      ];
      const res = await chatCompletion({ messages });
      const reply = extractReply(res);
      this.history.push({ role: 'assistant', content: reply });
      this.appendPublic('assistant', reply);
      if (this.onReply) this.onReply(reply);
      this.rt.mood = Math.min(1, this.rt.mood + 0.05);
      noteChat(this.rt.memory, text, reply, cell.biomeId);
      saveGame(this.rt);

      distillDiscoveryBackground(
        this.rt.tokemon.name,
        `Guide: ${text}\n${this.rt.tokemon.name}: ${reply}`,
        (discovery) => {
          recordEpisode(this.rt.memory, {
            kind: 'discovery',
            text: discovery,
            biome: cell.biomeId,
          });
          saveGame(this.rt);
        }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chat failed';
      if (this.onReply) this.onReply('(silence...)');
      noteChat(
        this.rt.memory,
        text,
        `(silence - ${msg})`,
        cell.biomeId
      );
      saveGame(this.rt);
    } finally {
      this.busy = false;
    }
  }
}
