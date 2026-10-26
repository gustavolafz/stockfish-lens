import { arrowPreference } from './settings.js';

export function shortcutPatch(settings, command) {
  const active = settings.enabled && settings.showArrows && settings.mode !== 'panel';
  if (command === 'toggle-all-arrows') {
    if (active && settings.arrowBest && settings.arrowSecond && settings.arrowThird && settings.multipv >= 3) {
      return { showArrows: false };
    }
    return { enabled: true, showArrows: true, arrowBest: true, arrowSecond: true, arrowThird: true,
      multipv: Math.max(3, settings.multipv), mode: settings.mode === 'panel' ? 'both' : settings.mode };
  }
  const key = { 'toggle-arrow-1': 'arrowBest', 'toggle-arrow-2': 'arrowSecond', 'toggle-arrow-3': 'arrowThird' }[command];
  if (!key) return null;
  if (active) return arrowPreference(settings, key, !settings[key]);
  // When arrows are hidden/paused, an individual shortcut shows the requested
  // rank instead of silently toggling a setting behind the master visibility.
  return { ...arrowPreference(settings, key, true), enabled: true,
    arrowBest: key === 'arrowBest', arrowSecond: key === 'arrowSecond', arrowThird: key === 'arrowThird' };
}
