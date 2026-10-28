import './engine-host.js';
import { DEFAULTS, normalizeSettings } from './settings.js';
import { shortcutPatch } from './shortcuts.js';

let pending = Promise.resolve();
export function handleCommand(command) {
  // Serialize key presses so quick repeats do not read the same stale settings.
  pending = pending.catch(() => {}).then(async () => {
    const settings = normalizeSettings(await chrome.storage.local.get(DEFAULTS));
    const patch = shortcutPatch(settings, command);
    if (patch) await chrome.storage.local.set(patch);
  }).catch(error => console.error('Stockfish Lens: erro no atalho', error));
  return pending;
}
chrome.commands.onCommand.addListener(handleCommand);
