/**
 * Web Audio Engine for Harmony Director
 * Supports multiple voice types + metronome
 */

import { state, updatePolyphony } from '../state.js';
import { midiToFreq } from './temperament.js';

let audioCtx = null;
let masterGain = null;
let keyboardGain = null;
let rhythmGain = null;

const activeVoices = new Map(); // midi -> { nodes, release }

export function initAudio() {
  if (audioCtx) return audioCtx;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = state.mainVolume;
  masterGain.connect(audioCtx.destination);

  keyboardGain = audioCtx.createGain();
  keyboardGain.gain.value = 1 - state.balance * 0.7;
  keyboardGain.connect(masterGain);

  rhythmGain = audioCtx.createGain();
  rhythmGain.gain.value = state.balance * 0.9 + 0.1;
  rhythmGain.connect(masterGain);

  return audioCtx;
}

export function resumeAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    return audioCtx.resume();
  }
  return Promise.resolve();
}

export function setMainVolume(v) {
  state.mainVolume = v;
  if (masterGain) masterGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.02);
}

export function setBalance(b) {
  state.balance = b;
  if (keyboardGain) keyboardGain.gain.setTargetAtTime(1 - b * 0.7, audioCtx.currentTime, 0.02);
  if (rhythmGain) rhythmGain.gain.setTargetAtTime(b * 0.9 + 0.1, audioCtx.currentTime, 0.02);
}

function createVoiceNodes(freq, voiceId, velocity = 0.8) {
  const now = audioCtx.currentTime;
  const oscs = [];
  const gains = [];

  // Simple multi-oscillator synthesis approximating FM / AWM characters
  if (voiceId.includes('organ') || voiceId === 'organ') {
    // Drawbar-ish organ
    const partials = [1, 2, 3, 4, 6];
    partials.forEach((p, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p;
      const g = audioCtx.createGain();
      g.gain.value = (0.25 / (i + 1)) * velocity;
      osc.connect(g);
      g.connect(keyboardGain);
      osc.start(now);
      oscs.push(osc);
      gains.push(g);
    });
  } else if (voiceId.includes('brass') || voiceId.includes('trumpet') || voiceId.includes('horn')) {
    // Brass-like: saw + filter
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200 + velocity * 2000;
    filter.Q.value = 4;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.3 * velocity, now + 0.03);
    osc.connect(filter);
    filter.connect(g);
    g.connect(keyboardGain);
    osc.start(now);
    oscs.push(osc);
    gains.push(g);
  } else if (voiceId.includes('wood') || voiceId.includes('flute') || voiceId.includes('clarinet') || voiceId.includes('oboe') || voiceId.includes('sax')) {
    // Woodwind-ish: sine + slight detune + noise breath
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    const osc2 = audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 1.003;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.22 * velocity, now + 0.04);
    osc1.connect(g);
    osc2.connect(g);
    g.connect(keyboardGain);
    osc1.start(now);
    osc2.start(now);
    oscs.push(osc1, osc2);
    gains.push(g);
  } else {
    // Default piano-ish / AWM: multiple detuned sines + decay
    const partials = [
      { ratio: 1, gain: 0.4 },
      { ratio: 2, gain: 0.18 },
      { ratio: 3, gain: 0.08 },
      { ratio: 4.02, gain: 0.04 }
    ];
    partials.forEach(({ ratio, gain }) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain * velocity, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      osc.connect(g);
      g.connect(keyboardGain);
      osc.start(now);
      oscs.push(osc);
      gains.push(g);
    });
  }

  return { oscs, gains, startTime: now };
}

export function noteOn(midiNote, velocity = 0.8) {
  if (!audioCtx) initAudio();
  resumeAudio();

  // Stop existing voice on same note (retrigger)
  if (activeVoices.has(midiNote)) {
    noteOff(midiNote, true);
  }

  const freq = midiToFreq(
    midiNote + state.transpose + state.octave * 12,
    state.refPitch,
    state.temperament,
    state.rootNote
  );

  const nodes = createVoiceNodes(freq, state.voiceId, velocity);
  activeVoices.set(midiNote, nodes);
  state.activeNotes.set(midiNote, true);
  updatePolyphony();
}

export function noteOff(midiNote, immediate = false) {
  const voice = activeVoices.get(midiNote);
  if (!voice) return;

  const now = audioCtx.currentTime;

  if (state.hold && !immediate) {
    // Keep sounding under HOLD
    return;
  }

  voice.gains.forEach(g => {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  });

  voice.oscs.forEach(osc => {
    try { osc.stop(now + 0.18); } catch (_) {}
  });

  activeVoices.delete(midiNote);
  state.activeNotes.delete(midiNote);
  updatePolyphony();
}

export function releaseAll() {
  for (const midi of [...activeVoices.keys()]) {
    noteOff(midi, true);
  }
}

// ---- Metronome ----
let metroTimer = null;
let metroBeat = 0;

function playClick(isAccent) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = isAccent ? 1200 : 800;
  g.gain.setValueAtTime(isAccent ? 0.25 : 0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc.connect(g);
  g.connect(rhythmGain);
  osc.start(now);
  osc.stop(now + 0.06);
}

export function startMetronome() {
  if (state.metroRunning) return;
  state.metroRunning = true;
  metroBeat = 0;

  const tick = () => {
    if (!state.metroRunning) return;
    const isAccent = metroBeat === 0;
    const volIdx = Math.min(metroBeat, 4);
    if (state.metroVolumes[volIdx] > 0.05) {
      playClick(isAccent);
    }
    state.currentBeat = metroBeat;
    metroBeat = (metroBeat + 1) % 4;

    const interval = (60 / state.tempo) * 1000;
    metroTimer = setTimeout(tick, interval);
  };
  tick();
}

export function stopMetronome() {
  state.metroRunning = false;
  if (metroTimer) {
    clearTimeout(metroTimer);
    metroTimer = null;
  }
  state.currentBeat = 0;
}

export function setTempo(t) {
  state.tempo = Math.max(32, Math.min(280, t));
}
