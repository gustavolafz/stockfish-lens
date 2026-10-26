export const FONT_SCALES = [80, 90, 100, 110, 120, 130, 140, 150];
export const ARROW_SCALES = [50, 75, 100, 125, 150, 175, 200];
export const DEFAULTS = { enabled: true, mode: 'both', ms: 1200, multipv: 3, fontScale: 100, arrowScale: 100,
  showArrows: true, arrowBest: true, arrowSecond: false, arrowThird: false,
  hideUnfavorableArrows: true, showPieceLetters: true };
export function normalizeSettings(value = {}) {
  return { enabled: value.enabled !== false,
    mode: ['both', 'arrow', 'panel'].includes(value.mode) ? value.mode : 'both',
    ms: [500, 1200, 3000, 6000].includes(Number(value.ms)) ? Number(value.ms) : 1200,
    multipv: [1, 3, 5].includes(Number(value.multipv)) ? Number(value.multipv) : 3,
    fontScale: FONT_SCALES.includes(Number(value.fontScale)) ? Number(value.fontScale) : 100,
    arrowScale: ARROW_SCALES.includes(Number(value.arrowScale)) ? Number(value.arrowScale) : 100,
    showArrows: value.showArrows !== false, arrowBest: value.arrowBest !== false,
    arrowSecond: value.arrowSecond === true, arrowThird: value.arrowThird === true,
    hideUnfavorableArrows: value.hideUnfavorableArrows !== false,
    showPieceLetters: value.showPieceLetters !== false };
}

export const ARROW_SETTINGS = ['showArrows', 'arrowBest', 'arrowSecond', 'arrowThird'];
export function arrowPreference(settings, key, checked) {
  const patch = { [key]: checked };
  if (checked) {
    if (key !== 'showArrows') patch.showArrows = true;
    if (settings.mode === 'panel') patch.mode = 'both';
    if (['arrowSecond', 'arrowThird'].includes(key) && settings.multipv < 3) patch.multipv = 3;
  }
  return patch;
}
