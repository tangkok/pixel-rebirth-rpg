const paths: Record<string, string> = {
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
  person:
    '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M9 16l3 3 3-3"/>',
  bag: '<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M5 12h14M9 12v3m6-3v3"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  book: '<path d="M4 3h14a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2ZM4 16h16M8 7h8M8 10h5"/>',
  settings:
    '<path d="m9 3-1 3-3 1-2 4 2 2v4l4 2 3-1 3 1 4-2v-4l2-2-2-4-3-1-1-3H9Z"/><circle cx="12" cy="11" r="3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  arrowUp: '<path d="M6 18 18 6M6 6h12v12"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  cloud:
    '<path d="M7 17H6a4 4 0 0 1-.5-8 6.5 6.5 0 0 1 12-2A5 5 0 0 1 19 17h-2M9 17l2 2 4-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4m0 3h.01"/>',
  sound:
    '<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  sword:
    '<path d="m14 3 7-1-1 7-11 11-5-5L14 3Zm-8 9 6 6M3 21l4-4M2 18l4 4M16 5l3 3"/>',
  spark:
    '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  flag: '<path d="M5 22V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m7 4 14 8-14 8V4Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  leaf: '<path d="M20 3C9 2 3 6 4 13a7 7 0 0 0 7 7c7 0 10-7 9-17ZM4 21 16 9"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  potion:
    '<path d="M9 2h6v5l4 5a6 6 0 0 1-1 8H6a6 6 0 0 1-1-8l4-5V2ZM7 14h10M8 2h8"/>',
};
export const icon = (name: string, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.spark}</svg>`;
