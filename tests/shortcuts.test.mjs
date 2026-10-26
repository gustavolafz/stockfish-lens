import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings } from '../src/settings.js';
import { shortcutPatch } from '../src/shortcuts.js';

const apply = (settings, command) => normalizeSettings({ ...settings, ...shortcutPatch(settings, command) });

test('the all-arrows shortcut shows all three, hides them, and preserves search preferences', () => {
  const original = { ...DEFAULTS, ms: 3000, multipv: 5 };
  const shown = apply(original, 'toggle-all-arrows');
  assert(shown.arrowBest && shown.arrowSecond && shown.arrowThird && shown.showArrows);
  assert.equal(shown.ms, 3000); assert.equal(shown.multipv, 5);
  const hidden = apply(shown, 'toggle-all-arrows');
  assert.equal(hidden.showArrows, false);
  assert.equal(hidden.enabled, true);
  assert.deepEqual(apply(hidden, 'toggle-all-arrows'), shown);
});

test('individual shortcuts toggle each rank without changing the other visible ranks', () => {
  let state = { ...DEFAULTS, multipv: 1 };
  state = apply(state, 'toggle-arrow-2');
  assert.equal(state.multipv, 3); assert.equal(state.arrowSecond, true); assert.equal(state.arrowBest, true);
  state = apply(state, 'toggle-arrow-3');
  state = apply(state, 'toggle-arrow-1');
  assert.equal(state.arrowBest, false); assert.equal(state.arrowSecond, true); assert.equal(state.arrowThird, true);
  state = apply(state, 'toggle-arrow-2');
  assert.equal(state.arrowSecond, false); assert.equal(state.arrowThird, true);
});

test('an individual shortcut recovers a hidden or paused panel and shows the requested arrow', () => {
  const hidden = { ...DEFAULTS, enabled: false, showArrows: false, mode: 'panel', multipv: 1,
    arrowBest: true, arrowSecond: true, arrowThird: true };
  const shown = apply(hidden, 'toggle-arrow-3');
  assert.equal(shown.mode, 'both'); assert.equal(shown.enabled, true); assert.equal(shown.showArrows, true);
  assert.equal(shown.multipv, 3); assert.equal(shown.arrowBest, false); assert.equal(shown.arrowSecond, false);
  assert.equal(shown.arrowThird, true);
});

test('unrecognized commands leave the settings untouched', () => {
  assert.equal(shortcutPatch(DEFAULTS, 'unrecognized'), null);
  assert.deepEqual(apply(DEFAULTS, 'unrecognized'), DEFAULTS);
});
