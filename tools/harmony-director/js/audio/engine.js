/**
 * Web Audio Engine - expanded voice set + figure + pure temperament
 */

import { state, updatePolyphony } from '../state.js';
import { midiToFreq, detectRoot } from './temperament.js';

let audioCtx = null;
let masterGain = null;
let keyboardGain = null;
let rhythmGain = null;

const activeVoices = new Map();

export function initAudio() {
  if (audioCtx) return audioCtx;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = state.mainVolume;
  masterGain.connect(audioCtx.destination);
  keyboardGain = audioCtx.createGain();
  keyboardGain.gain.value = 1 - state.balance * 0.65;
  keyboardGain.connect(masterGain);
  rhythmGain = audioCtx.createGain();
  rhythmGain.gain.value = state.balance * 0.85 + 0.1;
  rhythmGain.connect(masterGain);
  return audioCtx;
}

export function resumeAudio() {
  if (audioCtx?.state === 'suspended') return audioCtx.resume();
  return Promise.resolve();
}

export function setMainVolume(v) {
  state.mainVolume = v;
  if (masterGain) masterGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.02);
}

export function setBalance(b) {
  state.balance = b;
  if (keyboardGain) keyboardGain.gain.setTargetAtTime(1 - b * 0.65, audioCtx.currentTime, 0.02);
  if (rhythmGain) rhythmGain.gain.setTargetAtTime(b * 0.85 + 0.1, audioCtx.currentTime, 0.02);
}

function createVoiceNodes(freq, voiceId, velocity = 0.8) {
  const now = audioCtx.currentTime;
  const oscs = [];
  const gains = [];
  const atk = 0.005 + state.attack * 0.12;
  const rel = 0.08 + state.release * 0.6;
  const bri = 0.4 + state.brilliance * 1.8;

  const connectEnv = (osc, peak, filterFreq = null) => {
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak * velocity, now + atk);
    if (voiceId.includes('piano') || voiceId.includes('epiano') || voiceId.includes('vibes')) {
      g.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    }
    if (filterFreq) {
      const f = audioCtx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq * bri;
      f.Q.value = 2.5;
      osc.connect(f);
      f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(keyboardGain);
    osc.start(now);
    oscs.push(osc);
    gains.push(g);
  };

  const id = voiceId.toLowerCase();

  if (id.includes('organ')) {
    [1, 2, 3, 4, 6, 8].forEach((p, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * p;
      connectEnv(osc, 0.18 / (i * 0.6 + 1));
    });
  } else if (id.includes('trumpet') || id.includes('brass') || id.includes('horn') || id.includes('trombone') || id.includes('tuba')) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    connectEnv(osc, 0.28, 900 + velocity * 1800);
  } else if (id.includes('flute') || id.includes('piccolo')) {
    const o1 = audioCtx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = audioCtx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 1.002;
    connectEnv(o1, 0.2);
    connectEnv(o2, 0.08);
  } else if (id.includes('clarinet') || id.includes('oboe') || id.includes('bassoon') || id.includes('sax')) {
    const o1 = audioCtx.createOscillator(); o1.type = 'square'; o1.frequency.value = freq;
    const o2 = audioCtx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 3;
    connectEnv(o1, 0.16, 1400);
    connectEnv(o2, 0.05);
  } else if (id.includes('string') || id.includes('violin') || id.includes('cello') || id.includes('viola')) {
    const o1 = audioCtx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq;
    const o2 = audioCtx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq * 1.005;
    connectEnv(o1, 0.14, 2200);
    connectEnv(o2, 0.1, 1800);
  } else if (id.includes('choir') || id.includes('voice') || id.includes('aah')) {
    const o1 = audioCtx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = audioCtx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 0.997;
    const o3 = audioCtx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 1.5;
    connectEnv(o1, 0.16);
    connectEnv(o2, 0.12);
    connectEnv(o3, 0.04);
  } else if (id.includes('vibes') || id.includes('marimba') || id.includes('glock')) {
    const o1 = audioCtx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const o2 = audioCtx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 3.99;
    connectEnv(o1, 0.25);
    connectEnv(o2, 0.08);
  } else {
    // Piano / default AWM-like
    [[1, 0.38], [2, 0.16], [3, 0.07], [4.01, 0.035], [5.02, 0.02]].forEach(([r, g]) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * r;
      connectEnv(osc, g);
    });
  }

  return { oscs, gains, startTime: now, release: rel };
}

export function noteOn(midiNote, velocity = 0.8) {
  if (!audioCtx) initAudio();
  resumeAudio();

  if (activeVoices.has(midiNote)) noteOff(midiNote, true);

  // Auto root detection
  if (state.autoRoot && !state.rootLocked) {
    const held = [...state.activeNotes.keys(), midiNote];
    state.rootNote = detectRoot(held);
  }

  const freq = midiToFreq(
    midiNote + state.transpose + state.octave * 12,
    state.refPitch,
    state.temperament,
    state.rootNote,
    state.individualCents
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

  if (state.hold && !immediate) return;

  const rel = voice.release || 0.15;
  voice.gains.forEach(g => {
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.001), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + rel);
  });
  voice.oscs.forEach(osc => { try { osc.stop(now + rel + 0.05); } catch (_) {} });

  activeVoices.delete(midiNote);
  state.activeNotes.delete(midiNote);
  updatePolyphony();
}

export function releaseAll() {
  for (const m of [...activeVoices.keys()]) noteOff(m, true);
}

// Metronome
let metroTimer = null;
let metroBeat = 0;

function playClick(isAccent) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const type = state.metroSound;
  if (type === 'beep') {
    osc.type = 'sine';
    osc.frequency.value = isAccent ? 1800 : 1200;
  } else if (type === 'click') {
    osc.type = 'triangle';
    osc.frequency.value = isAccent ? 2000 : 1000;
  } else {
    osc.type = 'square';
    osc.frequency.value = isAccent ? 1400 : 900;
  }
  const vol = isAccent ? 0.22 : 0.11;
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(g);
  g.connect(rhythmGain);
  osc.start(now);
  osc.stop(now + 0.05);
}

export function startMetronome() {
  if (state.metroRunning) return;
  state.metroRunning = true;
  metroBeat = 0;
  const tick = () => {
    if (!state.metroRunning) return;
    const isAccent = metroBeat === 0;
    const volIdx = Math.min(metroBeat, 4);
    if (state.metroVolumes[volIdx] > 0.05) playClick(isAccent);
    state.currentBeat = metroBeat;
    metroBeat = (metroBeat + 1) % 4;
    metroTimer = setTimeout(tick, (60 / state.tempo) * 1000);
  };
  tick();
}

export function stopMetronome() {
  state.metroRunning = false;
  if (metroTimer) { clearTimeout(metroTimer); metroTimer = null; }
  state.currentBeat = 0;
}

export function setTempo(t) {
  state.tempo = Math.max(32, Math.min(280, t));
}
