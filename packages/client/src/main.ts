import Phaser from 'phaser';
import { GAME_CONFIG } from './config.js';
import { clearSave } from './game/state.js';
import { ApiSettingsPanel } from './ui/settings.js';
import { ApiLogPanel } from './ui/api-log.js';
import { ReportDownload } from './ui/report.js';

// Individual scale configurations
const scales: Record<string, { var: string, key: string }> = {
  'stats-hud': { var: '--stats-hud-scale', key: 'ui-scale-stats' },
  'chat-panel': { var: '--chat-panel-scale', key: 'ui-scale-chat' },
  'api-log-panel': { var: '--api-log-scale', key: 'ui-scale-log' }
};

// Load stored font scales on startup
Object.values(scales).forEach(cfg => {
  const stored = localStorage.getItem(cfg.key);
  if (stored) {
    const parsed = parseFloat(stored);
    if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 3.0) {
      document.documentElement.style.setProperty(cfg.var, parsed.toFixed(2));
    }
  }
});

// Global Ctrl + Mouse Wheel listener for individual panel zooming
window.addEventListener('wheel', (e) => {
  if (e.ctrlKey) {
    const target = e.target as HTMLElement | null;
    const panel = target?.closest('#api-log-panel, #stats-hud, #chat-panel');
    
    if (panel) {
      e.preventDefault();
      const cfg = scales[panel.id];
      if (!cfg) return;

      const currentScaleStr = document.documentElement.style.getPropertyValue(cfg.var) || '1.0'; 
      let scale = parseFloat(currentScaleStr);
      if (isNaN(scale)) scale = 1.0;

      if (e.deltaY < 0) {
        scale = Math.min(3.0, scale + 0.05);
      } else {
        scale = Math.max(0.5, scale - 0.05);
      }

      document.documentElement.style.setProperty(cfg.var, scale.toFixed(2));
      localStorage.setItem(cfg.key, scale.toFixed(2));
    }
  }
}, { passive: false });

new ApiSettingsPanel();
new ApiLogPanel();
new ReportDownload();
const game = new Phaser.Game(GAME_CONFIG);

const fit = () => game.scale.refresh();
window.addEventListener('resize', fit);
requestAnimationFrame(fit);

document.getElementById('reset-game')?.addEventListener('click', () => {
  clearSave();

  // Clean up UI panel states on reset
  const panels = ['chat-panel', 'api-log-panel', 'stats-hud', 'system-menu-container'];
  panels.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden-scene');
      el.classList.add('minimized');
    }
  });

  const chatMinimize = document.getElementById('chat-minimize');
  if (chatMinimize) chatMinimize.textContent = 'OPEN';
  const apiLogMinimize = document.getElementById('api-log-minimize');
  if (apiLogMinimize) apiLogMinimize.textContent = 'OPEN';
  const statsHudMinimize = document.getElementById('stats-hud-minimize');
  if (statsHudMinimize) statsHudMinimize.textContent = 'OPEN';

  document.getElementById('build-hint')?.classList.add('hidden');
  game.scene.stop('Play');
  game.scene.stop('Boot');
  game.scene.stop('Create');
  game.scene.start('Create');
});

// Interactive SYSTEM collapsible menu logic
const menuToggle = document.getElementById('system-menu-toggle');
const menuPanel = document.getElementById('system-menu-panel');

if (menuToggle && menuPanel) {
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    menuPanel.classList.toggle('hidden');
  });

  // Collapse when clicking outside the panel
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!menuPanel.contains(target) && target !== menuToggle) {
      menuPanel.classList.add('hidden');
    }
  });

  // Collapse automatically on option click
  menuPanel.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      menuPanel.classList.add('hidden');
    });
  });

  // Collapse on ESC key press
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      menuPanel.classList.add('hidden');
    }
  });
}

/** Safety: never stay stuck on boot */
window.setTimeout(() => {
  if (game.scene.isActive('Boot')) {
    console.warn('Boot timeout - forcing Create');
    game.scene.start('Create');
  }
}, 4000);