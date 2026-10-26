// Original Staunton-inspired drawings shared by notation and extension branding.
const SHAPES = {
  K: `<path d="M22.5 3.5v8M18.7 7.2h7.6" fill="none" stroke-width="2.3"/>
    <path d="M16.7 17.5c-2.2-6.2 3.1-9.3 5.8-5.8 2.7-3.5 8-.4 5.8 5.8l-2 5h-7.6z"/>
    <path d="M14.8 18.4c-5.2-5.3-10.7-.6-7.1 5l6.3 8.7h17l6.3-8.7c3.6-5.6-1.9-10.3-7.1-5l-3.7 5.4h-8z"/>
    <path d="M15.3 28.4c4.6-1.6 9.8-1.6 14.4 0M16 31.4h13" class="piece-detail"/>`,
  Q: `<path d="m9.5 13 5.1 3.6 1.7-7.5 6.2 7 6.2-7 1.7 7.5 5.1-3.6-4.6 15.4H14.1z"/>
    <circle cx="8.9" cy="11.5" r="2.3"/><circle cx="16" cy="7.5" r="2.3"/>
    <circle cx="22.5" cy="11.7" r="2.3"/><circle cx="29" cy="7.5" r="2.3"/><circle cx="36.1" cy="11.5" r="2.3"/>
    <path d="M14.1 26.5c5.6-2.3 11.2-2.3 16.8 0l1.4 5.7H12.7z"/>
    <path d="M15.7 29c4.5-1.4 9.1-1.4 13.6 0" class="piece-detail"/>`,
  R: `<path d="M10.5 7.5h6v5h3v-5h6v5h3v-5h6v12l-4.7 3.7 1.7 9H13.5l1.7-9-4.7-3.7z"/>
    <path d="M11.5 18.6h22M15.3 23.2h14.4M17.1 25v4.2M27.9 25v4.2" class="piece-detail"/>`,
  B: `<circle cx="22.5" cy="5.7" r="2.1"/>
    <path d="M22.5 8c-3 3.5-9.2 7.4-9.2 13 0 5.3 4.2 7.5 9.2 7.5s9.2-2.2 9.2-7.5c0-5.6-6.2-9.5-9.2-13z"/>
    <path d="m24.8 13.4-6.3 7.4" class="piece-detail" stroke-width="2"/>
    <path d="m16.8 27.2-3.3 5h18l-3.3-5"/>
    <path d="M16.6 30h11.8" class="piece-detail"/>`,
  N: `<path d="M12.5 32.3c-.4-5.8 2.1-9.1 6.8-13.3l-6.2 2.2-4.4-1.5.6-4.4 7.9-5.4 1.2-5 4.7 3.6 3.8-1.1c7.1 5.7 9.2 13.5 7.1 24.9z"/>
    <path d="M26.9 11.9c4.6 5.1 5.6 10.9 4.1 17.1M20.2 22.4c-2.6 2.3-3.8 4.4-3.8 7.2M10.7 17.7l3.1.4" class="piece-detail"/>
    <circle cx="19.1" cy="12.9" r="1.2" class="piece-eye" stroke="none"/>`
};
let nextId = 0;

export function renderPiece(doc, piece, side = 'w') {
  if (!SHAPES[piece]) throw new Error(`Peça desconhecida: ${piece}`);
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const id = `sf-piece-fill-${++nextId}`;
  const white = side === 'w';
  svg.setAttribute('class', `chess-piece-svg piece-${white ? 'white' : 'black'}`);
  svg.setAttribute('viewBox', '0 0 45 45');
  svg.setAttribute('width', '45');
  svg.setAttribute('height', '45');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('data-piece', piece);
  svg.setAttribute('data-side', side);
  svg.innerHTML = `<defs><linearGradient id="${id}" x1="0" y1="0" x2=".8" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0" stop-color="${white ? '#fff9e8' : '#637684'}"/>
      <stop offset=".5" stop-color="${white ? '#f1e5ca' : '#32424f'}"/>
      <stop offset="1" stop-color="${white ? '#c6b28b' : '#19262f'}"/>
    </linearGradient></defs>
    <g fill="url(#${id})" stroke="${white ? '#45504a' : '#b0c1ca'}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      ${SHAPES[piece]}
      <path d="M13.5 32.1h18l3 4H10.5z"/>
      <path d="M10.5 36.1h24l2.1 4.4H8.4z"/>
      <path d="M12.2 37.5h20.6" class="piece-detail"/>
    </g>`.replace(/>\s+</g, '><').trim();
  svg.style.setProperty('--piece-detail', white ? '#79694b' : '#d2dfe5');
  return svg;
}
