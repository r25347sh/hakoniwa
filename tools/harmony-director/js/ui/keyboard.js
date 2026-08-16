/**
 * Virtual Keyboard UI & interaction
 */

import { state } from '../state.js';
import { noteOn, noteOff, resumeAudio } from '../audio/engine.js';
import { midiToNoteName } from '../audio/temperament.js';

const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const NOTE_OFFSETS = {
  'HD-300': { start: 36, count: 61 }, // C2 to C7
  'HD-200': { start: 36, count: 49 }  // C2 to C6
};

let pointerNotes = new Map(); // pointerId -> midi

export function buildKeyboard() {
  const container = document.getElementById('keyboard');
  if (!container) return;
  container.innerHTML = '';

  const { start, count } = NOTE_OFFSETS[state.model] || NOTE_OFFSETS['HD-300'];
  const end = start + count - 1;

  // First pass: white keys
  for (let midi = start; midi <= end; midi++) {
    const pc = midi % 12;
    if (WHITE_NOTES.includes(pc)) {
      const key = createKey(midi, false);
      container.appendChild(key);
    }
  }

  // Second pass: black keys (positioned absolutely relative would be better,
  // but flex + negative margin works for this density)
  // We rebuild with proper structure
  container.innerHTML = '';
  let whiteIndex = 0;
  for (let midi = start; midi <= end; midi++) {
    const pc = midi % 12;
    const isBlack = !WHITE_NOTES.includes(pc);
    if (!isBlack) {
      const key = createKey(midi, false);
      container.appendChild(key);
      whiteIndex++;
    } else {
      const key = createKey(midi, true);
      // Insert black key after previous white conceptually via margin
      container.appendChild(key);
    }
  }

  // Event delegation
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerUp);
  container.addEventListener('pointerleave', onPointerUp);
  container.addEventListener('pointermove', onPointerMove);
}

function createKey(midi, isBlack) {
  const el = document.createElement('div');
  el.className = `key ${isBlack ? 'black' : 'white'}`;
  el.dataset.midi = midi;
  el.dataset.note = midiToNoteName(midi).replace(/\d/, '');

  const label = document.createElement('span');
  label.className = 'label';
  // Show only C labels for clarity
  if (midi % 12 === 0) {
    label.textContent = midiToNoteName(midi);
  }
  el.appendChild(label);
  return el;
}

function onPointerDown(e) {
  const key = e.target.closest('.key');
  if (!key) return;
  e.preventDefault();
  resumeAudio();
  const midi = parseInt(key.dataset.midi, 10);
  key.classList.add('active');
  pointerNotes.set(e.pointerId, midi);
  key.setPointerCapture(e.pointerId);
  noteOn(midi, 0.85);
}

function onPointerUp(e) {
  const midi = pointerNotes.get(e.pointerId);
  if (midi === undefined) return;
  pointerNotes.delete(e.pointerId);
  const key = document.querySelector(`.key[data-midi="${midi}"]`);
  if (key) key.classList.remove('active');
  noteOff(midi);
}

function onPointerMove(e) {
  // Optional: glissando support could go here
}

// Computer keyboard mapping (Z-X-C-V... for white, S-D-G... for black)
const KEY_MAP = {
  KeyZ: 48, KeyS: 49, KeyX: 50, KeyD: 51, KeyC: 52,
  KeyV: 53, KeyG: 54, KeyB: 55, KeyH: 56, KeyN: 57,
  KeyJ: 58, KeyM: 59, Comma: 60, KeyL: 61, Period: 62,
  Semicolon: 63, Slash: 64,
  KeyQ: 60, Digit2: 61, KeyW: 62, Digit3: 63, KeyE: 64,
  KeyR: 65, Digit5: 66, KeyT: 67, Digit6: 68, KeyY: 69,
  Digit7: 70, KeyU: 71, KeyI: 72
};

const heldKeys = new Set();

export function initComputerKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.repeat || !KEY_MAP[e.code]) return;
    if (heldKeys.has(e.code)) return;
    heldKeys.add(e.code);
    resumeAudio();
    const midi = KEY_MAP[e.code] + state.octave * 12;
    noteOn(midi, 0.8);
    const keyEl = document.querySelector(`.key[data-midi="${midi}"]`);
    if (keyEl) keyEl.classList.add('active');
  });

  window.addEventListener('keyup', (e) => {
    if (!KEY_MAP[e.code]) return;
    heldKeys.delete(e.code);
    const midi = KEY_MAP[e.code] + state.octave * 12;
    noteOff(midi);
    const keyEl = document.querySelector(`.key[data-midi="${midi}"]`);
    if (keyEl) keyEl.classList.remove('active');
  });
}
