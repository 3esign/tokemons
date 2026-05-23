import Phaser from 'phaser';
import { GAME_CONFIG } from './config.js';
import { clearSave } from './game/state.js';
import { ApiSettingsPanel } from './ui/settings.js';
import { ApiLogPanel } from './ui/api-log.js';
import { ReportDownload } from './ui/report.js';

new ApiSettingsPanel();
new ApiLogPanel();
new ReportDownload();
const game = new Phaser.Game(GAME_CONFIG);

const fit = () => game.scale.refresh();
window.addEventListener('resize', fit);
requestAnimationFrame(fit);

document.getElementById('reset-game')?.addEventListener('click', () => {
  clearSave();
  document.getElementById('chat-panel')?.classList.remove('open');
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
