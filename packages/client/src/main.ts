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

/** Safety: never stay stuck on boot */
window.setTimeout(() => {
  if (game.scene.isActive('Boot')) {
    console.warn('Boot timeout - forcing Create');
    game.scene.start('Create');
  }
}, 4000);
