/**
 * Harmony Director Simulator - Main entry
 */

import { state, setModel } from './state.js';
import { initAudio, resumeAudio, setMainVolume, setBalance, noteOn, noteOff, startMetronome, stopMetronome, setTempo, releaseAll } from './audio/engine.js';
import { midiToNoteName, detectRoot } from './audio/temperament.js';
import { buildKeyboard, initComputerKeyboard } from './ui/keyboard.js';

// ---- LCD helpers ----
function updateLCD() {
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('lcd-voice', state.voiceId.toUpperCase().slice(0, 10));
  set('lcd-pitch', `A=${state.refPitch.toFixed(1)}`);
  set('lcd-temp', state.temperament.toUpperCase());
  set('lcd-root', midiToNoteName(state.rootNote).replace(/\d/, ''));
  set('lcd-transpose', `T=${state.transpose >= 0 ? '+' : ''}${state.transpose}`);
  set('lcd-tempo', `♩=${state.tempo}`);
  set('lcd-beat', '4/4');
  set('lcd-mem', 'M1');
  set('lcd-status', state.lcd.status);

  const transDisp = document.getElementById('trans-display');
  if (transDisp) transDisp.textContent = state.transpose;

  const octDisp = document.getElementById('octave-display');
  if (octDisp) octDisp.textContent = state.octave;

  const pitchDisp = document.getElementById('pitch-display');
  if (pitchDisp) pitchDisp.textContent = `${state.refPitch.toFixed(1)} Hz`;
}

// ---- Voice list ----
const VOICES = {
  wood: [
    { id: 'flute', name: 'Flute' },
    { id: 'oboe', name: 'Oboe' },
    { id: 'clarinet', name: 'Clarinet' },
    { id: 'sax', name: 'Saxophone' }
  ],
  brass: [
    { id: 'trumpet', name: 'Trumpet' },
    { id: 'horn', name: 'Horn' },
    { id: 'brass', name: 'Brass Ensemble' }
  ],
  organ: [
    { id: 'organ', name: 'Organ' }
  ],
  piano: [
    { id: 'piano', name: 'Grand Piano' },
    { id: 'epiano', name: 'Electric Piano' },
    { id: 'strings', name: 'Strings' },
    { id: 'choir', name: 'Choir' }
  ]
};

function populateVoices(cat) {
  const select = document.getElementById('voice-select');
  if (!select) return;
  select.innerHTML = '';
  const list = VOICES[cat] || VOICES.piano;
  list.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name;
    select.appendChild(opt);
  });
  state.voiceCategory = cat;
  state.voiceId = list[0].id;
  updateLCD();
}

// ---- Event bindings ----
function bindUI() {
  // Model switch
  document.querySelectorAll('.model-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setModel(btn.dataset.model);
      buildKeyboard();
      updateLCD();
    });
  });

  // Volume / Balance
  const mainVol = document.getElementById('main-vol');
  if (mainVol) {
    mainVol.addEventListener('input', e => setMainVolume(e.target.value / 100));
  }
  const balance = document.getElementById('balance');
  if (balance) {
    balance.addEventListener('input', e => setBalance(e.target.value / 100));
  }

  // Voice category
  document.querySelectorAll('.voice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      populateVoices(btn.dataset.cat);
    });
  });

  document.getElementById('voice-select')?.addEventListener('change', e => {
    state.voiceId = e.target.value;
    updateLCD();
  });

  // Temperament
  document.querySelectorAll('.temp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.temp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.temperament = btn.dataset.temp;
      updateLCD();
    });
  });

  document.getElementById('btn-lock')?.addEventListener('click', e => {
    state.rootLocked = !state.rootLocked;
    e.currentTarget.classList.toggle('active', state.rootLocked);
  });

  // Transpose
  document.getElementById('btn-trans-down')?.addEventListener('click', () => {
    state.transpose = Math.max(-12, state.transpose - 1);
    updateLCD();
  });
  document.getElementById('btn-trans-up')?.addEventListener('click', () => {
    state.transpose = Math.min(12, state.transpose + 1);
    updateLCD();
  });

  // Octave
  document.getElementById('octave')?.addEventListener('input', e => {
    state.octave = parseInt(e.target.value, 10);
    updateLCD();
  });

  // Ref pitch
  document.getElementById('ref-pitch')?.addEventListener('input', e => {
    state.refPitch = parseInt(e.target.value, 10) / 10;
    updateLCD();
  });

  // HOLD
  document.getElementById('btn-hold')?.addEventListener('click', e => {
    state.hold = !state.hold;
    e.currentTarget.classList.toggle('active', state.hold);
    if (!state.hold) releaseAll();
    state.lcd.status = state.hold ? 'HOLD' : 'READY';
    updateLCD();
  });

  // Metronome
  document.getElementById('btn-metro-start')?.addEventListener('click', e => {
    if (state.metroRunning) {
      stopMetronome();
      e.currentTarget.textContent = 'START';
      e.currentTarget.classList.remove('active');
      state.lcd.status = 'READY';
    } else {
      startMetronome();
      e.currentTarget.textContent = 'STOP';
      e.currentTarget.classList.add('active');
      state.lcd.status = 'METRO';
    }
    updateLCD();
  });

  document.getElementById('tempo-input')?.addEventListener('change', e => {
    setTempo(parseInt(e.target.value, 10) || 120);
    e.target.value = state.tempo;
    updateLCD();
  });

  // Tap tempo
  let lastTap = 0;
  let tapIntervals = [];
  document.getElementById('btn-tap')?.addEventListener('click', () => {
    const now = performance.now();
    if (lastTap > 0) {
      const interval = now - lastTap;
      if (interval < 2000) {
        tapIntervals.push(interval);
        if (tapIntervals.length > 4) tapIntervals.shift();
        const avg = tapIntervals.reduce((a, b) => a + b, 0) / tapIntervals.length;
        setTempo(Math.round(60000 / avg));
        document.getElementById('tempo-input').value = state.tempo;
        updateLCD();
      } else {
        tapIntervals = [];
      }
    }
    lastTap = now;
  });

  // Metro volumes
  document.querySelectorAll('.metro-note-vol').forEach(sl => {
    sl.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.beat, 10) - 1;
      state.metroVolumes[idx] = e.target.value / 100;
    });
  });
}

// ---- Boot ----
function boot() {
  setModel('HD-300');
  initAudio();
  populateVoices('piano');
  buildKeyboard();
  initComputerKeyboard();
  bindUI();
  updateLCD();

  // First user gesture resumes audio context
  const unlock = () => {
    resumeAudio();
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);

  console.log('%cHarmony Director Simulator ready', 'color:#e8b86d;font-weight:bold');
}

boot();
