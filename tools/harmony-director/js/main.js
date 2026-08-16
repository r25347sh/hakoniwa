/**
 * Harmony Director Simulator - Full feature entry
 */

import { state, setModel } from './state.js';
import {
  initAudio, resumeAudio, setMainVolume, setBalance,
  startMetronome, stopMetronome, setTempo, releaseAll
} from './audio/engine.js';
import { midiToNoteName } from './audio/temperament.js';
import { buildKeyboard, initComputerKeyboard } from './ui/keyboard.js';

// ---- Expanded Voice Lists ----
const VOICES = {
  wood: [
    { id: 'flute', name: 'Flute' },
    { id: 'piccolo', name: 'Piccolo' },
    { id: 'oboe', name: 'Oboe' },
    { id: 'clarinet', name: 'Clarinet' },
    { id: 'bassoon', name: 'Bassoon' },
    { id: 'sax', name: 'Alto Sax' },
    { id: 'tenor-sax', name: 'Tenor Sax' }
  ],
  brass: [
    { id: 'trumpet', name: 'Trumpet' },
    { id: 'horn', name: 'Horn' },
    { id: 'trombone', name: 'Trombone' },
    { id: 'tuba', name: 'Tuba' },
    { id: 'brass', name: 'Brass Ens.' }
  ],
  organ: [
    { id: 'organ', name: 'Pipe Organ' },
    { id: 'hammond', name: 'Hammond' }
  ],
  piano: [
    { id: 'piano', name: 'Grand Piano' },
    { id: 'epiano', name: 'E.Piano' },
    { id: 'strings', name: 'Strings' },
    { id: 'violin', name: 'Violin' },
    { id: 'cello', name: 'Cello' },
    { id: 'choir', name: 'Choir Aah' },
    { id: 'vibes', name: 'Vibraphone' },
    { id: 'marimba', name: 'Marimba' },
    { id: 'glock', name: 'Glockenspiel' }
  ]
};

// HD-200 classic 10 voices mapping
const HD200_VOICES = [
  { id: 'flute', name: 'Flute' },
  { id: 'oboe', name: 'Oboe' },
  { id: 'clarinet', name: 'Clarinet' },
  { id: 'sax', name: 'Saxophone' },
  { id: 'organ', name: 'Organ' },
  { id: 'trumpet', name: 'Trumpet' },
  { id: 'horn', name: 'Horn' },
  { id: 'brass', name: 'Brass' },
  { id: 'strings', name: 'String' },
  { id: 'piano', name: 'Piano' }
];

function updateLCD() {
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

  set('lcd-voice', state.voiceId.toUpperCase().replace('-', ' ').slice(0, 12));
  set('lcd-pitch', `A=${state.refPitch.toFixed(1)}`);
  set('lcd-cent', `${state.centOffset >= 0 ? '+' : ''}${state.centOffset.toFixed(1)}c`);

  const tempLabel = {
    'equal': 'EQUAL',
    'pure-major': 'PURE MAJ',
    'pure-minor': 'PURE MIN',
    'individual': 'INDIV'
  }[state.temperament] || 'EQUAL';
  set('lcd-temp', tempLabel);
  set('lcd-root', midiToNoteName(state.rootNote).replace(/\d+/, ''));
  set('lcd-key', state.temperament.includes('minor') ? 'Minor' : 'Major');
  set('lcd-transpose', `T${state.transpose >= 0 ? '+' : ''}${state.transpose}`);
  set('lcd-tempo', `♩ = ${state.tempo}`);
  set('lcd-beat', '4/4');
  set('lcd-mem', 'M1');
  set('lcd-status', state.lcd.status);

  const t = document.getElementById('trans-display');
  if (t) t.textContent = state.transpose;
  const o = document.getElementById('octave-display');
  if (o) o.textContent = state.octave;
  const p = document.getElementById('pitch-display');
  if (p) p.textContent = state.refPitch.toFixed(1);
}

function populateVoices(cat) {
  const select = document.getElementById('voice-select');
  if (!select) return;
  select.innerHTML = '';

  let list;
  if (state.model === 'HD-200') {
    list = HD200_VOICES;
  } else {
    list = VOICES[cat] || VOICES.piano;
  }

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

function bindUI() {
  // Model
  document.querySelectorAll('.model-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setModel(btn.dataset.model);
      populateVoices(state.voiceCategory);
      buildKeyboard();
      updateLCD();
    });
  });

  // Power
  document.getElementById('btn-power')?.addEventListener('click', e => {
    state.power = !state.power;
    e.currentTarget.classList.toggle('active', state.power);
    document.getElementById('device')?.classList.toggle('powered-off', !state.power);
    if (!state.power) { stopMetronome(); releaseAll(); }
    state.lcd.status = state.power ? 'READY' : 'OFF';
    updateLCD();
  });

  // Volume / Balance
  document.getElementById('main-vol')?.addEventListener('input', e => setMainVolume(e.target.value / 100));
  document.getElementById('balance')?.addEventListener('input', e => setBalance(e.target.value / 100));

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

  // Figure (HD-200)
  document.getElementById('fig-attack')?.addEventListener('input', e => { state.attack = e.target.value / 100; });
  document.getElementById('fig-release')?.addEventListener('input', e => { state.release = e.target.value / 100; });
  document.getElementById('fig-brill')?.addEventListener('input', e => { state.brilliance = e.target.value / 100; });

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
  document.getElementById('btn-auto-root')?.addEventListener('click', e => {
    state.autoRoot = !state.autoRoot;
    e.currentTarget.classList.toggle('active', state.autoRoot);
  });

  // Transpose presets
  document.querySelectorAll('.trans-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      state.transpose = parseInt(btn.dataset.trans, 10);
      document.querySelectorAll('.trans-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateLCD();
    });
  });
  document.getElementById('btn-trans-down')?.addEventListener('click', () => {
    state.transpose = Math.max(-12, state.transpose - 1);
    updateLCD();
  });
  document.getElementById('btn-trans-up')?.addEventListener('click', () => {
    state.transpose = Math.min(12, state.transpose + 1);
    updateLCD();
  });

  // Octave / Pitch
  document.getElementById('octave')?.addEventListener('input', e => {
    state.octave = parseInt(e.target.value, 10);
    updateLCD();
  });
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

  let lastTap = 0, tapIntervals = [];
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
      } else tapIntervals = [];
    }
    lastTap = now;
  });

  document.getElementById('metro-sound')?.addEventListener('change', e => { state.metroSound = e.target.value; });
  document.getElementById('metro-pattern')?.addEventListener('change', e => { state.metroPattern = e.target.value; });

  document.querySelectorAll('.metro-note-vol').forEach(sl => {
    sl.addEventListener('input', e => {
      const idx = parseInt(e.target.dataset.beat, 10);
      state.metroVolumes[idx] = e.target.value / 100;
    });
  });
}

function boot() {
  setModel('HD-300');
  initAudio();
  populateVoices('piano');
  buildKeyboard();
  initComputerKeyboard();
  bindUI();
  updateLCD();

  const unlock = () => {
    resumeAudio();
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);

  console.log('%cHarmony Director Simulator ready (HD-300/HD-200 full)', 'color:#e8b86d;font-weight:bold');
}

boot();
