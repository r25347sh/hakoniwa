/**
 * Central application state for Harmony Director Simulator
 */

export const state = {
  model: 'HD-300',          // 'HD-300' | 'HD-200'
  power: true,

  // Audio
  mainVolume: 0.7,
  balance: 0.5,             // 0 = keyboard only, 1 = rhythm only
  refPitch: 440.0,          // Hz
  temperament: 'equal',     // 'equal' | 'pure' | 'individual'
  rootLocked: false,
  rootNote: 0,              // MIDI note number of current root (C=0 relative)
  transpose: 0,             // semitones -12 .. +12
  octave: 0,                // -2 .. +2
  hold: false,

  // Voice
  voiceCategory: 'piano',
  voiceId: 'piano',

  // Metronome
  tempo: 120,
  refNote: 4,               // 8 | 4 | 'dotted4'
  metroRunning: false,
  metroPattern: 'all',      // 'all' | 'alternate'
  metroSound: 'peck',
  metroVolumes: [0.8, 0.5, 0.5, 0.5, 0.5],
  currentBeat: 0,

  // Keyboard
  keys: 61,                 // 61 for HD-300, 49 for HD-200
  activeNotes: new Map(),   // midiNote -> { oscillator nodes etc }
  polyphony: 0,

  // UI
  lcd: {
    status: 'READY'
  }
};

export function setModel(model) {
  state.model = model;
  state.keys = model === 'HD-300' ? 61 : 49;
  document.body.classList.toggle('model-hd200', model === 'HD-200');
  document.body.classList.toggle('model-hd300', model === 'HD-300');
}

export function updatePolyphony() {
  state.polyphony = state.activeNotes.size;
  const el = document.getElementById('polyphony-display');
  if (el) el.textContent = `Poly: ${state.polyphony}`;
}
