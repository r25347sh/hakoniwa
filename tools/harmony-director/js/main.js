/**
 * Harmony Director Simulator - Full feature entry
 */

import { state, setModel } from './state.js';
import {
  initAudio, resumeAudio, setMainVolume, setBalance,
  startMetronome, stopMetronome, setTempo, releaseAll, noteOn, noteOff
} from './audio/engine.js';
import { midiToNoteName } from './audio/temperament.js';
import { buildKeyboard, initComputerKeyboard } from './ui/keyboard.js';

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

let soundBackOn = false;
let recording = false;
let recChunks = [];
let mediaRecorder = null;

function updateLCD() {
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('lcd-voice', state.voiceId.toUpperCase().replace('-', ' ').slice(0, 12));
  set('lcd-pitch', `A=${state.refPitch.toFixed(1)}`);
  set('lcd-cent', `${state.centOffset >= 0 ? '+' : ''}${state.centOffset.toFixed(1)}c`);
  const tempLabel = { 'equal': 'EQUAL', 'pure-major': 'PURE MAJ', 'pure-minor': 'PURE MIN', 'individual': 'INDIV' }[state.temperament] || 'EQUAL';
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
  const list = state.model === 'HD-200' ? HD200_VOICES : (VOICES[cat] || VOICES.piano);
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

  document.getElementById('btn-power')?.addEventListener('click', e => {
    state.power = !state.power;
    e.currentTarget.classList.toggle('active', state.power);
    document.getElementById('device')?.classList.toggle('powered-off', !state.power);
    if (!state.power) { stopMetronome(); releaseAll(); }
    state.lcd.status = state.power ? 'READY' : 'OFF';
    updateLCD();
  });

  document.getElementById('main-vol')?.addEventListener('input', e => setMainVolume(e.target.value / 100));
  document.getElementById('balance')?.addEventListener('input', e => setBalance(e.target.value / 100));

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

  document.getElementById('fig-attack')?.addEventListener('input', e => { state.attack = e.target.value / 100; });
  document.getElementById('fig-release')?.addEventListener('input', e => { state.release = e.target.value / 100; });
  document.getElementById('fig-brill')?.addEventListener('input', e => { state.brilliance = e.target.value / 100; });

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

  document.getElementById('octave')?.addEventListener('input', e => {
    state.octave = parseInt(e.target.value, 10);
    updateLCD();
  });
  document.getElementById('ref-pitch')?.addEventListener('input', e => {
    state.refPitch = parseInt(e.target.value, 10) / 10;
    updateLCD();
  });

  document.getElementById('btn-hold')?.addEventListener('click', e => {
    state.hold = !state.hold;
    e.currentTarget.classList.toggle('active', state.hold);
    if (!state.hold) releaseAll();
    state.lcd.status = state.hold ? 'HOLD' : 'READY';
    updateLCD();
  });

  // SOUND BACK (simulated loopback beep of last chord root)
  document.getElementById('btn-soundback')?.addEventListener('click', e => {
    soundBackOn = !soundBackOn;
    e.currentTarget.classList.toggle('active', soundBackOn);
    state.lcd.status = soundBackOn ? 'SND BACK' : 'READY';
    updateLCD();
    if (soundBackOn) {
      resumeAudio();
      const n = state.rootNote || 60;
      noteOn(n, 0.5);
      setTimeout(() => noteOff(n, true), 400);
    }
  });

  // REC / PLAY (MediaRecorder if mic available)
  document.getElementById('btn-rec')?.addEventListener('click', async e => {
    if (recording) {
      mediaRecorder?.stop();
      recording = false;
      e.currentTarget.classList.remove('active');
      state.lcd.status = 'REC STOP';
      updateLCD();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = ev => { if (ev.data.size) recChunks.push(ev.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        state.lcd.status = 'REC READY';
        updateLCD();
      };
      mediaRecorder.start();
      recording = true;
      e.currentTarget.classList.add('active');
      state.lcd.status = 'RECORDING';
      updateLCD();
    } catch {
      state.lcd.status = 'MIC DENY';
      updateLCD();
      setTimeout(() => { state.lcd.status = 'READY'; updateLCD(); }, 1500);
    }
  });

  document.getElementById('btn-play')?.addEventListener('click', () => {
    if (!recChunks.length) {
      state.lcd.status = 'NO REC';
      updateLCD();
      setTimeout(() => { state.lcd.status = 'READY'; updateLCD(); }, 1200);
      return;
    }
    const blob = new Blob(recChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.play();
    state.lcd.status = 'PLAYING';
    updateLCD();
    a.onended = () => { state.lcd.status = 'READY'; updateLCD(); URL.revokeObjectURL(url); };
  });

  // TRAINING (demo scale)
  document.getElementById('btn-training')?.addEventListener('click', async () => {
    if (!state.power) return;
    resumeAudio();
    state.lcd.status = 'TRAINING';
    updateLCD();
    const scale = [0, 2, 4, 5, 7, 9, 11, 12];
    const base = 60 + state.transpose + state.octave * 12;
    for (const iv of scale) {
      noteOn(base + iv, 0.7);
      await new Promise(r => setTimeout(r, 320));
      noteOff(base + iv, true);
      await new Promise(r => setTimeout(r, 40));
    }
    state.lcd.status = 'READY';
    updateLCD();
  });

  // MIDI
  document.getElementById('btn-midi')?.addEventListener('click', async e => {
    if (!navigator.requestMIDIAccess) {
      state.lcd.status = 'NO MIDI';
      updateLCD();
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      access.inputs.forEach(input => {
        input.onmidimessage = msg => {
          const [status, note, vel] = msg.data;
          const cmd = status & 0xf0;
          if (cmd === 0x90 && vel > 0) noteOn(note, vel / 127);
          else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) noteOff(note);
        };
      });
      e.currentTarget.classList.add('active');
      state.lcd.status = 'MIDI ON';
      updateLCD();
    } catch {
      state.lcd.status = 'MIDI FAIL';
      updateLCD();
    }
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
      state.metroVolumes[parseInt(e.target.dataset.beat, 10)] = e.target.value / 100;
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
  console.log('%cHarmony Director ready', 'color:#d4a84b;font-weight:bold');
}

boot();
