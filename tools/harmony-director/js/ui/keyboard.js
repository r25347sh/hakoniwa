/**
 * Virtual Keyboard - reliable interaction + proper black key layout
 */

import { state } from '../state.js';
import { noteOn, noteOff, resumeAudio } from '../audio/engine.js';
import { midiToNoteName } from '../audio/temperament.js';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const NOTE_OFFSETS = {
  'HD-300': { start: 36, count: 61 },
  'HD-200': { start: 36, count: 49 }
};

let pointerNotes = new Map();
let bound = false;

export function buildKeyboard() {
  const container = document.getElementById('keyboard');
  if (!container) return;
  container.innerHTML = '';

  const { start, count } = NOTE_OFFSETS[state.model] || NOTE_OFFSETS['HD-300'];
  const end = start + count - 1;

  // Collect whites for positioning
  const whites = [];
  for (let m = start; m <= end; m++) {
    if (WHITE_PCS.includes(m % 12)) whites.push(m);
  }

  const whiteW = 100 / whites.length;

  // White keys
  whites.forEach((midi, i) => {
    const key = createKey(midi, false);
    key.style.left = `${i * whiteW}%`;
    key.style.width = `${whiteW}%`;
    container.appendChild(key);
  });

  // Black keys (absolute between whites)
  for (let m = start; m <= end; m++) {
    if (WHITE_PCS.includes(m % 12)) continue;
    // find white index of previous white
    let prevWhiteIdx = -1;
    for (let i = 0; i < whites.length; i++) {
      if (whites[i] < m) prevWhiteIdx = i;
      else break;
    }
    if (prevWhiteIdx < 0) continue;
    const key = createKey(m, true);
    const left = (prevWhiteIdx + 1) * whiteW - whiteW * 0.32;
    key.style.left = `${left}%`;
    key.style.width = `${whiteW * 0.62}%`;
    container.appendChild(key);
  }

  if (!bound) {
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('pointerup', onPointerUp);
    bound = true;
  }
}

function createKey(midi, isBlack) {
  const el = document.createElement('div');
  el.className = `key ${isBlack ? 'black' : 'white'}`;
  el.dataset.midi = String(midi);
  el.dataset.note = midiToNoteName(midi).replace(/\d+/, '');
  if (midi % 12 === 0) {
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = midiToNoteName(midi);
    el.appendChild(label);
  }
  return el;
}

function onPointerDown(e) {
  const key = e.target.closest('.key');
  if (!key || !state.power) return;
  e.preventDefault();
  resumeAudio();
  const midi = parseInt(key.dataset.midi, 10);
  if (pointerNotes.has(e.pointerId)) return;
  key.classList.add('active');
  pointerNotes.set(e.pointerId, midi);
  try { key.setPointerCapture(e.pointerId); } catch (_) {}
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
    if (e.repeat || !KEY_MAP[e.code] || !state.power) return;
    if (heldKeys.has(e.code)) return;
    heldKeys.add(e.code);
    resumeAudio();
    const midi = KEY_MAP[e.code] + state.octave * 12;
    noteOn(midi, 0.8);
    document.querySelector(`.key[data-midi="${midi}"]`)?.classList.add('active');
  });
  window.addEventListener('keyup', (e) => {
    if (!KEY_MAP[e.code]) return;
    heldKeys.delete(e.code);
    const midi = KEY_MAP[e.code] + state.octave * 12;
    noteOff(midi);
    document.querySelector(`.key[data-midi="${midi}"]`)?.classList.remove('active');
  });
}
