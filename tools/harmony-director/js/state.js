/**
 * Central application state - HD-300 / HD-200 full feature set
 */

export const state = {
  model: 'HD-300',
  power: true,

  // Audio
  mainVolume: 0.72,
  balance: 0.4,
  refPitch: 440.0,
  centOffset: 0,
  temperament: 'equal',       // equal | pure-major | pure-minor | individual
  rootLocked: false,
  autoRoot: true,
  rootNote: 60,
  transpose: 0,
  octave: 0,
  hold: false,

  // Voice
  voiceCategory: 'piano',
  voiceId: 'piano',

  // Figure (HD-200 style)
  attack: 0.3,
  release: 0.4,
  brilliance: 0.5,

  // Metronome
  tempo: 120,
  refNote: 4,
  metroRunning: false,
  metroPattern: 'all',
  metroSound: 'peck',
  metroVolumes: [0.9, 0.55, 0.55, 0.55, 0.4],
  currentBeat: 0,

  // Individual (cent offsets per pitch class 0-11)
  individualCents: new Array(12).fill(0),
  individualVols: new Array(12).fill(1),

  // Keyboard
  keys: 61,
  activeNotes: new Map(),
  polyphony: 0,

  lcd: { status: 'READY' }
};

export function setModel(model) {
  state.model = model;
  state.keys = model === 'HD-300' ? 61 : 49;
  document.body.classList.toggle('model-hd200', model === 'HD-200');
  document.body.classList.toggle('model-hd300', model === 'HD-300');
  const badge = document.getElementById('model-badge');
  if (badge) badge.textContent = model;
}

export function updatePolyphony() {
  state.polyphony = state.activeNotes.size;
  const el = document.getElementById('polyphony-display');
  if (el) el.textContent = `Poly: ${state.polyphony} / ${state.model === 'HD-300' ? 48 : 32}`;
  const lcdPoly = document.getElementById('lcd-poly');
  if (lcdPoly) lcdPoly.textContent = `Poly ${state.polyphony}`;
}
